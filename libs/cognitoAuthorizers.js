import { CognitoIdentityServiceProvider } from 'aws-sdk';

export async function genericUserAuthorizer(event, context) {
  try {
    const { methodArn, authorizationToken } = event;

    const user = await getCognitoUserByAccessToken(authorizationToken);
    const { Username } = user;
    if (!Username) throw new Error('Failed to get user from cognito');

    const allowPolicy = createAllowPolicy(Username, methodArn);

    allowPolicy.context = { ...allowPolicy.context, user };

    context.succeed(allowPolicy);
  } catch (error) {
    console.log(error);
    context.fail('Authorizer verification failed');
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
