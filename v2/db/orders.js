import { DynamoDB } from 'aws-sdk';
import { nanoid } from 'nanoid';
import { validOrderAttributes } from '../schema/orders';
import { pkPrefixes } from '../schema/pkPrefixes';

const { MAIN_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

export async function createOrder(reqBody) {
  return dynamoDb.transactWrite(createOrderTransaction(reqBody)).promise();
}

function createOrderTransaction(reqBody) {
  const orderAttributes = createOrderAttributes(reqBody);

  if (!validOrderAttributes(orderAttributes))
    throw new Error('Order attributes are invalid');

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
            buyer: orderType === 'buy' ? userPkSk : '',
            seller: orderType === 'sell' ? userPkSk : '',
            originatingUser: userPkSk,
            orderType,
            orderStatus: 'open',
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
            orderStatus: 'open', // use this as a filter
            orderType, // use this as a filter
            tickerSymbol,
          },
        },
      },
    ],
  };

  return result;
}

function createOrderAttributes(reqBody) {
  const result = {
    ...reqBody,
    userPkSk: `${pkPrefixes.user}#${reqBody.user}`,
    companyPkSk: `${pkPrefixes.company}#${reqBody.tickerSymbol}`,
  };

  delete result.user;

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
