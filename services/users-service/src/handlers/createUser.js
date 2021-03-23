import { DynamoDB } from 'aws-sdk';
import { v4 as uuid } from 'uuid';
import {
  commonMiddleware,
  successResponse,
  getRandomIntZeroToX,
  getRandomValueFromArray,
  getRandomValueDestructively,
} from 'libs';
import { companies } from '../utils/companies';

const dynamoDB = new DynamoDB.DocumentClient();

async function createUser(event, context) {
  console.log(process.env.USERS_TABLE_NAME);
  try {
    const now = new Date().toISOString();
    const numSelection = getRandomIntZeroToX(companies.length);
    const stocks = getStocks(numSelection, companies);
    const cashOnHand = calcCashOnHand(stocks);

    // FROM VIDEO: NECESSARY FOR ACCESSING/HANDLING USERNAME?
    // reqBody = JSON.parse(event.body);

    const user = {
      id: uuid(),
      created: now,
      assets: {
        cashOnHand: cashOnHand,
        stocks: stocks
      }
      // displayName = reqBody.displayName,
    };

    const params = {
      TableName: process.env.USERS_TABLE_NAME,
      Item: user,
    };

    await dynamoDB.put(params).promise();

    return successResponse({ message: 'User created!' });
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddleware(createUser);

function getStocks(numSelection, companies) {
  const copy = {...companies};
  for (let i = 0; i < numSelection; i++) {
    let stockByCompany = getRandomValueDestructively(copy);
    // unsure what the limit on stocks should be
    stockByCompany.numStocks = getRandomIntZeroToX(20);
    stocks.push(stockByCompany);
  }
}

function calcCashOnHand(stocks) {
  let total = 0;
  for (let stock of stocks) {
    total += (stock.numStocks * stock.pricePerShare)
  }
  let cashOnHand = (500000 - total) ? (500000 - total) : 0;
  return cashOnHand
}
