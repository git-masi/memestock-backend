import { DynamoDB } from 'aws-sdk';
import cloneDeep from 'lodash.clonedeep';
import createHttpError from 'http-errors';
import { commonMiddlewareWithValidator, successResponse } from 'libs';

const { USERS_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();
const requestSchema = {
  properties: {
    body: {
      type: 'object',
      properties: {
        order: {
          type: 'object',
          properties: {
            quantity: {
              type: 'integer',
            },
            total: {
              type: 'integer',
            },
            orderType: {
              type: 'string',
              pattern: '^(?:buy|sell)$',
            },
            userId: {
              type: 'string',
              format: 'uuid',
            },
          },
          required: ['quantity', 'total', 'orderType', 'userId'],
        },
        user: {
          type: 'object',
          properties: {
            pk: {
              type: 'string',
              format: 'uuid',
            },
          },
          required: ['pk'],
        },
      },
      required: ['order', 'user'],
    },
  },
  required: ['body'],
};
const validationOptions = { inputSchema: requestSchema };

async function completeOrder(event) {
  try {
    const {
      body: { order, user },
    } = event;
    const { orderType, userId: originatingUserId } = order;
    const { pk: completingUserId } = user;

    // We have the completingUser data already but this acts as a further
    // validation to make sure the user exists
    const [originatingUserRes, completingUserRes] = await Promise.all([
      getUser(originatingUserId),
      getUser(completingUserId),
    ]);
    const { Item: originatingUser } = originatingUserRes;
    const { Item: completingUser } = completingUserRes;

    if (!originatingUser || !completingUser)
      throw createHttpError.BadRequest('Could not get users');

    const params =
      orderType === 'buy'
        ? createBuyOrderParams({
            order,
            originatingUser,
            completingUser,
          })
        : createSellOrderParams({
            order,
            originatingUser,
            completingUser,
          });

    console.log(params);

    await dynamoDb.transactWrite(params).promise();

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

function getUser(pk) {
  return dynamoDb
    .get({
      TableName: USERS_TABLE_NAME,
      Key: { pk },
    })
    .promise();
}

function createBuyOrderParams(args) {
  // Guard against data mutation
  const copy = cloneDeep(args);
  const { order, originatingUser, completingUser } = copy;
  const { stocks: ogUserStocks } = originatingUser;
  const { stocks: completingUserStocks } = completingUser;
  const orderTickerSymbol = order.stock.tickerSymbol;
  const ogUserStock = ogUserStocks[orderTickerSymbol];
  const completingUserStock = completingUserStocks[orderTickerSymbol];

  const newOGUserStock = ogUserStock
    ? {
        ...ogUserStock,
        quantityHeld: ogUserStock.quantityHeld + order.quantity,
        quantityOnHand: ogUserStock.quantityOnHand + order.quantity,
      }
    : {
        id: order.stock.pk,
        quantityHeld: order.quantity,
        quantityOnHand: order.quantity,
      };
  const newCompletingUserStock = {
    ...completingUserStock,
    quantityHeld: completingUserStock.quantityHeld - order.quantity,
    quantityOnHand: completingUserStock.quantityOnHand - order.quantity,
  };
  const newOGUserCash = {
    // cashOnHand: originatingUser.cashOnHand - order.total, // we already decreased the cash on hand when the order was created
    totalCash: originatingUser.totalCash - order.total,
  };
  const newCompletingUserCash = {
    cashOnHand: completingUser.cashOnHand + order.total,
    totalCash: completingUser.totalCash + order.total,
  };

  const params = {
    TransactItems: [
      {
        Update: {
          TableName: USERS_TABLE_NAME,
          Key: { pk: originatingUser.pk },
          UpdateExpression:
            'SET #cashOnHand = :coh, #totalCash = :tc, #stocks.#tickerSymbol = :stock',
          ExpressionAttributeNames: {
            '#cashOnHand': 'cashOnHand',
            '#totalCash': 'totalCash',
            '#stocks': 'stocks',
            '#tickerSymbol': orderTickerSymbol,
          },
          ExpressionAttributeValues: {
            ':coh': newOGUserCash.cashOnHand,
            ':tc': newOGUserCash.totalCash,
            ':stock': newOGUserStock,
          },
          ReturnValues: 'ALL_NEW',
        },
      },
      {
        Update: {
          TableName: USERS_TABLE_NAME,
          Key: { pk: completingUser.pk },
          UpdateExpression:
            'SET #cashOnHand = :coh, #totalCash = :tc, #stocks.#tickerSymbol = :stock',
          ExpressionAttributeNames: {
            '#cashOnHand': 'cashOnHand',
            '#totalCash': 'totalCash',
            '#stocks': 'stocks',
            '#tickerSymbol': orderTickerSymbol,
          },
          ExpressionAttributeValues: {
            ':coh': newCompletingUserCash.cashOnHand,
            ':tc': newCompletingUserCash.totalCash,
            ':stock': newCompletingUserStock,
          },
          ReturnValues: 'ALL_NEW',
        },
      },
    ],
  };

  return params;
}

function createSellOrderParams(args) {
  // Guard against data mutation
  const copy = cloneDeep(args);
  const { order, originatingUser, completingUser } = copy;
  const { stocks: ogUserStocks } = originatingUser;
  const { stocks: completingUserStocks } = completingUser;
  const orderTickerSymbol = order.stock.tickerSymbol;
  const ogUserStock = ogUserStocks[orderTickerSymbol];
  const completingUserStock = completingUserStocks[orderTickerSymbol];

  const newOGUserStock = {
    ...ogUserStock,
    quantityHeld: ogUserStock.quantityHeld - order.quantity,
    // quantityOnHand: ogUserStock.quantityOnHand - order.quantity, // we already decreased the quantity on hand when the order was created
  };
  const newCompletingUserStock = completingUserStock
    ? {
        ...completingUserStock,
        quantityHeld: completingUserStock.quantityHeld + order.quantity,
        quantityOnHand: completingUserStock.quantityOnHand + order.quantity,
      }
    : {
        id: order.stock.pk,
        quantityHeld: order.quantity,
        quantityOnHand: order.quantity,
      };
  const newOGUserCash = {
    cashOnHand: originatingUser.cashOnHand + order.total,
    totalCash: originatingUser.totalCash + order.total,
  };
  const newCompletingUserCash = {
    cashOnHand: completingUser.cashOnHand - order.total,
    totalCash: completingUser.totalCash - order.total,
  };

  const params = {
    TransactItems: [
      {
        Update: {
          TableName: USERS_TABLE_NAME,
          Key: { pk: originatingUser.pk },
          UpdateExpression:
            'SET #cashOnHand = :coh, #totalCash = :tc, #stocks.#tickerSymbol = :stock',
          ExpressionAttributeNames: {
            '#cashOnHand': 'cashOnHand',
            '#totalCash': 'totalCash',
            '#stocks': 'stocks',
            '#tickerSymbol': orderTickerSymbol,
          },
          ExpressionAttributeValues: {
            ':coh': newOGUserCash.cashOnHand,
            ':tc': newOGUserCash.totalCash,
            ':stock': newOGUserStock,
          },
          ReturnValues: 'UPDATED_NEW',
        },
      },
      {
        Update: {
          TableName: USERS_TABLE_NAME,
          Key: { pk: completingUser.pk },
          UpdateExpression:
            'SET #cashOnHand = :coh, #totalCash = :tc, #stocks.#tickerSymbol = :stock',
          ExpressionAttributeNames: {
            '#cashOnHand': 'cashOnHand',
            '#totalCash': 'totalCash',
            '#stocks': 'stocks',
            '#tickerSymbol': orderTickerSymbol,
          },
          ExpressionAttributeValues: {
            ':coh': newCompletingUserCash.cashOnHand,
            ':tc': newCompletingUserCash.totalCash,
            ':stock': newCompletingUserStock,
          },
          ReturnValues: 'ALL_NEW',
        },
      },
    ],
  };

  return params;
}
