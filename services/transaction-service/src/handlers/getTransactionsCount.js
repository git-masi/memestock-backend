import { DynamoDB } from 'aws-sdk';
import createHttpError from 'http-errors';
import {
  commonMiddleware,
  getUserIdFromEvent,
  successResponseCors,
} from 'libs';

const { TRANSACTIONS_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

export async function getTransactions(event) {
  try {
    const userId = getUserIdFromEvent(event);

    if (!userId) throw createHttpError.BadRequest('Could not get count');

    const params = {
      TableName: TRANSACTIONS_TABLE_NAME,
      Select: 'COUNT',
      FilterExpression: '#buyer.#pk = :userId OR #seller.#pk = :userId',
      ExpressionAttributeNames: {
        '#buyer': 'buyer',
        '#seller': 'seller',
        '#pk': 'pk',
      },
      ExpressionAttributeValues: { ':userId': userId },
    };

    const { Count: count } = await dynamoDb.scan(params).promise();
    console.log(count);

    return successResponseCors({ count });
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddleware(getTransactions);
