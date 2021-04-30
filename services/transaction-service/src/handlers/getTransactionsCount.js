import { DynamoDB } from 'aws-sdk';
import { commonMiddleware, successResponseCors } from 'libs';

const { TRANSACTIONS_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

export async function getTransactions() {
  try {
    const params = {
      TableName: TRANSACTIONS_TABLE_NAME,
      Select: 'COUNT',
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
