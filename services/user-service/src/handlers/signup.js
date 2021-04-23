import { CognitoIdentityServiceProvider } from 'aws-sdk';
// import createHttpError from 'http-errors';
import { commonMiddlewareWithValidator, successResponseCors } from 'libs';
import { v4 as uuid } from 'uuid';
import { emailPattern } from 'libs/regexUtils';
import { addNewUserToDynamo } from '../utils/usersTableUtils';

const { COGNITO_GENERIC_USER_POOL_ID } = process.env;
const cognito = new CognitoIdentityServiceProvider();
const schema = {
  properties: {
    body: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          pattern: emailPattern,
        },
        username: {
          type: 'string',
          minLength: 5,
          maxLength: 36,
          pattern: '^\\S*$',
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

    const newUser = await addNewUserToDynamo({ email, displayName: username });

    const createUserRes = await cognito
      .adminCreateUser(createCognitoUserParams({ ...body, id: newUser.pk }))
      .promise();

    // Do not send all data to frontend
    return successResponseCors({
      accountStatus: createUserRes?.User?.UserStatus,
      email,
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddlewareWithValidator(signup, validationOptions);

function createCognitoUserParams(data) {
  return {
    UserPoolId: COGNITO_GENERIC_USER_POOL_ID,
    Username: uuid(),
    TemporaryPassword: 'NewpasS!23',
    UserAttributes: [
      { Name: 'preferred_username', Value: data.username },
      { Name: 'email', Value: data.email },
      {
        // This is probably not the best practice in the real world
        // By doing this we are assuming the email is valid and that
        // the new user has access to the email address
        Name: 'email_verified',
        Value: 'true',
      },
      {
        Name: 'custom:userId',
        Value: data.id, // id from create fn call
      },
    ],
    DesiredDeliveryMediums: ['EMAIL'],
    MessageAction: 'SUPPRESS',
  };
}
