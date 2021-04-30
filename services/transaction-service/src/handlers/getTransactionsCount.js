import { DynamoDB } from 'aws-sdk';
import { commonMiddleware, successResponseCors } from 'libs';

const { TRANSACTIONS_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

export async function getTransactions() {
  const params = {
    TableName: TRANSACTIONS_TABLE_NAME,
    Select: 'COUNT',
  };

  const { Count: count } = await dynamoDb.scan(params).promise();

  return successResponseCors({ count });
}

export const handler = commonMiddleware(getTransactions);
