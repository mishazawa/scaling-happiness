import { getEntitiesByTag } from "../core/Tag";
import type { World } from "../core/World";

/**
 * Owns `world.status`. Once terminal, stays terminal — call after
 * garbageCollectionSystem so `world.blocks` and `world.pathFollowers`
 * reflect this frame's destructions.
 */
export function gameStatusSystem(world: World): void {
  if (world.status !== "playing") return;

  if (world.blocks.size === 0) {
    world.status = "won";
    return;
  }

  // A projectile still in flight can clear the last block once it lands —
  // don't call the game lost while one is pending.
  if (
    world.lifes === 0 &&
    world.pathFollowers.size === 0 &&
    getEntitiesByTag(world, "projectile").size === 0
  ) {
    world.status = "lost";
  }
}
