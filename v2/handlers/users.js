import { DynamoDB } from 'aws-sdk';
import { randomInt } from 'd3-random';
import { nanoid } from 'nanoid';
import { apiResponse, HttpError, httpMethods } from '../utils/http';
import { commonMiddleware } from '../utils/middleware';
import { getCompanies } from './companies';
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
    await route(event);
    return apiResponse();
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
      return getUserFromHttpEvent(event);

    case httpMethods.POST:
      return createUserFromHttpEvent(event);

    default:
      throw HttpError.BadRequest();
  }
}

async function getUserFromHttpEvent(event) {
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

export async function createUser(userConfig) {
  if (!validUserConfig(userConfig)) throw new Error('Invalid user config');
  return dynamoDb.transactWrite(await createTransaction(userConfig)).promise();
}

async function createTransaction(userConfig) {
  const { displayName, email, type } = userConfig;
  let result;

  switch (type) {
    case userTypes.human:
      result = await humanUser(displayName, email);
      break;

    case userTypes.ai:
      result = await aiUser(displayName);
      break;

    default:
      result = {};
      break;
  }

  return result;
}

async function humanUser(displayName, email) {
  const humanParams = {
    sk: `HUMAN#${new Date().toISOString()}#${nanoid(8)}`,
    email,
  };
  const result = {
    TransactItems: [
      {
        Put: await userItem(displayName, humanParams),
      },
      {
        Put: guardItem('DISPLAY_NAME', displayName),
      },
      {
        Put: guardItem('EMAIL', email),
      },
    ],
  };

  return result;
}

async function aiUser(displayName) {
  const aiUserParams = { sk: `AI#${new Date().toISOString()}#${nanoid(8)}` };
  const result = {
    TransactItems: [
      {
        Put: await userItem(displayName, aiUserParams),
      },
      {
        Put: guardItem('DISPLAY_NAME', displayName),
      },
    ],
  };

  return result;
}

async function userItem(displayName, extendedParams) {
  const minStartingCash = 100_00; // cents
  const maxStartingCash = 5000_00; // cents
  const startingCash = getRandomInt(minStartingCash, maxStartingCash);
  return {
    TableName: MAIN_TABLE_NAME,
    Item: {
      pk: 'USER',
      displayName,
      stocks: await createStartingStocks(minStartingCash, maxStartingCash),
      totalCash: startingCash,
      cashOnHand: startingCash,
      ...extendedParams,
    },
  };
}

async function createStartingStocks(minStartingCash, maxStartingCash) {
  const { Items: companies } = await getCompanies();
  const numStocks = getRandomInt(1, companies.length);
  const stocks = {};
  let totalStockValue = getRandomInt(minStartingCash, maxStartingCash);

  for (let i = 0; i < numStocks; i++) {
    const { tickerSymbol, pk, pricePerShare } =
      getRandomValueFromArray(companies);
    const valueHeld =
      i === numStocks - 1 ? totalStockValue : getRandomInt(0, totalStockValue);
    const amountHeld = Math.floor(valueHeld / pricePerShare);
    const quantityHeld = amountHeld > 0 ? amountHeld : 1;

    stocks[tickerSymbol] = {
      pk,
      quantityHeld,
      quantityOnHand: quantityHeld,
    };
  }

  return stocks;
}

// Used to prevent duplicate entries for an attribute
function guardItem(prefix, value) {
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

function getRandomValueFromArray(arr) {
  if (!(arr instanceof Array)) return null;
  return arr[getRandomInt(0, arr.length)];
}

// const getRandomFloat = (min, max) => randomUniform(min, max)();

// const generateRandomBoolean = (probability = 0.5) =>
//   probability > randomUniform(0, 1)();
