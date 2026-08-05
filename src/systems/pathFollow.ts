import { Vector3 } from "three";
import type { World } from "../core/World";
import type { PathData } from "../core/Path";
import { pushEvent } from "../core/Event";
import { markDestroyed } from "../setup/destroy";
import { TRACK_END_T } from "../constants";
import { samplePath } from "../utils/path";

/** Produces (via destroy.ts / core/Event.ts): destroy tag, pawn-resolved. */
export function pathFollowSystem(world: World, dt: number) {
  for (const [entity, follower] of world.pathFollowers) {
    if (follower.done) continue;

    const path = world.paths.get(follower.pathId);
    if (!path) continue;

    follower.t += (follower.speed * dt) / path.total;

    if (follower.t >= TRACK_END_T) {
      follower.t = TRACK_END_T;
      follower.done = true;
      markDestroyed(world, entity);
      pushEvent(world, { type: "pawn-resolved", entity, depleted: false });
    }

    const pos = world.positions.get(entity);
    if (!pos) continue;

    pos.copy(samplePath(path, follower.t));
  }
}
