import {
  apiResponse,
  HttpError,
  httpMethods,
  methodRouter,
  pathRouter,
} from '../utils/http';
import { commonMiddleware } from '../utils/middleware';
import { createOrder, fulfillOrder } from '../db/orders';
import { isEmpty } from '../utils/dataChecks';
import { orderStatuses } from '../schema/orders';
import { createRegexGroup } from '../utils/regex';

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

    if (isEmpty(result)) return apiResponse();

    return apiResponse({ body: result });
  } catch (error) {
    console.info(error);

    if (error instanceof HttpError) return apiResponse({ ...error });

    return apiResponse({
      statusCode: 500,
    });
  }
}

function handleGetMethods(event) {
  const paths = {
    [`/orders/count/${createRegexGroup(orderStatuses)}`]: handleCount,
  };
  const router = pathRouter(paths);
  return router(event);

  function handleCount(event) {
    const { queryStringParameters, pathParameters } = event;
    return { queryStringParameters, pathParameters };
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
