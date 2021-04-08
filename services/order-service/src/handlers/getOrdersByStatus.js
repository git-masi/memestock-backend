import { DynamoDB } from 'aws-sdk';
import {
  commonMiddlewareWithValidator,
  createStatusAndCreatedIndexParams,
  statuses,
} from 'libs';

const { ORDERS_TABLE_NAME } = process.env;
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
    pathParameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          pattern: Object.values(statuses).join('|'),
        },
      },
      required: ['status'],
    },
  },
};
const validationOptions = { inputSchema: requestSchema };

export async function getOrdersByStatus(event) {
  const { pathParameters, queryStringParameters } = event;
  console.log({ pathParameters, queryStringParameters });

  const indexParams = {
    tableName: ORDERS_TABLE_NAME,
    status: pathParameters.status,
    ...queryStringParameters,
  };

  const { Items } = await dynamoDb
    .query(createStatusAndCreatedIndexParams(indexParams))
    .promise();

  return Items;
}

export const handler = commonMiddlewareWithValidator(
  getOrdersByStatus,
  validationOptions
);
