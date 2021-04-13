import { DynamoDB } from 'aws-sdk';
import { commonMiddlewareWithValidator, successResponse } from 'libs';

const { USERS_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();
const requestSchema = {
  properties: {
    body: {
      type: 'object',
      properties: {
        order: {
          type: 'object',
        },
        user: {
          type: 'object',
        },
      },
      required: ['order', 'user'],
    },
  },
  required: ['body'],
};
const validationOptions = { inputSchema: requestSchema };

// {
//   order: {
//     quantity: 50,
//     orderType: 'buy',
//     userId: 'e492ff84-a723-4429-b5f6-dfc097ddb348',
//     status: 'open',
//     total: 62400,
//     created: '2021-04-09T19:13:53.306Z',
//     stock: {
//       name: 'Ferd Motor Company',
//       description: 'We make big honkin trucks.',
//       tickerSymbol: 'FRD',
//       pk: '8dba9900-ef1c-4b48-8f5f-4f282213c4ec'
//     },
//     id: '99552ae9-a79f-490b-b3b5-2fc86c886bc2'
//   },
//   user: {
//     displayName: 'Gregg.Runolfsson',
//     stocks: { GMS: [Object], OTHR: [Object] },
//     cashOnHand: 112267,
//     created: '2021-04-08T19:17:37.949Z',
//     pk: '3a4eb03f-3b8d-4563-9751-d055505798fc',
//     email: 'Diana.Champlin@yahoo.com',
//     totalCash: 112267
//   }
// }
async function completeOrder(event) {
  try {
    const {
      body: { order, user },
    } = event;
    const { orderType, userId: originatingUserId } = order;
    const { pk: completingUserId } = user;

    const [originatingUser, completingUser] = await Promise.all(
      getUser(originatingUserId),
      getUser(completingUserId)
    );

    const params =
      orderType === 'buy'
        ? createBuyOrderParams({
            order,
            originatingUser,
            completingUser,
          })
        : createSellOrderParams({
            order,
            originatingUser,
            completingUser,
          });

    await dynamoDb.transactWrite(params).promise();

    return successResponse();
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddlewareWithValidator(
  completeOrder,
  validationOptions
);

function getUser(pk) {
  dynamoDb
    .get({
      TableName: USERS_TABLE_NAME,
      Key: { pk },
    })
    .promise();
}

function createBuyOrderParams(args) {
  const { order, originatingUser, completingUser } = args;

  const params = {
    TransactItems: [
      {
        Update: {
          TableName: USERS_TABLE_NAME,
          Key: { pk: originatingUserId },
          UpdateExpression: 'set #a = :x + :y',
          ConditionExpression: '#a < :MAX',
          ExpressionAttributeNames: { '#a': 'Sum' },
          ExpressionAttributeValues: {
            ':x': 20,
            ':y': 45,
            ':MAX': 100,
          },
        },
      },
    ],
  };

  return params;
}

function createSellOrderParams(args) {
  const { order, originatingUser, completingUser } = args;
  //
}
