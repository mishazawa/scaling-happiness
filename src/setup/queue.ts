import { Vector3 } from "three";
import { QUEUE_DIRECTION, QUEUE_SPACING } from "../constants";
import { createEntity, type Entity } from "../core/Entity";
import { Position } from "../core/Position";
import { addTag, removeTag } from "../core/Tag";
import { dequeue, enqueue, type QueueId } from "../core/Queue";
import type { World } from "../core/World";

const DIRECTION = new Vector3(...QUEUE_DIRECTION);

export function spawnQueue(world: World, position: Vector3): QueueId {
  const entity = createEntity();

  world.positions.set(entity, Position(position.x, position.y, position.z));
  world.queues.set(entity, []);

  return entity;
}

function layoutQueue(world: World, queueId: QueueId): void {
  const members = world.queues.get(queueId);
  const base = world.positions.get(queueId);
  if (!members || !base) return;

  members.forEach((member, index) => {
    const pos = world.positions.get(member);
    if (!pos) return;

    pos.copy(base).addScaledVector(DIRECTION, QUEUE_SPACING * index);
  });
}

export function addPawnToQueue(world: World, queueId: QueueId, pawn: Entity): void {
  enqueue(world, queueId, pawn);
  addTag(world, pawn, "queued");
  layoutQueue(world, queueId);
}

export function releasePawnFromQueue(world: World, queueId: QueueId): Entity | undefined {
  const pawn = dequeue(world, queueId);
  if (pawn === undefined) return undefined;

  removeTag(world, pawn, "queued");
  layoutQueue(world, queueId);

  return pawn;
}
