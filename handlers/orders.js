import {
  apiResponse,
  HttpError,
  httpMethods,
  methodRouter,
  pathRouter,
} from '../utils/http';
import { commonMiddleware } from '../utils/middleware';
import {
  createOrder,
  fulfillOrder,
  getCountOfOrders,
  getOrder,
  getOrders,
  getRecentUserOrders,
} from '../db/orders';
import { isEmpty } from '../utils/dataChecks';
import { orderStatuses } from '../schema/orders';
import { createRegexGroup } from '../utils/regex';
import { getItems } from '../db/shared';
import { getUser } from '../db/users';
import { pkPrefixes, stripPk } from '../schema/pkPrefixes';

export const handler = commonMiddleware(ordersLambda);

async function ordersLambda(event) {
  const methodRoutes = {
    [httpMethods.GET]: handleGetMethods,
    [httpMethods.POST]: handlePostMethods,
    [httpMethods.PUT]: handlePutMethods,
  };
  const router = methodRouter(methodRoutes);

  try {
    const result = await router(event);

    if (isEmpty(result)) return apiResponse({ cors: true });

    return apiResponse({ body: result, cors: true });
  } catch (error) {
    console.info(error);

    if (error instanceof HttpError)
      return apiResponse({ ...error, cors: true });

    return apiResponse({
      statusCode: 500,
      cors: true,
    });
  }
}

function handleGetMethods(event) {
  const paths = {
    '/orders': handleGetOrders,
    '/orders/history': handleHistory,
    '/orders/feed': handleOrdersFeed,
    [`/orders/count/${createRegexGroup(orderStatuses)}`]: handleCount,
  };
  const router = pathRouter(paths);

  return router(event);

  async function handleGetOrders(event) {
    const { queryStringParameters } = event;
    const dbResults = await getOrders(parseQueryParams(queryStringParameters));

    return getItems(dbResults);
  }

  async function handleHistory(event) {
    const { principalId: userSk } = event.requestContext.authorizer;

    const userOrders = getItems(
      await getRecentUserOrders(`${pkPrefixes.user}#${userSk}`)
    );

    if (!userOrders) return [];

    const orderResults = await Promise.all(
      userOrders.map((uo) => getOrder(stripPk(uo.orderPkSk)))
    );

    return orderResults.map((res) => getItems(res));
  }

  // todo: refactor
  async function handleOrdersFeed(event) {
    const { queryStringParameters } = event;
    const orders = getItems(
      await getOrders(parseQueryParams(queryStringParameters))
    );
    const uniqueUsers = orders.reduce((acc, order) => {
      const { buyer, seller, originatingUser } = order;

      if (!(buyer in acc)) acc[buyer] = true;

      if (!(seller in acc)) acc[seller] = true;

      if (!(originatingUser in acc)) acc[originatingUser] = true;

      return acc;
    }, {});
    const userDbPromises = Object.keys(uniqueUsers).map((userPkSk) =>
      getUser(stripPk(userPkSk))
    );
    const userDbsResults = await Promise.all(userDbPromises);
    const userItems = userDbsResults.map((res) => getItems(res));

    for (const item of userItems) {
      uniqueUsers[`${item.pk}#${item.sk}`] = item;
    }

    return orders.map((order) => {
      order.buyerDisplayName = uniqueUsers[order.buyer].displayName;
      order.sellerDisplayName = uniqueUsers[order.seller].displayName;
      order.originatingUserDisplayName =
        uniqueUsers[order.originatingUser].displayName;
      return order;
    });
  }

  async function handleCount(event) {
    const {
      pathParameters: { orderStatus },
    } = event;

    return { count: await countAllOrdersInStatus() };

    async function countAllOrdersInStatus(total = 0) {
      const { Count, LastEvaluatedKey } = await getCountOfOrders(orderStatus);

      if (LastEvaluatedKey) {
        return await countAllOrdersInStatus(total + Count);
      }

      return total + Count;
    }
  }
}

function handlePostMethods(event) {
  const paths = {
    '/orders': handleCreateOrder,
  };
  const router = pathRouter(paths);
  const result = router(event);

  return result;

  function handleCreateOrder(event) {
    const { body } = event;
    return createOrder(body);
  }
}

function handlePutMethods(event) {
  const paths = {
    '/orders': handleFulfillOrder,
  };
  const router = pathRouter(paths);
  const result = router(event);

  return result;

  function handleFulfillOrder(event) {
    const { body } = event;
    return fulfillOrder(body.order, body.user);
  }
}

function parseQueryParams(queryStringParameters) {
  return Object.entries(queryStringParameters).reduce((acc, [key, value]) => {
    switch (key) {
      case 'limit':
        acc[key] = +value;
        break;

      case 'asc':
        acc[key] = value !== 'false';
        break;
        break;

      case 'startSk':
        acc[key] = decodeURIComponent(value);
        break;

      default:
        acc[key] = value;
        break;
    }

    return acc;
  }, {});
}
