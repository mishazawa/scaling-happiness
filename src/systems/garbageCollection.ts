import type { Entity } from "../core/Entity";
import { clearTags, getEntitiesByTag } from "../core/Tag";
import { getQueueId } from "../core/Queue";
import type { World } from "../core/World";
import type { SystemContext } from "./context";

export function garbageCollectionSystem(world: World, ctx: SystemContext): void {
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

  world.positions.delete(entity);
  world.blocks.delete(entity);
  world.colors.delete(entity);
  world.paths.delete(entity);
  world.pathFollowers.delete(entity);
  world.lastFiredLanes.delete(entity);
  world.ammo.delete(entity);

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
