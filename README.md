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
