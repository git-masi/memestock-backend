import { apiResponse, HttpError, httpMethods } from '../utils/http';
import { commonMiddleware } from '../utils/middleware';
import { validUsersHttpEvent, userTypes } from './schema/users';

export const handler = commonMiddleware(lambdaForUsers);

async function lambdaForUsers(event) {
  try {
    if (!validUsersHttpEvent(event)) throw HttpError.BadRequest();
    await route(event);
    return apiResponse();
  } catch (error) {
    console.info(error);

    if (error instanceof HttpError) return apiResponse({ ...error });

    return apiResponse({
      statusCode: 500,
    });
  }
}

function route(event) {
  switch (event.httpMethod) {
    case httpMethods.GET:
      return getUserFromHttpEvent(event);

    case httpMethods.POST:
      return createUserFromHttpEvent(event);

    default:
      throw HttpError.BadRequest();
  }
}

async function getUserFromHttpEvent(event) {
  return { id: 1, username: 'bob' };
}

function createUserFromHttpEvent(event) {
  const {
    body: { displayName, email },
  } = event;

  return createUser({
    displayName,
    email,
    type: userTypes.human,
  });
}
