import { commonMiddleware } from '../utils/middleware';
import {
  apiResponse,
  HttpError,
  httpMethods,
  methodRouter,
  pathRouter,
} from '../utils/http';
import { createCompany, getCompanies } from '../db/companies';
import { isEmpty } from '../utils/dataChecks';
import { getOrders } from '../db/orders';
import { getItems } from '../db/shared';
import { orderStatuses } from '../schema/orders';

export const handler = commonMiddleware(lambdaForCompanies);

async function lambdaForCompanies(event) {
  const methodRoutes = {
    [httpMethods.GET]: handleGetMethods,
    [httpMethods.POST]: handlePostMethods,
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
    '/companies': handleRetrieveCompanies,
    '/companies/stock-price': handleStockPrice,
  };
  const router = pathRouter(paths);
  const result = router(event);

  return result;

  async function handleRetrieveCompanies() {
    return getItems(await getCompanies());
  }

  async function handleStockPrice() {
    const companies = getItems(await getCompanies());
    const orderQueryResults = await Promise.all(
      companies.map((c) =>
        getOrders({
          tickerSymbol: c.tickerSymbol,
          orderStatus: orderStatuses.fulfilled,
          asc: false,
        })
      )
    );
    const orders = orderQueryResults.map((oqr) => getItems(oqr)[0]);
    const result = companies.map((c) => {
      const recentOrder = orders.find((o) => o.tickerSymbol === c.tickerSymbol);
      if (recentOrder) {
        c.fulfillmentMessage = recentOrder.fulfillmentMessage;
      }
      return c;
    });

    return result;
  }
}

function handlePostMethods(event) {
  const paths = {
    '/companies': handleCreateCompany,
  };
  const router = pathRouter(paths);
  const result = router(event);

  return result;

  function handleCreateCompany(event) {
    return createCompany(event.body);
  }
}
