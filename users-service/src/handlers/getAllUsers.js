//get all the users from the database

import { commonMiddleware } from '../lib/commonMiddleware';
import { successResponse } from '../lib/successResponse';

async function getAllUsers(event, context) {
  try {
    return successResponse({ message: 'You got the users' });
  } catch (error) {
    //console.log(error)
    throw error;
  }
}

export const handler = commonMiddleware(getAllUsers);
