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

// Example
// name: 'Other, LLC',
// tickerSymbol: 'OTHR',
// description: 'Offering a wide variety of services, this organization suffers from a lack of key branding. They are acclimating to the diminishing horizons engendered by mediocrity.',
// pricePerShare: 5156
async function createCompany(event) {
  try {
    const { body } = event;
    return successResponse(body);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

// export const handler = commonMiddleware(createCompany).use(
//   validator({ inputSchema: requestSchema })
// );
export const handler = commonMiddlewareWithValidator(
  createCompany,
  validationOptions
);
