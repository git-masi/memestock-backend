// Modules
// import { DynamoDB } from 'aws-sdk';

// Libs
import { commonMiddlewareWithValidator, successResponse } from 'libs';

// const dynamoDb = new DynamoDB.DocumentClient();
const requestSchema = {
  properties: {
    body: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          minLength: 1,
        },
        tickerSymbol: {
          type: 'string',
          minLength: 1,
        },
        description: {
          type: 'string',
          minLength: 1,
        },
        pricePerShare: {
          type: 'integer',
          minimum: 1,
        },
      },
    },
    required: { body: true },
  },
};
const validationOptions = { inputSchema: requestSchema };

async function createCompany(event) {
  try {
    const { body } = event;
    return successResponse(body);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddlewareWithValidator(
  createCompany,
  validationOptions
);
