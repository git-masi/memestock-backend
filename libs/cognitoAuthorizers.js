import { CognitoIdentityServiceProvider } from 'aws-sdk';

export async function testAuthorizer(event, context, callback) {
  try {
    const { methodArn, authorizationToken } = event;

    if (!authorizationToken) throw new Error('No authorization token');

    const allowPolicy = createAllowPolicy(
      'testing123CanAnybodyHearMe',
      methodArn
    );

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
      Resource: resource,
    };

    const policyDocument = {
      Version: '2012-10-17',
      Statement: [statementOne],
    };

    authResponse.policyDocument = policyDocument;
  }

  return authResponse;
}

// This lib is not bundled correctly for some reason
// Normally we'd use optional chaining but that
// throws an error so trycatch instead
export function getUserIdFromEvent(event) {
  try {
    const user = JSON.parse(event.requestContext.authorizer.user);
    return user.UserAttributes.find(
      (attribute) => attribute.Name === 'custom:userId'
    ).Value;
  } catch (error) {
    return null;
  }
}
