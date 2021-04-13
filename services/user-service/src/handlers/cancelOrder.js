import { DynamoDB } from 'aws-sdk';
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
            orderType: {
              type: 'string',
              pattern: '^(?:buy|sell)$',
            },
            quantity: {
              type: 'integer',
            },
            total: {
              type: 'integer',
            },
            userId: {
              type: 'string',
              format: 'uuid',
            },
            stock: {
              type: 'object',
              properties: {
                tickerSymbol: {
                  type: 'string',
                },
              },
              required: ['tickerSymbol'],
            },
          },
          required: ['orderType', 'quantity', 'total', 'userId', 'stock'],
        },
      },
      required: ['order'],
    },
  },
  required: ['body'],
};
const validationOptions = { inputSchema: requestSchema };

async function cancelOrder(event) {
  try {
    const { body: order } = event;
    const { userId } = order;

    const user = await getUser(userId);

    const params = createUpdateParams(user, order);

    await dynamoDb.update(params).promise();

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

function getUser(pk) {
  return dynamoDb
    .get({
      TableName: USERS_TABLE_NAME,
      Key: { pk },
    })
    .promise();
}

function createUpdateParams(user, order) {
  const { pk, cashOnHand, stocks } = user;
  const {
    orderType,
    quantity,
    total,
    stock: { tickerSymbol },
  } = order;

  const stock = stocks[tickerSymbol];
  const commonParams = {
    TableName: USERS_TABLE_NAME,
    Key: { pk },
    ReturnValues: 'UPDATED_NEW',
  };

  if (orderType === 'buy') {
    return {
      ...commonParams,
      UpdateExpression: 'SET #cashOnHand = :coh',
      ExpressionAttributeNames: {
        '#cashOnHand': 'cashOnHand',
      },
      ExpressionAttributeValues: {
        ':coh': cashOnHand + total,
      },
    };
  }

  if (orderType === 'sell') {
    return {
      ...commonParams,
      UpdateExpression: 'SET #stocks.#tickerSymbol = :stock',
      ExpressionAttributeNames: {
        '#stocks': 'stocks',
        '#tickerSymbol': tickerSymbol,
      },
      ExpressionAttributeValues: {
        ':stock': {
          ...stock,
          quantityOnHand: stock.quantityOnHand + quantity,
        },
      },
    };
  }

  throw createHttpError.BadRequest('Invalid order type');
}
