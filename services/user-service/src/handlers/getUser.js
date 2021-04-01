import createHttpError from 'http-errors';
import { commonMiddlewareWithValidator, successResponse } from 'libs';
import { DynamoDB } from 'aws-sdk';

const { USERS_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();
const schema = {
  properties: {
    queryStringParameters: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          format: 'uuid',
        },
      },
      require: ['userId'],
    },
  },
  require: ['queryStringParameters'],
};
const validationOptions = { inputSchema: schema };

async function getUser(event, context) {
  try {
    const { queryStringParameters } = event;
    const { userId } = queryStringParameters;
    if (!userId) throw createHttpError.BadRequest('Must pass a userId');

    const params = {
      TableName: USERS_TABLE_NAME,
      Key: { pk: userId },
    };

    const { Item } = await dynamoDb.get(params).promise();
    return successResponse(Item ?? {});
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddlewareWithValidator(
  getUser,
  validationOptions
);
