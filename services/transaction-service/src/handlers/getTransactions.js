import { DynamoDB } from 'aws-sdk';
import {
  commonMiddlewareWithValidator,
  createStatusAndCreatedIndexParams,
  statuses,
} from 'libs';

const { TRANSACTIONS_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();
const requestSchema = {
  properties: {
    queryStringParameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'string',
          pattern: '^\\d+$',
        },
        compareTime: {
          type: 'string',
        },
        compareTimeOperator: {
          type: 'string',
        },
        orderAsc: {
          type: 'string',
          patten: 'true|false',
        },
      },
    },
  },
};
const validationOptions = { inputSchema: requestSchema };

export async function getTransactions(event) {
  const { queryStringParameters } = event;
  console.log({ queryStringParameters });

  const indexParams = {
    tableName: TRANSACTIONS_TABLE_NAME,
    status: statuses.created,
    ...queryStringParameters,
  };

  const { Items } = await dynamoDb
    .query(createStatusAndCreatedIndexParams(indexParams))
    .promise();

  return Items;
}

export const handler = commonMiddlewareWithValidator(
  getTransactions,
  validationOptions
);
