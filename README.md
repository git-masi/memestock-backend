## Create A New Service From template-service

- Go to the root folder of the project
- Run the following command in your terminal `serverless create --template-path ./services/template-service --path NEW_SERVICE_PATH_HERE --name NEW_SERVICE_NAME_HERE`
- Navigate to your new service folder and run `npm i`

Example for NEW_SERVICE_PATH_HERE: ./services/company-service
Example for NEW_SERVICE_NAME_HERE: company-service

## Install all service dependencies

`npm run install:services`

## Install all dependencies

`npm run install:all`

## Redeploy a lambda in any service

- Go to the root folder of the project
- Run the following command `node deployFn.js LAMBDA_NAME AWS_NAMED_PROFILE DEPLOYMENT_ENV`

Note that the named profile and the deployment env are optional. You probably won't use the env in this project.

This script assumes an EXACT MATCH between the lambda name and the file name that contains the code for that lambda.
