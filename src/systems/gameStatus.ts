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

  if (world.lifes === 0 && world.pathFollowers.size === 0) {
    world.status = "lost";
  }
}
