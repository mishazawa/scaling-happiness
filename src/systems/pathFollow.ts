import type { World } from "../core/World";
import { pushEvent } from "../core/Event";
import { samplePath } from "../utils/path";

/**
 * Produces (via core/Event.ts): pawn-resolved, when a follower runs out of
 * track. Reaching the end resolves the pawn but does not destroy it —
 * `deathSystem` owns everything from the event to the teardown.
 */
export function pathFollowSystem(world: World, dt: number) {
  for (const [entity, follower] of world.pathFollowers) {
    if (follower.done) continue;

    const path = world.paths.get(follower.pathId);
    if (!path) continue;

    follower.t += (follower.speed * dt) / path.total;

    if (follower.t >= 1) {
      follower.t = 1;
      follower.done = true;
      pushEvent(world, { type: "pawn-resolved", entity, depleted: false });
    }

    const pos = world.positions.get(entity);
    if (!pos) continue;

    pos.copy(samplePath(path, follower.t));
  }
}
