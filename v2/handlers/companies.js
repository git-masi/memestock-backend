import { commonMiddleware } from '../utils/middleware';
import { apiResponse, HttpError, httpMethods } from '../utils/http';
import { validCompaniesHttpEvent } from '../schema/companies';
import { getCompanies } from '../db/companies';

export const handler = commonMiddleware(lambdaForCompanies);

async function lambdaForCompanies(event) {
  try {
    if (!validCompaniesHttpEvent(event)) throw HttpError.BadRequest();
    const result = await route(event);
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
    case httpMethods.GET:
      return getCompaniesFromHttpEvent(event);

    case httpMethods.POST:
      return createCompanyFromHttpEvent(event);

    default:
      throw HttpError.BadRequest();
  }
}

function getCompaniesFromHttpEvent(event) {
  return getCompanies();
}
