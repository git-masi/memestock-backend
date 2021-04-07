// Modules
import { DynamoDB } from 'aws-sdk';

import {
  commonMiddlewareWithValidator,
  emailPattern,
  successResponse,
} from 'libs';

const dynamoDb = new DynamoDB.DocumentClient();

const requestSchema = {
  properties: {
    body: {
      type: 'object',
      properties: {
        displayName: {
          type: 'string',
          minLength: 5,
          maxLength: 36,
          pattern: '^\\S*$',
        },
        email: {
          type: 'string',
          pattern: emailPattern,
        },
      },
    },
    required: { body: true },
  },
};
const validationOptions = { inputSchema: requestSchema };

async function createUser(event, context) {
  try {
    const { body } = event;
    const params = await createUserAttributes(body);
    await dynamoDb.transactWrite(params).promise();
    return successResponse(params.TransactItems[0].Put.Item);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddlewareWithValidator(
  createUser,
  validationOptions
);
