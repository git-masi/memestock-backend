import { v4 as uuid } from 'uuid';
import { statuses } from './statuses';

export function createAttributesForStatusAndCreatedQuery() {
  return {
    id: uuid(),
    created: new Date().toISOString(),
    status: statuses.created,
  };
}
