import { Scene, Vector3 } from "three";
import {
  NUMBER_OF_QUEUES,
  QUEUE_INITIAL_SIZE,
  QUEUE_OFFSET,
  QUEUE_POSITION,
  QUEUE_SPACING,
} from "../constants";
import type { World } from "../core/World";
import { spawnQueue, spawnQueuedPawn } from "../setup/queue";

export function createQueues(world: World, scene: Scene) {
  for (let x = 0; x < NUMBER_OF_QUEUES; x++) {
    const queueId = spawnQueue(
      world,
      new Vector3(...QUEUE_POSITION).setX(x * QUEUE_SPACING + QUEUE_OFFSET),
    );
    for (let i = 0; i < QUEUE_INITIAL_SIZE; i++) {
      spawnQueuedPawn(world, scene, queueId);
    }
  }
}
