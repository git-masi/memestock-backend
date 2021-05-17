import { DynamoDB } from 'aws-sdk';
import { randomInt } from 'd3-random';
import { nanoid } from 'nanoid';
import { apiResponse, HttpError, httpMethods } from '../utils/http';
import { commonMiddleware } from '../utils/middleware';
import { validRequestFor } from './usersSchema';

const { MAIN_TABLE_NAME } = process.env;
const minStartingCash = 10000; // cents
const maxStartingCash = 500000; // cents
const dynamoDb = new DynamoDB.DocumentClient();

export const handler = commonMiddleware(lambdaForUsers);

async function lambdaForUsers(event) {
  try {
    if (!validRequestFor(event)) throw HttpError.BadRequest();
    const result = await route(event);
    return apiResponse({ body: result });
  } catch (error) {
    console.info(error);

    if (error instanceof HttpError) return apiResponse({ ...error });

    return apiResponse({
      statusCode: 500,
    });
  }
}

function route(anEvent) {
  switch (anEvent.httpMethod) {
    case httpMethods.GET:
      return getUserFrom(anEvent);

    case httpMethods.POST:
      return createUserFrom(anEvent);

    default:
      throw HttpError.BadRequest();
  }
}

async function getUserFrom(anEvent) {
  return { id: 1, username: 'bob' };
}

async function createUserFrom(anEvent) {
  const {
    body: { displayName, email },
  } = anEvent;
  const startingCash = getRandomInt(minStartingCash, maxStartingCash);
  const transaction = {
    TransactItems: [
      {
        Put: {
          TableName: MAIN_TABLE_NAME,
          Item: {
            pk: 'USER',
            sk: `HUMAN#${new Date().toISOString()}#${nanoid(8)}`,
            displayName,
            email,
            // stocks: await createStartingStocks(),
            stocks: {},
            totalCash: startingCash,
            cashOnHand: startingCash,
          },
        },
      },
      {
        Put: {
          TableName: MAIN_TABLE_NAME,
          ConditionExpression: 'attribute_not_exists(pk)',
          Item: {
            pk: `DISPLAY_NAME#${displayName}`,
            sk: displayName,
          },
        },
      },
      {
        Put: {
          TableName: MAIN_TABLE_NAME,
          ConditionExpression: 'attribute_not_exists(pk)',
          Item: {
            pk: `EMAIL#${email}`,
            sk: email,
          },
        },
      },
    ],
  };
  return dynamoDb.transactWrite(transaction).promise();
}

// const getRandomIntZeroToX = (x) => randomInt(0, x)();

function getRandomInt(min, max) {
  return randomInt(min, max)();
}

// const getRandomValueFromArray = (arr) =>
//   arr instanceof Array && arr[getRandomIntZeroToX(arr.length)];

// const getRandomFloat = (min, max) => randomUniform(min, max)();

// const generateRandomBoolean = (probability = 0.5) =>
//   probability > randomUniform(0, 1)();
