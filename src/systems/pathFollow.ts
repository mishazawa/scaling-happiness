import { Vector3 } from "three";
import type { World } from "../core/World";
import type { PathData } from "../core/Path";
import { pushEvent } from "../core/Event";

export function pathFollowSystem(world: World, dt: number) {
  for (const [entity, follower] of world.pathFollowers) {
    if (follower.done) continue;

    const path = world.paths.get(follower.pathId);
    if (!path) continue;

    follower.t += (follower.speed * dt) / path.total;

    if (follower.t >= 1) {
      follower.t = 1;
      follower.done = true;
      pushEvent(world, { type: "entity-destroy", entity });
    }

    const pos = world.positions.get(entity);
    if (!pos) continue;

    pos.copy(samplePath(path, follower.t));
  }
}

const _tempVec = new Vector3();

function samplePath(path: PathData, t: number): Vector3 {
  const { points, segLengths, total } = path;

  if (points.length === 0) return _tempVec.set(0, 0, 0);
  if (points.length === 1) return _tempVec.copy(points[0]);

  let distance = Math.min(Math.max(t, 0), 1) * total;

  for (let i = 0; i < segLengths.length; i++) {
    const segLength = segLengths[i];
    const isLastSegment = i === segLengths.length - 1;

    if (distance <= segLength || isLastSegment) {
      const start = points[i];
      const end = points[(i + 1) % points.length];
      const alpha = segLength > 0 ? Math.min(distance / segLength, 1) : 0;
      return _tempVec.copy(start).lerp(end, alpha);
    }

    distance -= segLength;
  }

  return _tempVec.copy(points[0]);
}
