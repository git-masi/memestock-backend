// Modules
import { DynamoDB } from 'aws-sdk';
import { v4 as uuid } from 'uuid';

// Libs
import { commonMiddlewareWithValidator, successResponse } from 'libs';

const { COMPANIES_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();
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
    const { name, tickerSymbol, description, pricePerShare } = body;
    const params = {
      TransactItems: [
        {
          Put: {
            TableName: COMPANIES_TABLE_NAME,
            ConditionExpression: 'attribute_not_exists(pk)',
            Item: {
              pk: uuid(),
              name,
              tickerSymbol,
              description,
              pricePerShare,
            },
          },
        },
        {
          Put: {
            TableName: COMPANIES_TABLE_NAME,
            ConditionExpression: 'attribute_not_exists(pk)',
            Item: {
              pk: `companyName#${name}`,
            },
          },
        },
        {
          Put: {
            TableName: COMPANIES_TABLE_NAME,
            ConditionExpression: 'attribute_not_exists(pk)',
            Item: {
              pk: `tickerSymbol#${name}`,
            },
          },
        },
      ],
    };
    await dynamoDb.transactWrite(params).promise();
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
