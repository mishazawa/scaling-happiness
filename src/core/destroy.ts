import type { Entity } from "./Entity";
import { addTag } from "./Tag";
import type { World } from "./World";

/**
 * Sole writer of the "destroy" tag. Every current caller (destructionSystem
 * for resolved projectiles and their target blocks, deathSystem for pawns that
 * have finished dying) runs before garbageCollectionSystem in the schedule, so
 * marking happens directly rather than through an event — there's nothing to
 * defer to a later frame.
 */
export function markDestroyed(world: World, entity: Entity): void {
  addTag(world, entity, "destroy");
}
