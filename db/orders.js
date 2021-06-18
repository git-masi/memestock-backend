import { DynamoDB } from 'aws-sdk';
import { nanoid } from 'nanoid';
import {
  orderStatuses,
  orderTypes,
  validOrderAttributes,
} from '../schema/orders';
import { pkPrefixes, stripPk } from '../schema/pkPrefixes';
import { HttpError } from '../utils/http';
import { getItems } from './shared';
import { getUser } from './users';

const { MAIN_TABLE_NAME, ORDER_STATUS_AND_SK_GSI } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

export async function createOrder(reqBody) {
  const orderAttributes = createOrderAttributes();

  if (!validOrderAttributes(orderAttributes))
    throw HttpError.BadRequest('Order attributes are invalid');

  const user = getItems(await getUser(reqBody.user));

  if (!user) {
    console.info('User does not exist');
    throw new HttpError('Could not get user');
  }

  const isValidUserOrder = await validUserOrder(orderAttributes);

  if (!isValidUserOrder)
    throw HttpError.BadRequest('User cannot create this order');

  return dynamoDb
    .transactWrite(createOrderTransaction(orderAttributes, user))
    .promise();

  function createOrderAttributes() {
    const result = {
      ...reqBody,
      userPkSk: `${pkPrefixes.user}#${reqBody.user}`,
      companyPkSk: `${pkPrefixes.company}#${reqBody.tickerSymbol}`,
    };

    delete result.user;

    return result;
  }

  async function validUserOrder() {
    if (orderAttributes.orderType === orderTypes.buy) {
      return user.cashOnHand >= orderAttributes.total;
    }

    if (orderAttributes.orderType === orderTypes.sell) {
      return (
        (user.stocks?.[orderAttributes.tickerSymbol]?.quantityOnHand ?? 0) >=
        orderAttributes.quantity
      );
    }

    return false;
  }
}

function createOrderTransaction(orderAttributes, user) {
  const { orderType, userPkSk, companyPkSk, total, quantity, tickerSymbol } =
    orderAttributes;
  const created = new Date().toISOString();
  const sk = `${created}#${nanoid(8)}`;
  const result = {
    TransactItems: [
      {
        Put: {
          TableName: MAIN_TABLE_NAME,
          Item: {
            pk: pkPrefixes.order,
            sk,
            created,
            companyPkSk,
            total,
            quantity,
            buyer: orderType === orderTypes.buy ? userPkSk : '',
            seller: orderType === orderTypes.sell ? userPkSk : '',
            originatingUser: userPkSk,
            orderType,
            orderStatus: orderStatuses.open,
            tickerSymbol,
          },
        },
      },
      {
        Put: {
          TableName: MAIN_TABLE_NAME,
          Item: {
            pk: pkPrefixes.userOrder,
            sk: `${userPkSk}#${pkPrefixes.order}#${sk}`,
            orderPkSk: `${pkPrefixes.order}#${sk}`,
            userPkSk: userPkSk,
            orderStatus: orderStatuses.open, // use this as a filter
            orderType, // use this as a filter
            tickerSymbol,
          },
        },
      },
      {
        Update: {
          TableName: MAIN_TABLE_NAME,
          Key: {
            pk: pkPrefixes.user,
            sk: userPkSk.replace(`${pkPrefixes.user}#`, ''),
          },
          ...createUserUpdateExpression(),
        },
      },
    ],
  };

  return result;

  function createUserUpdateExpression() {
    if (orderType === orderTypes.buy) {
      return {
        UpdateExpression: 'SET #coh = :coh',
        ExpressionAttributeNames: {
          '#coh': 'cashOnHand',
        },
        ExpressionAttributeValues: {
          ':coh': user.cashOnHand - total,
        },
      };
    }

    if (orderType === orderTypes.sell) {
      return {
        UpdateExpression: 'SET #stocks.#s.#qoh = :qoh',
        ExpressionAttributeNames: {
          '#stocks': 'stocks',
          '#s': tickerSymbol,
          '#qoh': 'quantityOnHand',
        },
        ExpressionAttributeValues: {
          ':qoh': user.stocks[tickerSymbol].quantityOnHand - quantity,
        },
      };
    }

    return {};
  }
}

export function getOrder(sk) {
  return dynamoDb
    .get({
      TableName: MAIN_TABLE_NAME,
      Key: {
        pk: pkPrefixes.order,
        sk,
      },
    })
    .promise();
}

