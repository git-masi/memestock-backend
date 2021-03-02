import { commonMiddleware } from '../../../libs/commonMiddleware';
import { successResponse } from '../../../libs/successResponse';

async function createAiProfile(event, context) {
  try {
    return successResponse({ message: 'AI Profile created!' });
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddleware(createAiProfile);
