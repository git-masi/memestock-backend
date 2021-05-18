import { DynamoDB } from 'aws-sdk';
import { randomInt } from 'd3-random';
import { nanoid } from 'nanoid';
import { apiResponse, HttpError, httpMethods } from '../utils/http';
import { commonMiddleware } from '../utils/middleware';
import { validRequestFor } from './usersSchema';

const { MAIN_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

export const handler = commonMiddleware(lambdaForUsers);

const userTypes = Object.freeze({
  human: 'HUMAN',
  ai: 'AI',
});

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

function createUserFrom(anEvent) {
  const {
    body: { displayName, email },
  } = anEvent;

  const transaction = userParamsFrom({
    displayName,
    email,
    type: userTypes.human,
  });

  return dynamoDb.transactWrite(transaction).promise();
}

function userParamsFrom(aUserConfig) {
  const { displayName, email, type } = aUserConfig;
  let result;

  switch (type) {
    case userTypes.human:
      result = humanUserFrom(displayName, email);
      break;

    case userTypes.ai:
      result = aiUserFrom(displayName, email);
      break;

    default:
      result = {};
      break;
  }

  return result;
}

function humanUserFrom(aDisplayName, anEmail) {
  return {
    TransactItems: [
      {
        Put: {
          ...userParams(),
          sk: `HUMAN#${new Date().toISOString()}#${nanoid(8)}`,
          email: anEmail,
        },
      },
      {
        Put: guardParamsFrom('DISPLAY_NAME', aDisplayName),
      },
      {
        Put: guardParamsFrom('EMAIL', anEmail),
      },
    ],
  };
}

function aiUserFrom(aDisplayName, anEmail) {
  return {
    TransactItems: [
      {
        Put: {
          ...userParams(),
          sk: `AI#${new Date().toISOString()}#${nanoid(8)}`,
        },
      },
      {
        Put: guardParamsFrom('DISPLAY_NAME', aDisplayName),
      },
    ],
  };
}

function userParams() {
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

function guardParamsFrom(aPrefix, aValue) {
  return {
    TableName: MAIN_TABLE_NAME,
    ConditionExpression: 'attribute_not_exists(pk)',
    Item: {
      pk: `${aPrefix}#${aValue}`,
      sk: aValue,
    },
  };
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
