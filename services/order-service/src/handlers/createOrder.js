// Modules
import { DynamoDB } from 'aws-sdk';
import { v4 as uuid } from 'uuid';

// Libs
import { commonMiddlewareWithValidator, successResponse, statuses } from 'libs';

const { ORDERS_TABLE_NAME } = process.env;
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
        userId: {
          type: 'string',
          format: 'uuid',
        },
      },
      required: ['total', 'stock', 'quantity', 'userId'],
    },
    required: { body: true },
  },
};
const validationOptions = { inputSchema: requestSchema };

async function createTransaction(event, context) {
  try {
    const { body } = event;
    // todo: validate user exists and order can be created
    const order = createOrderAttributes(body);
    const params = {
      TableName: ORDERS_TABLE_NAME,
      Item: order,
    };

    await dynamoDb.put(params).promise();

    return successResponse(order);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddlewareWithValidator(
  createTransaction,
  validationOptions
);

function createOrderAttributes(body) {
  return {
    id: uuid(),
    status: statuses.open,
    created: new Date().toISOString(),
    ...body,
  };
}
