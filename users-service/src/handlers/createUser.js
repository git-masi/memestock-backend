// CREATE
// There should be a route to create a user
// The route should accept a unique displayName (there should be a reasonable limit to the length)
// A user should be saved in the Users table
// A new UUID should be generated
// A created time should be added as an ISO string
// A randomly generated amount of starting cash should be added (there should be a reasonable min/max)
// A randomly generated number of starting stocks should be added (there should be a reasonable min/max)

import { commonMiddleware } from '../lib/commonMiddleware';

async function createUser(event, context) {
  try {

    return successResponse({ message: 'User created!' });
  } catch (error) {
    // console.log(error);
    throw error;
  }
}

export const handler = commonMiddleware(createUser);
