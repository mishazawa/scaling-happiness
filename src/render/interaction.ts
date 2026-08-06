import { Raycaster, Vector2, type Camera } from "three";
import type { Entity } from "../core/Entity";
import type { QueueId } from "../core/Queue";
import type { World } from "../core/World";
import { pushEvent } from "../core/Event";

const raycaster = new Raycaster();
const pointer = new Vector2();

export function handlePointerClick(
  world: World,
  camera: Camera,
  domElement: HTMLElement,
  event: PointerEvent,
): void {
  const rect = domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(
    Array.from(world.renderables.values()),
    false,
  );

  // The hit object is a queue's invisible pick box (see setup/queue.ts), so the
  // entity behind it *is* the queue — no member lookup needed. This means the
  // whole queue footprint is clickable, not just the pawns standing in it; an
  // empty queue still fires the event and spawnSystem no-ops on it.
  for (const hit of hits) {
    const entity = hit.object.userData.entity as Entity | undefined;
    if (entity === undefined || !world.queues.has(entity)) continue;

    pushEvent(world, { type: "queue-clicked", queue: entity as QueueId });
    return;
  }
}
