import type { Entity } from "../core/Entity";
import { addTag } from "../core/Tag";
import type { World } from "../core/World";

/**
 * Sole writer of the "destroy" tag. Every current caller (pathFollowSystem,
 * shootingSystem) runs before garbageCollectionSystem in the schedule, so
 * marking happens directly rather than through an event — there's nothing
 * to defer to a later frame.
 */
export function markDestroyed(world: World, entity: Entity): void {
  addTag(world, entity, "destroy");
}
