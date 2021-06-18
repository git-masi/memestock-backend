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

export const handler = commonMiddleware(lambdaForCompanies);

async function lambdaForCompanies(event) {
  const methodRoutes = {
    [httpMethods.GET]: handleGetMethods,
    [httpMethods.POST]: handlePostMethods,
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
    '/companies': handleRetrieveCompanies,
  };
  const router = pathRouter(paths);
  const result = router(event);

  return result;

  function handleRetrieveCompanies() {
    return getCompanies();
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
