import { apiResponse, HttpError, httpMethods } from '../utils/http';
import { commonMiddleware } from '../utils/middleware';
import { validRequestFor } from './usersSchema';

export const handler = commonMiddleware(lambdaForUsers);

async function lambdaForUsers(event) {
  try {
    if (!validRequestFor(event)) throw HttpError.BadRequest();
    const result = await route(event);
    return apiResponse({ body: result });
  } catch (error) {
    console.info(error);

    if (error instanceof HttpError) return apiResponse({ ...error });

    return apiResponse({
      statusCode: 500,
    });
  }
}

function route(anEvent) {
  switch (anEvent.httpMethod) {
    case httpMethods.GET:
      return getUserFrom(anEvent);

    default:
      throw HttpError.BadRequest();
  }
}

async function getUserFrom(anEvent) {
  return { id: 1, username: 'bob' };
}
