// Modules
import { DynamoDB } from 'aws-sdk';
import { v4 as uuid } from 'uuid';
import axios from 'axios';

import {
  getRandomValueFromArray,
  getRandomIntZeroToX,
  getRandomIntMinToMax,
} from 'libs';

const { USERS_TABLE_NAME, COMPANY_SERVICE_URL } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();
const getAllCompaniesPath = `${COMPANY_SERVICE_URL}/company/all`;
const minDollarAmountInCents = 10000; // cents
const maxDollarAmountInCents = 500000; // cents

export async function addNewUserToDynamo(data) {
  const params = await createUserAttributes(data);
  await dynamoDb.transactWrite(params).promise();
  return params.TransactItems[0].Put.Item;
}

export async function createUserAttributes(data) {
  const { displayName, email } = data;
  const startingCash = getRandomIntMinToMax(
    minDollarAmountInCents,
    maxDollarAmountInCents
  );
  return {
    TransactItems: [
      {
        Put: {
          TableName: USERS_TABLE_NAME,
          ConditionExpression: 'attribute_not_exists(pk)',
          Item: {
            pk: uuid(),
            created: new Date().toISOString(),
            displayName,
            email,
            stocks: await createStartingStocks(),
            totalCash: startingCash,
            cashOnHand: startingCash,
          },
        },
      },
      {
        Put: {
          TableName: USERS_TABLE_NAME,
          ConditionExpression: 'attribute_not_exists(pk)',
          Item: {
            pk: `displayName#${displayName}`,
          },
        },
      },
      {
        Put: {
          TableName: USERS_TABLE_NAME,
          ConditionExpression: 'attribute_not_exists(pk)',
          Item: {
            pk: `email#${email}`,
          },
        },
      },
    ],
  };
}

async function createStartingStocks() {
  const { data: companies } = await axios.get(getAllCompaniesPath);
  const numStocks = getRandomIntMinToMax(1, companies.length);
  const stocks = {};
  let totalStockValue = getRandomIntMinToMax(
    minDollarAmountInCents,
    maxDollarAmountInCents
  );

  for (let i = 0; i < numStocks; i++) {
    const { tickerSymbol, pk, pricePerShare } = getRandomValueFromArray(
      companies
    );
    const valueHeld =
      i === numStocks - 1
        ? totalStockValue
        : getRandomIntZeroToX(totalStockValue);
    const amountHeld = Math.floor(valueHeld / pricePerShare);
    const quantityHeld = amountHeld > 0 ? amountHeld : 1;

    stocks[tickerSymbol] = {
      id: pk,
      quantityHeld,
      quantityOnHand: quantityHeld,
    };
  }

  return stocks;
}
