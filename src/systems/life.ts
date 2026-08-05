import { readEvents } from "../core/Event";
import type { World } from "../core/World";

/** Sole writer of `world.lifes`. */
function applyLifeDelta(world: World, delta: number): void {
  world.lifes = Math.max(0, world.lifes + delta);
}

/**
 * Owns `world.lifes`.
 * Reads: pawn-spawned (delta -1), pawn-resolved (delta +1 when depleted).
 */
export function lifeSystem(world: World): void {
  let delta = 0;

  for (const _event of readEvents(world, "pawn-spawned")) {
    delta -= 1;
  }

  for (const event of readEvents(world, "pawn-resolved")) {
    if (event.depleted) delta += 1;
  }

  if (delta !== 0) applyLifeDelta(world, delta);
}
