export type Entity = number;

let nextEntityId = 0;

export const createEntity = (): Entity => nextEntityId++;
