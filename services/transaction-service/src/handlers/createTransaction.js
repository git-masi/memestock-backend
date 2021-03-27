// Modules

// Utils

// Libs
import { commonMiddleware, successResponse } from 'libs';

async function createTransaction(event, context) {
  try {
    return successResponse({ message: 'Hello from the test lambda!' });
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddleware(createTransaction);
