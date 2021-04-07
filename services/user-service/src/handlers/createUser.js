import {
  commonMiddlewareWithValidator,
  emailPattern,
  successResponse,
} from 'libs';
import { addNewUserToDynamo } from '../utils/usersTableUtils';

const requestSchema = {
  properties: {
    body: {
      type: 'object',
      properties: {
        displayName: {
          type: 'string',
          minLength: 5,
          maxLength: 36,
          pattern: '^\\S*$',
        },
        email: {
          type: 'string',
          pattern: emailPattern,
        },
      },
      required: ['displayName', 'email'],
    },
    required: ['body'],
  },
};
const validationOptions = { inputSchema: requestSchema };

async function createUser(event, context) {
  try {
    const { body } = event;
    const result = addNewUserToDynamo(body);
    return successResponse(result);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddlewareWithValidator(
  createUser,
  validationOptions
);
