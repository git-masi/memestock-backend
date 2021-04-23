import { CognitoIdentityServiceProvider } from 'aws-sdk';
import { commonMiddlewareWithValidator, successResponseCors } from 'libs';

const { COGNITO_GENERIC_USER_CLIENT_ID } = process.env;
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

    const initAuthRes = await cognito
      .initiateAuth(createInitAuthParams(body))
      .promise();

    if (initAuthRes?.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      const newPasswordRes = await setNewPassword({
        ...initAuthRes,
        ...body,
      });

      return successResponseCors(newPasswordRes?.AuthenticationResult);
    }

    return successResponseCors(initAuthRes?.AuthenticationResult);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddlewareWithValidator(login, validationOptions);

function createInitAuthParams(data) {
  return {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: COGNITO_GENERIC_USER_CLIENT_ID,
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
      ClientId: COGNITO_GENERIC_USER_CLIENT_ID,
      ChallengeResponses: {
        NEW_PASSWORD: newPassword,
        USERNAME: username,
      },
    })
    .promise();
}
