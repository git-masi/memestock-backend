import { DynamoDB } from 'aws-sdk';
import { nanoid } from 'nanoid';
import { getCompanies } from './companies';
import { validUserConfig, userTypes } from '../schema/users';
import { guardItem } from './shared';
import { getRandomInt, getRandomValueFromArray } from '../utils/dynamicValues';

const { MAIN_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

export async function createUser(userConfig) {
  if (!validUserConfig(userConfig)) throw new Error('Invalid user config');
  return dynamoDb.transactWrite(await userTransaction(userConfig)).promise();
}

async function userTransaction(userConfig) {
  const { displayName, email, type } = userConfig;

  switch (type) {
    case userTypes.human:
      return await humanUser(displayName, email);

    case userTypes.ai:
      return await aiUser(displayName);

    default:
      return {};
  }
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
