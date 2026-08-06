import { Vector3, type Scene } from "three";
import {
  NUMBER_OF_QUEUES,
  QUEUE_COLUMN_SPACING,
  QUEUE_DIRECTION,
  QUEUE_INITIAL_SIZE,
  QUEUE_OFFSET,
  QUEUE_POSITION,
  QUEUE_SPACING,
} from "../constants";
import { createEntity, type Entity } from "../core/Entity";
import { Position } from "../core/Position";
import { addTag, removeTag } from "../core/Tag";
import { dequeue, enqueue, type QueueId } from "../core/Queue";
import type { World } from "../core/World";
import { randomPawnColor, spawnPawn } from "./pawn";

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

export function addPawnToQueue(
  world: World,
  queueId: QueueId,
  pawn: Entity,
): void {
  enqueue(world, queueId, pawn);
  addTag(world, pawn, "queued");
  layoutQueue(world, queueId);
}

export function releasePawnFromQueue(
  world: World,
  queueId: QueueId,
): Entity | undefined {
  const pawn = dequeue(world, queueId);
  if (pawn === undefined) return undefined;

  removeTag(world, pawn, "queued");
  layoutQueue(world, queueId);

  return pawn;
}

export function spawnQueuedPawn(
  world: World,
  scene: Scene,
  queueId: QueueId,
): Entity {
  const position = world.positions.get(queueId) ?? new Vector3();

  const pawn = spawnPawn(world, scene, {
    color: randomPawnColor(),
    position,
  });

  addPawnToQueue(world, queueId, pawn);

  return pawn;
}

/** Builds every queue and fills it to its initial size. */
export function createQueues(world: World, scene: Scene) {
  for (let x = 0; x < NUMBER_OF_QUEUES; x++) {
    const queueId = spawnQueue(
      world,
      new Vector3(...QUEUE_POSITION).setX(
        x * QUEUE_COLUMN_SPACING + QUEUE_OFFSET,
      ),
    );
    for (let i = 0; i < QUEUE_INITIAL_SIZE; i++) {
      spawnQueuedPawn(world, scene, queueId);
    }
  }
}
