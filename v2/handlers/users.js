import { CognitoIdentityServiceProvider } from 'aws-sdk';
import { nanoid } from 'nanoid';
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
import { userTypes } from '../schema/users';
import { isEmpty } from '../utils/dataChecks';

const { COGNITO_GENERIC_USER_POOL_ID } = process.env;
const cognito = new CognitoIdentityServiceProvider();

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
    '/users/signup': handleSignup,
  };
  const router = pathRouter(paths);
  const result = router(event);

  return result;

  function createUserFromHttpEvent(event) {
    const { body } = event;

    return createUser(body);
  }

  async function handleSignup(event) {
    const { body } = event;
    const sk = `${userTypes.human}#${new Date().toISOString()}#${nanoid(8)}`;
    await createUser({ ...body, sk });

    const createUserRes = await cognito
      .adminCreateUser(
        createCognitoUserParams(body.displayName, body.email, sk)
      )
      .promise();

    // Do not send all data to frontend
    return {
      accountStatus: createUserRes?.User?.UserStatus,
      email: body.email,
    };
  }
}

function createCognitoUserParams(displayName, email, userSk) {
  return {
    UserPoolId: COGNITO_GENERIC_USER_POOL_ID,
    Username: nanoid(),
    TemporaryPassword: 'NewpasS!23',
    UserAttributes: [
      { Name: 'preferred_username', Value: displayName },
      { Name: 'email', Value: email },
      {
        // This is probably not the best practice in the real world
        // By doing this we are assuming the email is valid and that
        // the new user has access to the email address
        Name: 'email_verified',
        Value: 'true',
      },
      {
        Name: 'custom:userId',
        Value: userSk,
      },
    ],
    DesiredDeliveryMediums: ['EMAIL'],
    MessageAction: 'SUPPRESS',
  };
}
