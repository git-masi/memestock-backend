import { randomInt, randomUniform } from 'd3-random';

export const getRandomIntZeroToX = (x) => randomInt(0, x)();

export const getRandomIntMinToMax = (min, max) => randomInt(min, max)();

export const getRandomValueFromArray = (arr) =>
  arr instanceof Array && arr[getRandomIntZeroToX(arr.length)];

export const generateRandomBoolean = (probability = 0.5) =>
  probability > randomUniform(0, 1)();
