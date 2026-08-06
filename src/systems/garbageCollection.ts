import type { Entity } from "../core/Entity";
import { clearTags, getEntitiesByTag } from "../core/Tag";
import { getQueueId } from "../core/Queue";
import type { World } from "../core/World";
import type { SystemContext } from "./context";

export function garbageCollectionSystem(
  world: World,
  ctx: SystemContext,
): void {
  const destroyed = Array.from(getEntitiesByTag(world, "destroy"));

  for (const entity of destroyed) {
    destroyEntity(world, ctx, entity);
  }
}

function destroyEntity(world: World, ctx: SystemContext, entity: Entity): void {
  const object3D = world.renderables.get(entity);
  if (object3D) {
    ctx.scene.remove(object3D);
    world.renderables.delete(entity);
  }

  // Instance slots are repacked from world.models every frame, so a stale entry
  // here is enough to keep a dead entity on screen.
  world.models.delete(entity);

  world.positions.delete(entity);
  world.blocks.delete(entity);
  world.flags.delete(entity);
  world.countdowns.delete(entity);
  world.paths.delete(entity);
  world.pathFollowers.delete(entity);
  world.lastFiredLanes.delete(entity);
  world.ammo.delete(entity);
  world.positionTweens.delete(entity);
  world.rotations.delete(entity);
  world.scales.delete(entity);
  world.scaleTweens.delete(entity);
  world.rotationTweens.delete(entity);
  world.projectileTargets.delete(entity);
  world.spawnOrigins.delete(entity);

  const queueId = getQueueId(world, entity);
  if (queueId !== undefined) {
    const members = world.queues.get(queueId);
    if (members) {
      const index = members.indexOf(entity);
      if (index !== -1) members.splice(index, 1);
    }
    world.queueMembership.delete(entity);
  }

  for (const [gridIndex, occupant] of world.gridToEntity) {
    if (occupant === entity) {
      world.gridToEntity.delete(gridIndex);
      break;
    }
  }

  clearTags(world, entity);
}
