import { DynamoDB } from 'aws-sdk';
import {
  commonMiddlewareWithValidator,
  createStatusAndCreatedIndexParams,
  statuses,
  successResponseCors,
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
        exclusiveStartKey: {
          type: 'string',
          format: 'uuid',
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
  const { exclusiveStartKey, compareTime } = queryStringParameters;

  const indexParams = createStatusAndCreatedIndexParams({
    tableName: TRANSACTIONS_TABLE_NAME,
    status: statuses.created,
    ...queryStringParameters,
  });

  if (exclusiveStartKey) {
    indexParams.ExclusiveStartKey = {
      id: exclusiveStartKey,
      status: statuses.created,
      created: compareTime,
    };
  }

  const { Items } = await dynamoDb.query(indexParams).promise();

  return successResponseCors(Items);
}

export const handler = commonMiddlewareWithValidator(
  getTransactions,
  validationOptions
);
