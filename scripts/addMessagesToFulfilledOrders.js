const AWS = require('aws-sdk');

(async () => {
  AWS.config.region = 'us-east-1';
  const MAIN_TABLE_NAME = 'MemeStockMainTable';
  const ORDER_STATUS_AND_SK_GSI = 'orderStatusAndSk';
  const dynamoDb = new AWS.DynamoDB.DocumentClient({
    apiVersion: '2012-08-10',
  });

  try {
    const fulfilledOrders = await getFulfilledOrders();

    // console.log(fulfilledOrders.length);
    // const test = true;
    // if (test) return;

    if (fulfilledOrders.length > 0) {
      await updateDb(fulfilledOrders);
    }

    async function getFulfilledOrders(items = [], startSk = '') {
      const { Items, LastEvaluatedKey } = await getOrders(startSk);

      const result = [...items, ...Items];

      if (LastEvaluatedKey?.sk)
        return getFulfilledOrders(result, LastEvaluatedKey.sk);

      return result;
    }

    async function updateDb(orders) {
      if (orders.length > 25) {
        const batch = orders.slice(0, 25);
        await dynamoDb
          .transactWrite({ TransactItems: createTransactItems(batch) })
          .promise();

        await updateDb(orders.slice(25));
      } else {
        await dynamoDb
          .transactWrite({ TransactItems: createTransactItems(orders) })
          .promise();
      }
    }

    function createTransactItems(orders) {
      const result = orders.map(createUpdate);

      return result;

      function createUpdate(order) {
        return {
          Update: {
            TableName: MAIN_TABLE_NAME,
            Key: { pk: order.pk, sk: order.sk },
            UpdateExpression: 'SET #fulfillmentMessage = :fulfillmentMessage',
            ExpressionAttributeNames: {
              '#fulfillmentMessage': 'fulfillmentMessage',
            },
            ExpressionAttributeValues: {
              ':fulfillmentMessage': createMessage(),
            },
          },
        };
      }
    }
  } catch (error) {
    console.info(error);
  }

  function getOrders(startSk) {
    const params = {
      TableName: MAIN_TABLE_NAME,
      IndexName: ORDER_STATUS_AND_SK_GSI,
      KeyConditionExpression:
        'orderStatus = :orderStatus AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':orderStatus': 'fulfilled',
        ':sk': '2',
      },
    };

    if (startSk) {
      params.ExclusiveStartKey = {
        pk: 'ORDER',
        sk: startSk,
      };
    }

    return dynamoDb.query(params).promise();
  }

  function createMessage() {
    const emoji = ['💩', '💰', '💸', '🤑', '🚀', '💎'];
    const messages = [
      'To the moon!',
      'HODL GANG!',
      'I like the stock!',
      "Mo' money mo' problems",
    ];
    return `${messages[getRandomIndex(messages)]} ${
      emoji[getRandomIndex(emoji)]
    }`;

    function getRandomIndex(arr) {
      return Math.floor(Math.random() * arr.length);
    }
  }
})();
