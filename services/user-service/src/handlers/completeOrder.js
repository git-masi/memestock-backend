import { DynamoDB } from 'aws-sdk';
import cloneDeep from 'lodash.clonedeep';
import createHttpError from 'http-errors';
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
          properties: {
            quantity: {
              type: 'integer',
            },
            total: {
              type: 'integer',
            },
            orderType: {
              type: 'string',
              pattern: '^buy|sell$',
            },
            userId: {
              type: 'string',
              format: 'uuid',
            },
          },
          required: ['quantity', 'total', 'orderType', 'userId'],
        },
        user: {
          type: 'object',
          properties: {
            pk: {
              type: 'string',
              format: 'uuid',
            },
          },
          required: ['pk'],
        },
      },
      required: ['order', 'user'],
    },
  },
  required: ['body'],
};
const validationOptions = { inputSchema: requestSchema };

const test = true;

async function completeOrder(event) {
  try {
    const {
      body: { order, user },
    } = event;
    const { orderType, userId: originatingUserId } = order;
    const { pk: completingUserId } = user;

    // We have the completingUser data already but this acts as a further
    // validation to make sure the user exists
    const [originatingUserRes, completingUserRes] = await Promise.all([
      getUser(originatingUserId),
      getUser(completingUserId),
    ]);
    const { Item: originatingUser } = originatingUserRes;
    const { Item: completingUser } = completingUserRes;

    if (!originatingUser || !completingUser)
      throw createHttpError.BadRequest('Could not get users');

    console.log({ originatingUser, completingUser });

    // if (test) return successResponse();`

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

    // await dynamoDb.transactWrite(params).promise();

    return successResponse(params);
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
  return dynamoDb
    .get({
      TableName: USERS_TABLE_NAME,
      Key: { pk },
    })
    .promise();
}

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

function createBuyOrderParams(args) {
  // Guard against data mutation
  const copy = cloneDeep(args);
  const { order, originatingUser, completingUser } = copy;
  const { stocks: ogUserStocks } = originatingUser;
  const { stocks: completingUserStocks } = completingUser;
  const orderTickerSymbol = order.stock.tickerSymbol;
  const ogUserStock = ogUserStocks[orderTickerSymbol];
  const completingUserStock = completingUserStocks[orderTickerSymbol];

  const newOGUserStock = ogUserStock
    ? {
        ...ogUserStock,
        quantityHeld: ogUserStock.quantityHeld + order.quantity,
        quantityOnHand: ogUserStock.quantityOnHand + order.quantity,
      }
    : {
        id: order.stock.pk,
        quantityHeld: order.quantity,
        quantityOnHand: order.quantity,
      };
  const newCompletingUserStock = {
    ...completingUserStock,
    quantityHeld: completingUserStock.quantityHeld - order.quantity,
    quantityOnHand: completingUserStock.quantityOnHand - order.quantity,
  };
  const newOGUserCash = {
    cashOnHand: originatingUser.cashOnHand - order.total,
    totalCash: originatingUser.totalCash - order.total,
  };
  const newCompletingUserCash = {
    cashOnHand: completingUser.cashOnHand + order.total,
    totalCash: completingUser.totalCash + order.total,
  };

  const params = {
    TransactItems: [
      {
        Update: {
          TableName: USERS_TABLE_NAME,
          Key: { pk: originatingUser.pk },
          UpdateExpression:
            'SET #cashOnHand = :coh, #totalCach = :tc, #stocks.#tickerSymbol = :stocks',
          ExpressionAttributeNames: {
            '#cashOnHand': 'cashOnHand',
            '#totalCash': 'totalCash',
            '#stocks': 'stocks',
            '#tickerSymbol': orderTickerSymbol,
          },
          ExpressionAttributeValues: {
            ':coh': newOGUserCash.cashOnHand,
            ':tc': newOGUserCash.totalCash,
            ':stock': newOGUserStock,
          },
          ReturnValues: 'ALL_NEW',
        },
      },
      {
        Update: {
          TableName: USERS_TABLE_NAME,
          Key: { pk: completingUser.pk },
          UpdateExpression:
            'SET #cashOnHand = :coh, #totalCach = :tc, #stocks.#tickerSymbol = :stock',
          ExpressionAttributeNames: {
            '#cashOnHand': 'cashOnHand',
            '#totalCash': 'totalCash',
            '#stocks': 'stocks',
            '#tickerSymbol': orderTickerSymbol,
          },
          ExpressionAttributeValues: {
            ':coh': newCompletingUserCash.cashOnHand,
            ':tc': newCompletingUserCash.totalCash,
            ':stock': newCompletingUserStock,
          },
          ReturnValues: 'ALL_NEW',
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
