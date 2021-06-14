import { DynamoDB } from 'aws-sdk';
import { getCompanies } from './companies';
import { validUserAttributes } from '../schema/users';
import { getItems, guardItem } from './shared';
import { getRandomInt, getRandomValueFromArray } from '../utils/dynamicValues';
import { pkPrefixes } from '../schema/pkPrefixes';

const { MAIN_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

export async function createUser(userAttributes) {
  return dynamoDb.transactWrite(await humanUser(userAttributes)).promise();
}

async function humanUser(userAttributes) {
  const { displayName, email } = userAttributes;

  const result = {
    TransactItems: [
      {
        Put: await createUserItem(userAttributes),
      },
      {
        Put: guardItem(pkPrefixes.displayName, displayName),
      },
      {
        Put: guardItem(pkPrefixes.email, email),
      },
    ],
  };

  return result;
}

export async function createUserItem(userAttributes) {
  if (!validUserAttributes(userAttributes))
    throw new Error('Invalid user attributes');

  const minStartingCash = 100_00; // cents
  const maxStartingCash = 5000_00; // cents
  const startingCash = getRandomInt(minStartingCash, maxStartingCash);

  return {
    TableName: MAIN_TABLE_NAME,
    Item: {
      pk: pkPrefixes.user,
      stocks: await createStartingStocks(minStartingCash, maxStartingCash),
      totalCash: startingCash,
      cashOnHand: startingCash,
      ...userAttributes,
    },
  };
}

async function createStartingStocks(minStartingCash, maxStartingCash) {
  const { Items: companies } = await getCompanies();
  const numStocks = getRandomInt(1, companies.length);
  const stocks = {};
  let totalStockValue = getRandomInt(minStartingCash, maxStartingCash);

  for (let i = 0; i < numStocks; i++) {
    const { tickerSymbol, pk, currentPricePerShare } =
      getRandomValueFromArray(companies);
    const valueHeld =
      i === numStocks - 1 ? totalStockValue : getRandomInt(0, totalStockValue);
    const amountHeld = Math.floor(valueHeld / currentPricePerShare);
    const quantityHeld = amountHeld > 0 ? amountHeld : 1;

    stocks[tickerSymbol] = {
      pk,
      quantityHeld,
      quantityOnHand: quantityHeld,
    };
  }

  return stocks;
}

export function getUser(sk) {
  const params = {
    TableName: MAIN_TABLE_NAME,
    Key: {
      pk: pkPrefixes.user,
      sk: sk,
    },
  };

  return dynamoDb.get(params).promise();
}

export async function removeUser(sk) {
  const user = getItems(await getUser(sk));
  console.log(user);
  const params = {
    TransactItems: [
      {
        Delete: {
          TableName: MAIN_TABLE_NAME,
          Key: {
            pk: pkPrefixes.user,
            sk,
          },
        },
      },
      {
        Delete: {
          TableName: MAIN_TABLE_NAME,
          Key: {
            pk: `${pkPrefixes.email}#${user.email}`,
            sk: user.email,
          },
        },
      },
      {
        Delete: {
          TableName: MAIN_TABLE_NAME,
          Key: {
            pk: `${pkPrefixes.displayName}#${user.displayName}`,
            sk: user.displayName,
          },
        },
      },
    ],
  };

  return dynamoDb.transactWrite(params).promise();
}
