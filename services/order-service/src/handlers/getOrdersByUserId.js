import { DynamoDB } from 'aws-sdk';
import {
  commonMiddlewareWithValidator,
  convertStringBoolean,
  statuses,
  successResponse,
} from 'libs';

const { ORDERS_TABLE_NAME, GSI_USER_ID_AND_CREATED } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();
const requestSchema = {
  properties: {
    queryStringParameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          pattern: Object.values(statuses).join('|'),
        },
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
        orderType: {
          type: 'string',
          pattern: '^(buy|sell)$',
        },
      },
    },
    pathParameters: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          format: 'uuid',
        },
      },
      required: ['userId'],
    },
  },
};
const validationOptions = { inputSchema: requestSchema };

async function getOrdersByUserId(event) {
  const { pathParameters, queryStringParameters } = event;
  console.log({ pathParameters, queryStringParameters });

  const { status, orderType } = queryStringParameters;

  const params = createIndexParams({ pathParameters, queryStringParameters });

  const { Items } = await dynamoDb.query(params).promise();

  if (status && orderType) {
    return successResponse(
      Items.filter((i) => i.status === status && i.orderType === orderType)
    );
  }

  if (status) {
    return successResponse(Items.filter((i) => i.status === status));
  }

  if (orderType) {
    return successResponse(Items.filter((i) => i.orderType === orderType));
  }

  return successResponse(Items);
}

export const handler = commonMiddlewareWithValidator(
  getOrdersByUserId,
  validationOptions
);

function createIndexParams(args) {
  const { pathParameters, queryStringParameters } = args;
  const { userId } = pathParameters;
  const {
    orderAsc = true,
    compareTime = new Date().toISOString(),
    compareTimeOperator = '<=',
    limit,
  } = queryStringParameters;

  const params = {
    TableName: ORDERS_TABLE_NAME,
    IndexName: GSI_USER_ID_AND_CREATED,
    KeyConditionExpression: `#userId = :userId AND #created ${compareTimeOperator} :now`,
    ExpressionAttributeNames: {
      '#userId': 'userId',
      '#created': 'created',
    },
    ExpressionAttributeValues: {
      ':userId': userId,
      ':now': compareTime,
    },
    ScanIndexForward:
      typeof orderAsc === 'string' ? convertStringBoolean(orderAsc) : orderAsc,
  };

  if (limit) params.Limit = limit;

  return params;
}
