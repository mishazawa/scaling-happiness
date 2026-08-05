import { Raycaster, Vector2, type Camera, type Scene } from "three";
import type { Entity } from "../core/Entity";
import { PathFollower } from "../core/Path";
import { getQueueId, type QueueId } from "../core/Queue";
import { hasTag } from "../core/Tag";
import type { World } from "../core/World";
import { releasePawnFromQueue, spawnQueuedPawn } from "../setup/queue";

const raycaster = new Raycaster();
const pointer = new Vector2();

export function handlePointerClick(
  world: World,
  scene: Scene,
  camera: Camera,
  domElement: HTMLElement,
  event: PointerEvent,
  pathEntity: Entity,
  pawnSpeed: number,
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

    const released = releasePawnFromQueue(world, queueId);
    if (released !== undefined) {
      world.pathFollowers.set(released, PathFollower(pathEntity, pawnSpeed));
      spawnQueuedPawn(world, scene, queueId);
    }

    return;
  }
}
