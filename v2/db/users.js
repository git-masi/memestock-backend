import { DynamoDB } from 'aws-sdk';
import { nanoid } from 'nanoid';
import { getCompanies } from './companies';
import { validUserAttributes, userTypes } from '../schema/users';
import { guardItem } from './shared';
import { getRandomInt, getRandomValueFromArray } from '../utils/dynamicValues';

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
        Put: await createUserItem({
          sk: `${userTypes.human}#${new Date().toISOString()}#${nanoid(8)}`,
          ...userAttributes,
        }),
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

export async function createUserItem(userAttributes) {
  if (!validUserAttributes(userAttributes))
    throw new Error('Invalid user attributes');

  const minStartingCash = 100_00; // cents
  const maxStartingCash = 5000_00; // cents
  const startingCash = getRandomInt(minStartingCash, maxStartingCash);

  return {
    TableName: MAIN_TABLE_NAME,
    Item: {
      pk: 'USER',
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
