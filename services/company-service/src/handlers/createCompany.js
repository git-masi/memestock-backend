// Modules
// import { DynamoDB } from 'aws-sdk';

// Libs
import { commonMiddleware, successResponse } from 'libs';

// const dynamoDb = new DynamoDB.DocumentClient();

// Example
// name: 'Other, LLC',
// tickerSymbol: 'OTHR',
// description: 'Offering a wide variety of services, this organization suffers from a lack of key branding. They are acclimating to the diminishing horizons engendered by mediocrity.',
// pricePerShare: 5156
async function createCompany(event, context) {
  try {
    const { body } = event;
    return successResponse(body);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddleware(createCompany);
