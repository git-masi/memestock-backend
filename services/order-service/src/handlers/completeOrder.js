import { DynamoDB } from 'aws-sdk';
import axios from 'axios';
import isEmpty from 'lodash.isempty';
import createHttpError from 'http-errors';
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
        userCompletingOrder: {
          type: 'string',
          format: 'uuid',
        },
      },
      required: ['orderId', 'userCompletingOrder'],
    },
  },
  required: ['body'],
};
const validationOptions = { inputSchema: requestSchema };

async function completeOrder(event) {
  try {
    const {
      body: { orderId, userCompletingOrder },
    } = event;

    const orderAndUser = await getOrderAndUser(orderId, userCompletingOrder);

    console.log({ ...orderAndUser });
    // ideally this would be an ACID transaction
    await Promise.all([updateUsers(orderAndUser), updateOrderStatus(orderId)]);

    // todo: create transaction

    return successResponse();
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddlewareWithValidator(
  completeOrder,
  validationOptions
);

async function getOrderAndUser(orderId, userId) {
  const [{ Item: order }, user] = await Promise.all([
    getOrder(orderId),
    getUser(userId),
  ]);

  if (!order || isEmpty(user)) {
    throw createHttpError.BadRequest(
      'Invalid value for orderId or userCompletingOrder'
    );
  }

  const tickerSymbol = order.stock.tickerSymbol;
  const userHasStock = tickerSymbol in user.stocks;
  const userHasQuantityRequired =
    user?.stocks?.[tickerSymbol]?.quantityOnHand > order.quantity;

  if (
    order.orderType === 'buy' &&
    (!userHasStock || !userHasQuantityRequired)
  ) {
    console.log('User does not have enough stock to complete the order: ', {
      user,
      order,
    });
    throw createHttpError.BadRequest('User cannot complete this order');
  }

  if (order.orderType === 'sell' && user.cashOnHand < order.total) {
    console.log('Cash on hand too low to complete order: ', { user, order });
    throw createHttpError.BadRequest('User cannot complete this order');
  }

  return { order, user };
}

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

async function getUser(userId) {
  const { data } = await axios.get(`${USER_SERVICE_URL}/user?userId=${userId}`);
  return data;
}

function updateUsers(body) {
  return axios.put(`${USER_SERVICE_URL}/user/complete-order`, body);
}

function updateOrderStatus(orderId) {
  return dynamoDb
    .update({
      TableName: ORDERS_TABLE_NAME,
      Key: { id: orderId },
      UpdateExpression: 'set #status = :completed',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':completed': statuses.completed,
      },
    })
    .promise();
}
