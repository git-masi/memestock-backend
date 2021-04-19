// Modules
import { DynamoDB } from 'aws-sdk';
import { v4 as uuid } from 'uuid';
import axios from 'axios';
import isEmpty from 'lodash.isempty';
import cloneDeep from 'lodash.clonedeep';
import createHttpError from 'http-errors';

// Libs
import { commonMiddlewareWithValidator, successResponse, statuses } from 'libs';

const { ORDERS_TABLE_NAME, USER_SERVICE_URL } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();
const requestSchema = {
  properties: {
    body: {
      type: 'object',
      properties: {
        orderType: {
          type: 'string',
          pattern: '^(buy|sell)$',
        },
        total: {
          type: 'integer',
          min: 1,
        },
        stock: {
          type: 'object',
        },
        quantity: {
          type: 'integer',
          min: 1,
        },
        userId: {
          type: 'string',
          format: 'uuid',
        },
      },
      required: ['total', 'stock', 'quantity', 'userId'],
    },
    required: { body: true },
  },
};
const validationOptions = { inputSchema: requestSchema };

async function createTransaction(event) {
  try {
    const { body } = event;
    const user = await getUser(body);

    if (isEmpty(user)) return createHttpError.BadRequest('Invalid user ID');

    if (!canCompleteOrder(user, body))
      return createHttpError.BadRequest('User cannot create order');

    await updateUser(user, body);

    const order = createOrderAttributes(body);
    const params = {
      TableName: ORDERS_TABLE_NAME,
      Item: order,
    };

    await dynamoDb.put(params).promise();

    return successResponse(order);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddlewareWithValidator(
  createTransaction,
  validationOptions
);

async function getUser(body) {
  const { userId } = body;
  const { data } = await axios.get(`${USER_SERVICE_URL}/user?userId=${userId}`);
  return data;
}

function canCompleteOrder(user, order) {
  const { cashOnHand, stocks } = user;
  const {
    orderType,
    total,
    quantity,
    stock: { tickerSymbol },
  } = order;

  if (orderType === 'buy') {
    if (cashOnHand < total) return false;
  }

  if (orderType === 'sell') {
    if (stocks[tickerSymbol].quantityOnHand < quantity) return false;
  }

  return true;
}

async function updateUser(user, order) {
  const body = createUpdateReqBody(user, order);
  const { data } = await axios.put(`${USER_SERVICE_URL}/user/update`, body);
  return data;
}

function createUpdateReqBody(user, order) {
  const { pk, cashOnHand, stocks } = user;
  const {
    orderType,
    total,
    quantity,
    stock: { tickerSymbol },
  } = order;
  const body = { userId: pk };

  if (orderType === 'buy') {
    body.cashOnHand = cashOnHand - total;
  }

  if (orderType === 'sell') {
    const copy = cloneDeep(stocks);
    const stock = copy[tickerSymbol];
    body.stocks = {
      [tickerSymbol]: {
        ...stock,
        quantityOnHand: stock.quantityOnHand - quantity,
      },
    };
  }

  return body;
}

function createOrderAttributes(body) {
  return {
    id: uuid(),
    status: statuses.open,
    created: new Date().toISOString(),
    ...body,
  };
}
