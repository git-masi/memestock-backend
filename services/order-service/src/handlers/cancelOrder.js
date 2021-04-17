import { DynamoDB } from 'aws-sdk';
import axios from 'axios';
import { commonMiddlewareWithValidator, statuses, successResponse } from 'libs';

const { ORDERS_TABLE_NAME, USER_SERVICE_URL } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();
const requestSchema = {
  properties: {
    body: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          format: 'uuid',
        },
      },
      required: ['orderId'],
    },
  },
  required: ['body'],
};
const validationOptions = { inputSchema: requestSchema };

async function cancelOrder(event) {
  try {
    const {
      body: { orderId },
    } = event;

    const { Item: order } = await getOrder(orderId);

    // ideally this would be an ACID transaction
    await Promise.all([updateOrderStatus(orderId), updateUser(order)]);

    return successResponse();
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddlewareWithValidator(
  cancelOrder,
  validationOptions
);

function getOrder(orderId) {
  return dynamoDb
    .get({
      TableName: ORDERS_TABLE_NAME,
      Key: {
        id: orderId,
      },
    })
    .promise();
}

function updateUser(order) {
  // todo: refactor to use the update route
  const body = { order };
  return axios.put(`${USER_SERVICE_URL}/user/cancel-order`, body);
}

function updateOrderStatus(orderId) {
  return dynamoDb
    .update({
      TableName: ORDERS_TABLE_NAME,
      Key: { id: orderId },
      UpdateExpression: 'SET #status = :cancelled',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':cancelled': statuses.cancelled,
      },
    })
    .promise();
}
