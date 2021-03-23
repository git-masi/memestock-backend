import { DynamoDB } from 'aws-sdk';
import { v4 as uuid } from 'uuid';
import {
  commonMiddleware,
  successResponse,
  getRandomIntZeroToX,
  getRandomValueFromArray,
} from 'libs';
import { companies } from '../utils/companies';

const dynamoDB = new DynamoDB.DocumentClient();

async function createUser(event, context) {
  console.log(process.env.USERS_TABLE_NAME);
  try {
    const now = new Date().toISOString();
    const numSelection = getRandomIntZeroToX(companies.length);
    const stocks = getStocks(numSelection, companies);
    // const cashOnHand = 50000 - (total value of owned stocks)

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
  
}
