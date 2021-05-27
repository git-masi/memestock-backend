import { DynamoDB } from 'aws-sdk';
import { nanoid } from 'nanoid';
import { validOrderAttributes } from '../schema/orders';
import { pkPrefixes } from '../schema/pkPrefixes';

const { MAIN_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

export async function createOrder(orderAttributes) {
  return dynamoDb
    .transactWrite(createOrderTransaction(orderAttributes))
    .promise();
}

function createOrderTransaction(orderAttributes) {
  if (!validOrderAttributes(orderAttributes))
    throw new Error('Order attributes are invalid');

  const { orderType, userPkSk, companyPkSk, total, quantity } = orderAttributes;
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
            userPkSk: `${pkPrefixes.user}#${userPkSk}`,
            orderStatus: 'open', // use this as a filter
            orderType, // use this as a filter
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
