import {
  apiResponse,
  HttpError,
  httpMethods,
  methodRouter,
  pathRouter,
} from '../utils/http';
import { commonMiddleware } from '../utils/middleware';
// todo: rewrite this to validate events for a given path
// import { validUsersHttpEvent } from '../schema/users';
import { createUser } from '../db/users';
import { isEmpty } from '../utils/dataChecks';

export const handler = commonMiddleware(lambdaForUsers);

async function lambdaForUsers(event) {
  const methodRoutes = {
    [httpMethods.POST]: handlePostMethods,
  };
  const router = methodRouter(methodRoutes);

  try {
    const result = await router(event);

    if (isEmpty(result)) return apiResponse();

    return apiResponse({ body: result });
  } catch (error) {
    console.info(error);

    if (error instanceof HttpError) return apiResponse({ ...error });

    return apiResponse({
      statusCode: 500,
    });
  }
}

function handlePostMethods(event) {
  const paths = {
    '/users': createUserFromHttpEvent,
  };
  const result = pathRouter(paths)(event);

  return result;

  function createUserFromHttpEvent(event) {
    const { body } = event;
    return createUser(body);
  }
}
