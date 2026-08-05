import { Raycaster, Vector2, type Camera } from "three";
import type { Entity } from "../core/Entity";
import { getQueueId, type QueueId } from "../core/Queue";
import { hasTag } from "../core/Tag";
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

  for (const hit of hits) {
    const entity = hit.object.userData.entity as Entity | undefined;
    if (entity === undefined || !hasTag(world, entity, "queued")) continue;

    const queueId = getQueueId(world, entity) as QueueId | undefined;
    if (queueId === undefined) continue;

    pushEvent(world, { type: "queue-clicked", queue: queueId });
    return;
  }
}
