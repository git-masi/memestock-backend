import { DynamoDB } from 'aws-sdk';
import axios from 'axios';
import isEmpty from 'lodash.isempty';
import createHttpError from 'http-errors';
import { commonMiddlewareWithValidator, statuses, successResponse } from 'libs';

const {
  ORDERS_TABLE_NAME,
  USER_SERVICE_URL,
  TRANSACTION_SERVICE_URL,
} = process.env;
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

    const { Item: order } = await getOrder(orderId);

    if (isEmpty(order))
      return createHttpError.BadRequest('Could not get order');

    const [initiatingUser, completingUser] = await Promise.all([
      getUser(order.userId),
      getUser(userCompletingOrder),
    ]);

    validateOrderAndCompletingUser(order, completingUser);

    // ideally this would be an ACID transaction
    await Promise.all([
      updateUsers({ order, user: completingUser }),
      updateOrderStatus(orderId),
      createTransaction({ order, initiatingUser, completingUser }),
    ]);

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

async function validateOrderAndCompletingUser(order, user) {
  const tickerSymbol = order.stock.tickerSymbol;
  const userHasStock = tickerSymbol in user.stocks;
  const userHasQuantityRequired =
    user?.stocks?.[tickerSymbol]?.quantityOnHand >= order.quantity;

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

function createTransaction(args) {
  const { order, initiatingUser, completingUser } = args;
  const { total, quantity, stock } = order;
  const { buyer, seller } = getBuyerAndSeller(args);
  // todo: this should be required
  const message =
    order.orderType === 'buy'
      ? initiatingUser?.message ?? 'To the moon!'
      : completingUser?.message ?? 'To the moon!';
  const body = {
    total,
    quantity,
    stock,
    message,
    buyer,
    seller,
  };

  return axios.post(`${TRANSACTION_SERVICE_URL}/transaction/create`, body);
}

function getBuyerAndSeller(args) {
  const { order, initiatingUser, completingUser } = args;
  const initUserVals = {
    displayName: initiatingUser.displayName,
    email: initiatingUser.email,
    pk: initiatingUser.pk,
  };
  const completingUserVals = {
    displayName: completingUser.displayName,
    email: completingUser.email,
    pk: completingUser.pk,
  };

  if (order.orderType === 'buy') {
    return { buyer: initUserVals, seller: completingUserVals };
  }

  if (order.orderType === 'sell') {
    return { buyer: completingUserVals, seller: initUserVals };
  }

  return { buyer: {}, seller: {} };
}
