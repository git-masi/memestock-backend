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
    console.log('signup ', body);
    console.log('newUser ', newUser);

    const createUserRes = await cognito
      .adminCreateUser(createCognitoUserParams({ ...body, id: newUser.pk }))
      .promise();

    // Do not send all data to frontend
    return successResponseCors({
      accountStatus: createUserRes?.User?.UserStatus,
      email,
    });
  } catch (error) {
    console.log('signup error: ', JSON.stringify(error, null, 4));
    if (error.message.includes('ConditionalCheckFailed') && error.statusCode === 400) {
      // A sample error was:
      // error:  {
      //   "message": "Transaction cancelled, please refer cancellation reasons for specific reasons [None, ConditionalCheckFailed, ConditionalCheckFailed]",
      //     "code": "TransactionCanceledException",
      //     "time": "2021-05-05T02:45:04.820Z",
      //     "requestId": "J0OB94Q3AAF6D8EJOGJVD98JIBVV4KQNSO5AEMVJF66Q9ASUAAJG",
      //     "statusCode": 400,
      //     "retryable": false,
      //     "retryDelay": 20.500838186105806
      // }
      // Transaction cancelled, please refer cancellation reasons for specific reasons [None, ConditionalCheckFailed, ConditionalCheckFailed]
      // means that the user already exists
      error.originalmessage = error.message;
      error.message = 'MemeStock-E0001: UserAlreadyExists';
      error.statusCode = 409; // Conflict
      console.log('Return error: ', JSON.stringify(error, null, 4));
    }
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
