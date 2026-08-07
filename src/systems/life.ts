import { pushEvent, readEvents } from "../core/Event";
import type { World } from "../core/World";

/** Sole writer of `world.lifes`. */
function applyLifeDelta(world: World, delta: number): void {
  world.lifes = Math.max(0, world.lifes + delta);
}

/**
 * Owns `world.lifes`.
 * Reads: pawn-spawned (delta -1), pawn-resolved (delta +1 when depleted).
 * Emits: life-changed.
 */
export function lifeSystem(world: World): void {
  let delta = 0;

  for (const _event of readEvents(world, "pawn-spawned")) {
    delta -= 1;
  }

  for (const event of readEvents(world, "pawn-resolved")) {
    if (event.depleted) delta += 1;
  }

  if (delta === 0) return;

  // The count clamps at zero, so what was asked for and what happened can
  // differ — spending the last two lifes in one frame only costs one. The event
  // reports the applied change, since that is what anything showing the count
  // has to agree with.
  const before = world.lifes;
  applyLifeDelta(world, delta);
  const applied = world.lifes - before;

  if (applied !== 0) pushEvent(world, { type: "life-changed", delta: applied });
}
