import type { Entity } from "./Entity";
import type { World } from "./World";

export type QueueId = Entity;
export type QueueData = Entity[];

export const Queue = (): QueueData => [];

export function enqueue(world: World, queueId: QueueId, entity: Entity): void {
  const members = world.queues.get(queueId) ?? Queue();
  members.push(entity);
  world.queues.set(queueId, members);
  world.queueMembership.set(entity, queueId);
}

export function dequeue(world: World, queueId: QueueId): Entity | undefined {
  const members = world.queues.get(queueId);
  if (!members || members.length === 0) return undefined;

  const entity = members.shift()!;
  world.queueMembership.delete(entity);
  return entity;
}

export function getQueueId(world: World, entity: Entity): QueueId | undefined {
  return world.queueMembership.get(entity);
}
