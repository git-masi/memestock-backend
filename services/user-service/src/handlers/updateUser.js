import { DynamoDB } from 'aws-sdk';
import createHttpError from 'http-errors';
import isEmpty from 'lodash.isempty';
import { commonMiddlewareWithValidator, successResponse } from 'libs';

const { USERS_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();
const requestSchema = {
  properties: {
    body: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          format: 'uuid',
        },
        cashOnHand: {
          type: 'integer',
        },
        totalCash: {
          type: 'integer',
        },
        stocks: {
          type: 'object',
          patternProperties: {
            '^[A-Z]+$': {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  format: 'uuid',
                },
                quantityOnHand: {
                  type: 'integer',
                },
                quantityHeld: {
                  type: 'integer',
                },
              },
              required: ['id', 'quantityOnHand', 'quantityHeld'],
            },
          },
        },
      },
      required: ['userId'],
    },
  },
  required: ['body'],
};
const validationOptions = { inputSchema: requestSchema };

async function updateUser(event) {
  try {
    const { body } = event;
    const { Item: user } = await getUser(body.userId);

    if (isEmpty(user)) return createHttpError.BadRequest('Invalid user ID');

    const params = createUpdateParams(user, body);

    await dynamoDb.update(params).promise();

    return successResponse();
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddlewareWithValidator(
  updateUser,
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

function createUpdateParams(user, body) {
  const { pk } = user;

  const commonParams = {
    TableName: USERS_TABLE_NAME,
    Key: { pk },
    ReturnValues: 'UPDATED_NEW',
  };

  return {
    ...commonParams,
    UpdateExpression: createUpdateExpression(body),
    ExpressionAttributeNames: createAttributeNames(body),
    ExpressionAttributeValues: createAttributeValues(body),
  };
}

function createUpdateExpression(body) {
  const { cashOnHand, totalCash, stocks } = body;
  const parts = [];

  if (cashOnHand) {
    parts.push(' #cashOnHand = :cashOnHand');
  }

  if (totalCash) {
    parts.push(' #totalCash = :totalCash');
  }

  if (!isEmpty(stocks)) {
    const keys = Object.keys(stocks);

    for (let key of keys) {
      parts.push(` #stocks.#${key} = :${key}`);
    }
  }

  return `SET${parts.join(',')}`;
}

function createAttributeNames(body) {
  const { cashOnHand, totalCash, stocks } = body;
  const names = {};

  if (cashOnHand) {
    names['#cashOnHand'] = 'cashOnHand';
  }

  if (totalCash) {
    names['#totalCash'] = 'totalCash';
  }

  if (!isEmpty(stocks)) {
    names['#stocks'] = 'stocks';
    const keys = Object.keys(stocks);

    for (let key of keys) {
      names[`#${key}`] = key;
    }
  }

  return names;
}

function createAttributeValues(body) {
  const { cashOnHand, totalCash, stocks: newStocks } = body;
  const values = {};

  if (cashOnHand) {
    values[':cashOnHand'] = cashOnHand;
  }

  if (totalCash) {
    values[':totalCash'] = totalCash;
  }

  if (!isEmpty(newStocks)) {
    const keys = Object.keys(newStocks);

    for (let key of keys) {
      values[`:${key}`] = newStocks[key];
    }
  }

  return values;
}
