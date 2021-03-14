import { commonMiddleware, successResponse } from 'libs';

async function createAiProfile(event, context) {
  try {
    return successResponse({ message: 'AI Profile created!' });
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddleware(createAiProfile);
