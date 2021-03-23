import { randomInt, randomUniform } from 'd3-random';

export const getRandomIntZeroToX = (x) => randomInt(0, x)();

export const getRandomValueFromArray = (arr) =>
  arr instanceof Array && arr[getRandomIntZeroToX(arr.length)];

export const getRandomValueDestructively = (arr) =>
  arr.splice(randomInt(0, arr.length), 1);

export const generateRandomBoolean = (probability = 0.5) =>
  probability > randomUniform(0, 1)();
