import { Vector3 } from "three";
import type { PathData } from "../core/Path";

export function pathFollowSystem(_world: World, dt: number) {

  for each follower:
    path = get path
  
    follower.t += (follower.speed * dt) / path.total;

    if (follower.t >= 1) -> end of path do nothing for now

    const pos = world.positions.get(follower);
    pos.copy(samplePath(path, t))

}


const _tempVec = new Vector3();

function samplePath(path: PathData, t: number) {
  // this function should lookup continious position on a path

  return _tempVec
}