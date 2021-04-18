// Modules
import { DynamoDB } from 'aws-sdk';

// Libs
import {
  commonMiddlewareWithValidator,
  successResponse,
  createAttributesForStatusAndCreatedQuery,
} from 'libs';

// Utils

const { TRANSACTIONS_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();
const requestSchema = {
  properties: {
    body: {
      type: 'object',
      properties: {
        total: {
          type: 'integer',
          min: 1,
        },
        stock: {
          type: 'object',
        },
        quantity: {
          type: 'integer',
          min: 1,
        },
        message: {
          type: 'string',
        },
        buyer: {
          type: 'object',
        },
        seller: {
          type: 'object',
        },
      },
      required: ['total', 'stock', 'quantity', 'message', 'buyer', 'seller'],
    },
    required: { body: true },
  },
};
const validationOptions = { inputSchema: requestSchema };

async function createTransaction(event, context) {
  try {
    const { body } = event;
    // todo: close corresponding order
    const transaction = createTransactionAttributes(body);
    const params = {
      TableName: TRANSACTIONS_TABLE_NAME,
      Item: transaction,
    };

    await dynamoDb.put(params).promise();

    return successResponse(transaction);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddlewareWithValidator(
  createTransaction,
  validationOptions
);

function createTransactionAttributes(body) {
  return {
    ...createAttributesForStatusAndCreatedQuery(),
    ...body,
  };
}
