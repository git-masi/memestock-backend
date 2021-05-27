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
            status: 'open', // use this as a filter
            orderType, // use this as a filter
          },
        },
      },
    ],
  };

  return result;
}

export function getRecentOrders(status, orderType, limit = 10) {
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

  getFilterExpression();

  return dynamoDb.query(params).promise();

  function getFilterExpression() {
    if (status && orderType) {
      params.FilterExpression = '#status = :status AND #orderType = :orderType';
      params.ExpressionAttributeNames['#status'] = 'status';
      params.ExpressionAttributeValues[':status'] = status;
      params.ExpressionAttributeNames['#orderType'] = 'orderType';
      params.ExpressionAttributeValues[':orderType'] = orderType;
      return;
    }
    if (status) {
      params.FilterExpression = '#status = :status';
      params.ExpressionAttributeNames['#status'] = 'status';
      params.ExpressionAttributeValues[':status'] = status;
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
