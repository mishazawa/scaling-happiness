import type { World } from "../core/World";

/**
 * Sole writer of `world.events`'s length. Must run last in the schedule —
 * every other system that reads events for the frame has to run first.
 */
export function clearEventsSystem(world: World): void {
  world.events.length = 0;
}
