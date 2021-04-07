import { CognitoIdentityServiceProvider } from 'aws-sdk';
import { commonMiddlewareWithValidator, successResponse } from 'libs';

// const { COGNITO_GENERIC_USER_POOL_ID } = process.env;
const cognito = new CognitoIdentityServiceProvider();
const schema = {
  properties: {
    body: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
        },
        password: {
          type: 'string',
        },
        newPassword: {
          type: 'string',
        },
      },
      required: ['username', 'password'],
    },
  },
  required: ['body'],
};
const validationOptions = { inputSchema: schema };

async function login(event, context) {
  try {
    const { body } = event;
    console.log('do stuff');

    const initAuthRes = await cognito
      .initiateAuth(createInitAuthParams(body))
      .promise();

    if (initAuthRes?.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      const newPasswordRes = await setNewPassword({
        ...initAuthRes,
        ...body,
      });

      return successResponse(newPasswordRes?.AuthenticationResult);
    }

    return successResponse(initAuthRes?.AuthenticationResult);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddlewareWithValidator(login, validationOptions);

function createInitAuthParams(data) {
  return {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: 'napreks02amb2nai1801sn9v4',
    AuthParameters: {
      USERNAME: data?.username,
      PASSWORD: data?.password,
    },
  };
}

function setNewPassword(args) {
  const { ChallengeName, Session, newPassword, username } = args;
  return cognito
    .respondToAuthChallenge({
      ChallengeName,
      Session,
      ClientId: 'napreks02amb2nai1801sn9v4',
      ChallengeResponses: {
        NEW_PASSWORD: newPassword,
        USERNAME: username,
      },
    })
    .promise();
}
