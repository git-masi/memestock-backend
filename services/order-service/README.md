# Extends Codingly.io: Base Serverless Framework Template

## Run locally

To run a service locally execute the `npm start` command in your terminal. This runs Serverless Offline which is a close approximation of real API Gateway/Lambda calls. However, you should test the real Lambdas and endpoints after deploying.

Serverless Offline does not do a good job of handling WebSocket connections. Or at the very least it is less like working with the real API Gateway endpoints than HTTP(S) endpoints. Keep that in mind when developing WebSocket endpoints.

## Importing/Exporting Functions

* Use named exports/imports
* Each file in handlers/ should match one lambda in functions.yml
* Export one "handler" function from each file in handlers/
    * `export const handler = functionName;`

## lib/ vs utils/

The difference between what goes in lib and what goes in utils is subtle.

Generally speaking lib files may be larger and the functions contained within can have side effects. By contrast utils should be small and have no side effects.

For example, a function to convert a dollar amount to cents would be a util. But functions that can update a database in some standard way would go in utils.

## Original Codinly.io README:
## Codingly.io: Base Serverless Framework Template

https://codingly.io

## What's included
* Folder structure used consistently across our projects.
* [serverless-pseudo-parameters plugin](https://www.npmjs.com/package/serverless-pseudo-parameters): Allows you to take advantage of CloudFormation Pseudo Parameters.
* [serverless-bundle plugin](https://www.npmjs.com/package/serverless-pseudo-parameters): Bundler based on the serverless-webpack plugin - requires zero configuration and fully compatible with ES6/ES7 features.

## Getting started
```
sls create --name YOUR_PROJECT_NAME --template-url https://github.com/codingly-io/sls-base
cd YOUR_PROJECT_NAME
npm install
```

You are ready to go!