export function getOrders(config) {
  // todo: validate config with schema
  const { asc = true, limit, orderStatus } = config;
  const params = {
    TableName: MAIN_TABLE_NAME,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: {
      ':pk': pkPrefixes.order,
    },
    ScanIndexForward: asc,
  };

  if (Number.isInteger(limit) && limit > 0) {
    params.Limit = limit;
  }

  // Because this represents a branch in how the query is executed
  // this entire function could probably be refactored
  //
  // Using this index and setting the sk like this is a little hacky
  // but it's the result of some unintended single table design choices
  //
  // We use the index because a FilterExpression does not work as
  // expected with a Limit
  // For example if you have a FilterExpression and Limit you don't
  // results matching the FilterExpression up to the Limit, instead
  // you get query results up to the Limit which are then filtered
  //
  // And because both ORDER and USER_ORDER have orderStatus attributes
  // We need to specify that an sk starts with "2" because that is the
  // first number of the year (e.g. 2021) at least for the next 900+ years
  if (orderStatus) {
    delete params.ExpressionAttributeValues[':pk'];
    params.IndexName = ORDER_STATUS_AND_SK_GSI;
    params.KeyConditionExpression =
      'orderStatus = :orderStatus AND begins_with(sk, :sk)';
    params.ExpressionAttributeValues = {
      ...params.ExpressionAttributeValues,
      ':orderStatus': orderStatus,
      ':sk': '2',
    };
  }

  return dynamoDb.query(params).promise();
}

export function getCountOfOrders(orderStatus, lastEvaluatedKey) {
  const params = {
    TableName: MAIN_TABLE_NAME,
    KeyConditionExpression: 'pk = :pk ',
    FilterExpression: 'orderStatus = :orderStatus',
    ExpressionAttributeValues: {
      ':pk': pkPrefixes.order,
      ':orderStatus': orderStatus,
    },
    Select: 'COUNT',
  };

  if (lastEvaluatedKey) {
    params.ExclusiveStartKey = lastEvaluatedKey;
  }

  return dynamoDb.query(params).promise();
}

export function getRecentOrders(orderStatus, orderType, limit = 10) {
  const params = {
    TableName: MAIN_TABLE_NAME,
    KeyConditionExpression: '#pk = :pk',
    ExpressionAttributeNames: {
      '#pk': 'pk',
    },
    ExpressionAttributeValues: {
      ':pk': pkPrefixes.order,
    },
    ScanIndexForward: false,
    Limit: limit,
  };

  createFilterExpression();

  return dynamoDb.query(params).promise();

  function createFilterExpression() {
    if (orderStatus && orderType) {
      params.FilterExpression =
        '#orderStatus = :orderStatus AND #orderType = :orderType';
      params.ExpressionAttributeNames['#orderStatus'] = 'orderStatus';
      params.ExpressionAttributeValues[':orderStatus'] = orderStatus;
      params.ExpressionAttributeNames['#orderType'] = 'orderType';
      params.ExpressionAttributeValues[':orderType'] = orderType;
      return;
    }
    if (orderStatus) {
      params.FilterExpression = '#orderStatus = :orderStatus';
      params.ExpressionAttributeNames['#orderStatus'] = 'orderStatus';
      params.ExpressionAttributeValues[':orderStatus'] = orderStatus;
      return;
    }
    if (orderType) {
      params.FilterExpression = '#orderType = :orderType';
      params.ExpressionAttributeNames['#orderType'] = 'orderType';
      params.ExpressionAttributeValues[':orderType'] = orderType;
      return;
    }
  }
}

export function getRecentUserOrders(userPkSk, limit = 10) {
  return dynamoDb
    .query({
      TableName: MAIN_TABLE_NAME,
      KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :sk)',
      ExpressionAttributeNames: {
        '#pk': 'pk',
        '#sk': 'sk',
      },
      ExpressionAttributeValues: {
        ':pk': pkPrefixes.userOrder,
        ':sk': userPkSk,
      },
      ScanIndexForward: false,
      Limit: limit,
    })
    .promise();
}

