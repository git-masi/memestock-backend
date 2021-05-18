import { DynamoDB } from 'aws-sdk';
import { randomInt } from 'd3-random';
import { nanoid } from 'nanoid';
import { apiResponse, HttpError, httpMethods } from '../utils/http';
import { commonMiddleware } from '../utils/middleware';
import { validUserConfig, validUsersHttpEvent } from './usersSchema';

const { MAIN_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

export const handler = commonMiddleware(lambdaForUsers);

export const userTypes = Object.freeze({
  human: 'HUMAN',
  ai: 'AI',
});

async function lambdaForUsers(event) {
  try {
    if (!validUsersHttpEvent(event)) throw HttpError.BadRequest();
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

function route(event) {
  switch (event.httpMethod) {
    case httpMethods.GET:
      return getUser(event);

    case httpMethods.POST:
      return createUserFromHttpEvent(event);

    default:
      throw HttpError.BadRequest();
  }
}

async function getUser(event) {
  return { id: 1, username: 'bob' };
}

function createUserFromHttpEvent(event) {
  const {
    body: { displayName, email },
  } = event;

  return createUser({
    displayName,
    email,
    type: userTypes.human,
  });
}

export function createUser(userConfig) {
  if (!validUserConfig(userConfig)) throw new Error('Invalid user config');
  return dynamoDb.transactWrite(createTransaction(userConfig)).promise();
}

function createTransaction(userConfig) {
  const { displayName, email, type } = userConfig;
  let result;

  switch (type) {
    case userTypes.human:
      result = humanUser(displayName, email);
      break;

    case userTypes.ai:
      result = aiUser(displayName);
      break;

    default:
      result = {};
      break;
  }

  return result;
}

function humanUser(displayName, email) {
  return {
    TransactItems: [
      {
        Put: {
          ...userParams(displayName),
          sk: `HUMAN#${new Date().toISOString()}#${nanoid(8)}`,
          email: email,
        },
      },
      {
        Put: guardParams('DISPLAY_NAME', displayName),
      },
      {
        Put: guardParams('EMAIL', email),
      },
    ],
  };
}

function aiUser(displayName) {
  return {
    TransactItems: [
      {
        Put: {
          ...userParams(displayName),
          sk: `AI#${new Date().toISOString()}#${nanoid(8)}`,
        },
      },
      {
        Put: guardParams('DISPLAY_NAME', displayName),
      },
    ],
  };
}

function userParams(displayName) {
  const minStartingCash = 100_00; // cents
  const maxStartingCash = 5000_00; // cents
  const startingCash = getRandomInt(minStartingCash, maxStartingCash);
  return {
    TableName: MAIN_TABLE_NAME,
    Item: {
      pk: 'USER',
      displayName,
      // stocks: await createStartingStocks(),
      stocks: {},
      totalCash: startingCash,
      cashOnHand: startingCash,
    },
  };
}

function guardParams(prefix, value) {
  return {
    TableName: MAIN_TABLE_NAME,
    ConditionExpression: 'attribute_not_exists(pk)',
    Item: {
      pk: `${prefix}#${value}`,
      sk: value,
    },
  };
}

// const getRandomIntZeroToX = (x) => randomInt(0, x)();

function getRandomInt(min, max) {
  return randomInt(min, max)();
}

// const getRandomValueArray = (arr) =>
//   arr instanceof Array && arr[getRandomIntZeroToX(arr.length)];

// const getRandomFloat = (min, max) => randomUniform(min, max)();

// const generateRandomBoolean = (probability = 0.5) =>
//   probability > randomUniform(0, 1)();
