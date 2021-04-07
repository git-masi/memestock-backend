import { CognitoIdentityServiceProvider } from 'aws-sdk';
// import createHttpError from 'http-errors';
import { commonMiddlewareWithValidator, successResponse } from 'libs';
import { v4 as uuid } from 'uuid';

const { COGNITO_GENERIC_USER_POOL_ID } = process.env;
const cognito = new CognitoIdentityServiceProvider();
const schema = {
  properties: {
    body: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
        },
        username: {
          type: 'string',
        },
      },
      required: ['email', 'username'],
    },
  },
  required: ['body'],
};
const validationOptions = { inputSchema: schema };

async function signup(event, context) {
  try {
    const { body } = event;
    const { email, username } = body;

    const params = {
      UserPoolId: COGNITO_GENERIC_USER_POOL_ID,
      Username: uuid(),
      TemporaryPassword: 'NewpasS!23',
      UserAttributes: [
        { Name: 'preferred_username', Value: username },
        { Name: 'email', Value: email },
        {
          Name: 'email_verified',
          Value: 'true',
        },
        {
          Name: 'custom:userId',
          Value: 'test-123', // id from create fn call
        },
      ],
      DesiredDeliveryMediums: ['EMAIL'],
      MessageAction: 'SUPPRESS',
    };

    const res = await cognito.adminCreateUser(params).promise();

    return successResponse(res);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddlewareWithValidator(signup, validationOptions);
