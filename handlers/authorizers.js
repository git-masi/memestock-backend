import { CognitoIdentityServiceProvider } from 'aws-sdk';

export async function testAuthorizer(event, context, callback) {
  try {
    const { methodArn, authorizationToken } = event;
    const validToken = 'testing123CanAnybodyHearMe';

    if (authorizationToken !== validToken)
      throw new Error(`Invalid token: ${authorizationToken}`);

    const allowPolicy = createAllowPolicy(validToken, methodArn);

    callback(null, allowPolicy);
  } catch (error) {
    console.log(error);
    callback('Unauthorized');
  }
}

export async function genericUserAuthorizer(event, context, callback) {
  try {
    const { methodArn, authorizationToken } = event;

    if (!authorizationToken) throw new Error('No authorization token');

    const user = await getCognitoUserByAccessToken(authorizationToken);
    const { Username } = user;
    if (!Username) throw new Error('Failed to get user from cognito');

    const allowPolicy = createAllowPolicy(Username, methodArn);

    allowPolicy.context = { user: JSON.stringify(user) };

    callback(null, allowPolicy);
  } catch (error) {
    console.log(error);
    callback('Unauthorized');
  }
}

export async function getCognitoUserByAccessToken(token) {
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider();

  const params = {
    AccessToken: token,
  };

  return cognitoIdentityServiceProvider.getUser(params).promise();
}

function createAllowPolicy(principalId, resource) {
  return createPolicy(principalId, 'Allow', resource);
}

function createPolicy(principalId, effect, resource) {
  const authResponse = { principalId };

  if (effect && resource) {
    const statementOne = {
      Action: 'execute-api:Invoke',
      Effect: effect,
      // Temp fix for caching issue
      //    https://stackoverflow.com/questions/50331588/aws-api-gateway-custom-authorizer-strange-showing-error#answer-56119016
      Resource: '*',
    };

    const policyDocument = {
      Version: '2012-10-17',
      Statement: [statementOne],
    };

    authResponse.policyDocument = policyDocument;
  }

  return authResponse;
}

export function getUserIdFromEvent(event) {
  const user = JSON.parse(event.requestContext.authorizer.user);

  const result =
    user?.UserAttributes?.find(
      (attribute) => attribute.Name === 'custom:userId'
    )?.Value ?? null;

  return result;
}
