import { apiResponse, HttpError, httpMethods } from '../utils/http';
import { commonMiddleware } from '../utils/middleware';
// import { validOrdersHttpEvent } from '../schema/orders';
import { createOrder } from '../db/orders';
import { isEmpty } from '../utils/dataChecks';

export const handler = commonMiddleware(lambdaForOrders);

async function lambdaForOrders(event) {
  try {
    // if (!validOrdersHttpEvent(event)) throw HttpError.BadRequest();
    const result = await route(event);
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

function route(event) {
  switch (event.httpMethod) {
    case httpMethods.POST:
      return createOrderFromHttpEvent(event);

    default:
      throw HttpError.BadRequest();
  }
}

function createOrderFromHttpEvent(event) {
  const { body } = event;
  return createOrder(body);
}
