// Modules
// import createHttpError from 'http-errors';

// Utils
// import { generateRandomBoolean } from '../utils/generateRandom';

// Libs
import { commonMiddleware, successResponse } from 'libs';

// function throwError() {
//   throw new createHttpError.BadRequest('Oops you made a mistake');
// }

async function hello(event, context) {
  try {
    // if (generateRandomBoolean()) throwError();

    return successResponse({ message: 'Hello from the test lambda!' });
  } catch (error) {
    // console.log(error);
    throw error;
  }
}

export const handler = commonMiddleware(hello);