export async function fulfillOrder(orderSk, completingUserSk) {
  const order = getItems(await getOrder(orderSk));

  if (order.orderStatus !== orderStatuses.open)
    throw HttpError.BadRequest('Cannot fulfill order that is not open');

  const originatingUser = getItems(
    await getUser(stripPk(order.originatingUser))
  );
  const completingUser = getItems(await getUser(completingUserSk));

  if (originatingUser.sk === completingUser.sk)
    throw HttpError.BadRequest('Buyer and seller cannot be the same user');

  const buyer =
    order.orderType === orderTypes.buy ? originatingUser : completingUser;
  const seller =
    order.orderType === orderTypes.sell ? originatingUser : completingUser;

  if (
    (order.orderType === orderTypes.buy &&
      (completingUser.stocks?.[order.tickerSymbol]?.quantityOnHand ?? 0) <
        order.quantity) ||
    (order.orderType === orderTypes.sell &&
      completingUser.totalCash < order.total)
  )
    throw HttpError.BadRequest('Cannot fulfill order');

  const params = {
    TransactItems: [
      {
        Update: {
          TableName: MAIN_TABLE_NAME,
          Key: {
            pk: pkPrefixes.company,
            sk: order.tickerSymbol,
          },
          UpdateExpression:
            'SET currentPricePerShare = :cpps, previousPricePerShare = currentPricePerShare',
          ExpressionAttributeValues: {
            ':cpps': +(order.total / order.quantity).toFixed(2), // there may be a more accurate way to do this
          },
        },
      },
      {
        Update: {
          TableName: MAIN_TABLE_NAME,
          Key: {
            pk: pkPrefixes.order,
            sk: orderSk,
          },
          ...createOrderUpdateExpression(),
        },
      },
      {
        Update: {
          TableName: MAIN_TABLE_NAME,
          Key: {
            pk: pkPrefixes.userOrder,
            sk: `${originatingUser.pk}#${originatingUser.sk}#${order.pk}#${order.sk}`,
          },
          UpdateExpression: 'SET orderStatus = :orderStatus',
          ExpressionAttributeValues: {
            ':orderStatus': orderStatuses.fulfilled,
          },
        },
      },
      {
        Put: {
          TableName: MAIN_TABLE_NAME,
          Item: {
            pk: pkPrefixes.userOrder,
            sk: `${completingUser.pk}#${completingUser.sk}#${order.pk}#${order.sk}`,
            orderPkSk: `${order.pk}#${order.sk}`,
            userPkSk: `${completingUser.pk}#${completingUser.sk}`,
            orderStatus: orderStatuses.fulfilled,
            orderType: order.orderType,
            tickerSymbol: order.tickerSymbol,
          },
        },
      },
      {
        Update: {
          TableName: MAIN_TABLE_NAME,
          Key: {
            pk: pkPrefixes.user,
            sk: buyer.sk,
          },
          ...createUserUpdateExpression('buyer'),
        },
      },
      {
        Update: {
          TableName: MAIN_TABLE_NAME,
          Key: {
            pk: pkPrefixes.user,
            sk: seller.sk,
          },
          ...createUserUpdateExpression('seller'),
        },
      },
    ],
  };

  return dynamoDb.transactWrite(params).promise();

  function createOrderUpdateExpression() {
    switch (order.orderType) {
      case orderTypes.buy:
        return {
          UpdateExpression: 'SET seller = :seller, orderStatus = :orderStatus',
          ExpressionAttributeValues: {
            ':seller': `${completingUser.pk}#${completingUser.sk}`,
            ':orderStatus': orderStatuses.fulfilled,
          },
        };

      case orderTypes.sell:
        return {
          UpdateExpression: 'SET buyer = :buyer, orderStatus = :orderStatus',
          ExpressionAttributeValues: {
            ':buyer': `${completingUser.pk}#${completingUser.sk}`,
            ':orderStatus': orderStatuses.fulfilled,
          },
        };

      default:
        return {};
    }
  }

  function createUserUpdateExpression(userRole) {
    switch (userRole) {
      case 'buyer':
        return {
          UpdateExpression: 'SET totalCash = :tc',
          ExpressionAttributeValues: {
            ':tc': buyer.totalCash - order.total,
          },
        };

      case 'seller':
        return {
          UpdateExpression: 'SET stocks.#ts.quantityHeld = :qh',
          ExpressionAttributeNames: {
            '#ts': order.tickerSymbol,
          },
          ExpressionAttributeValues: {
            ':qh':
              seller.stocks[order.tickerSymbol].quantityHeld - order.quantity,
          },
        };

      default:
        return {};
    }
  }
}

export async function cancelOrder(orderSk) {
  const order = getItems(await getOrder(orderSk));

  if (order.orderStatus !== orderStatuses.open)
    throw HttpError.BadRequest('Cannot fulfill order that is not open');

  return dynamoDb
    .transactWrite({
      TransactItems: [
        {
          Update: {
            TableName: MAIN_TABLE_NAME,
            Key: {
              pk: `${pkPrefixes.order}#${order.sk}`,
              sk: order.sk,
            },
            UpdateExpression: 'set orderStatus = :orderStatus',
            ExpressionAttributeValues: {
              ':orderStatus': orderStatuses.cancelled,
            },
          },
        },
        {
          Update: {
            TableName: MAIN_TABLE_NAME,
            Key: {
              pk: pkPrefixes.userOrder,
              sk: `${order.originatingUser}#${order.pk}#${order.sk}`,
            },
            UpdateExpression: 'set orderStatus = :orderStatus',
            ExpressionAttributeValues: {
              ':orderStatus': orderStatuses.cancelled,
            },
          },
        },
      ],
    })
    .promise();
}
