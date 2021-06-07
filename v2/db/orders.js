import { DynamoDB } from 'aws-sdk';
import { nanoid } from 'nanoid';
import {
  orderStatuses,
  orderTypes,
  validOrderAttributes,
} from '../schema/orders';
import { pkPrefixes } from '../schema/pkPrefixes';
import { HttpError } from '../utils/http';
import { getItems } from './shared';
import { getUser } from './users';

const { MAIN_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

export async function createOrder(reqBody) {
  const orderAttributes = createOrderAttributes();

  if (!validOrderAttributes(orderAttributes))
    throw HttpError.BadRequest('Order attributes are invalid');

  const isValidUserOrder = await validUserOrder(orderAttributes);

  if (!isValidUserOrder)
    throw HttpError.BadRequest('User cannot create this order');

  return dynamoDb
    .transactWrite(createOrderTransaction(orderAttributes))
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
    const user = getItems(await getUser(reqBody.user));

    if (!user) {
      console.info('User does not exist');
      throw new HttpError('Could not get user');
    }

    if (orderAttributes.orderType === orderTypes.buy) {
      return user.cashOnHand >= orderAttributes.total;
    }

    if (orderAttributes.orderType === orderTypes.sell) {
      return (
        user.stocks[orderAttributes.tickerSymbol].quantityOnHand >=
        orderAttributes.quantity
      );
    }

    return false;
  }
}

function createOrderTransaction(orderAttributes) {
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
    ],
  };

  return result;
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
        ':pk': pkPrefixes.aiAction,
        ':sk': userPkSk,
      },
      ScanIndexForward: false,
      Limit: limit,
    })
    .promise();
}
