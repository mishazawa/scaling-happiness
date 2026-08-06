import type { Entity } from "../core/Entity";
import type { Grid } from "../core/Grid";
import type { PathData } from "../core/Path";
import {
  axisYawFromDirection,
  stepAngle,
  yawFromDirection,
} from "../core/Rotation";
import { hasTag } from "../core/Tag";
import type { World } from "../core/World";
import { samplePathDirection } from "../utils/path";

/**
 * Turns entities toward the direction they should be facing, and moves them
 * there at their own rate rather than snapping.
 *
 * A pawn faces one of two things, and which one is a one-way door:
 *
 * 1. Before its first shot, the track — the tangent under it, so it swims the
 *    way it is travelling and leans through the corners.
 * 2. From its first shot on ("aiming", set by `shootingSystem`), the field. The
 *    heading is recomputed every frame from where the pawn now stands, snapped
 *    to a major axis, so it keeps facing the grid as it rounds a corner onto a
 *    new side instead of holding the angle the old side happened to need.
 *
 * Reads `pathFollowers`, `rotations` and the "aiming" tag; writes only
 * `rotations`. Must run after `shootingSystem` (which sets the tag) and before
 * `renderSystem` (which draws the yaw), so a turn is never a frame stale.
 */
export function facingSystem(world: World, grid: Grid, dt: number): void {
  for (const [entity, rotation] of world.rotations) {
    // A dying pawn's yaw belongs to its death spin (a rotation tween, ticked by
    // timerSystem); stepping it toward a heading here would cancel the spin out.
    if (hasTag(world, entity, "dying")) continue;

    if (hasTag(world, entity, "aiming")) {
      const position = world.positions.get(entity);
      if (position) {
        rotation.target = axisYawFromDirection(
          grid.center.x - position.x,
          grid.center.z - position.z,
          rotation.target,
        );
      }
    } else {
      const follower = world.pathFollowers.get(entity);
      const path = follower && world.paths.get(follower.pathId);

      if (follower && !follower.done && path) {
        const direction = samplePathDirection(path, follower.t);
        rotation.target = yawFromDirection(
          direction.x,
          direction.z,
          rotation.target,
        );
      }
    }

    rotation.yaw = stepAngle(
      rotation.yaw,
      rotation.target,
      rotation.turnSpeed * dt,
    );
  }
}

/**
 * Points an entity along the track at fraction `t` with no turn in between.
 *
 * Used when a pawn joins the path: it arrives from its queue facing whichever
 * way it sat there, and easing into the track direction from that would read as
 * a stumble at the entry point rather than a turn.
 */
export function snapToPathDirection(
  world: World,
  entity: Entity,
  path: PathData,
  t: number,
): void {
  const rotation = world.rotations.get(entity);
  if (!rotation) return;

  const direction = samplePathDirection(path, t);
  rotation.target = yawFromDirection(direction.x, direction.z, rotation.yaw);
  rotation.yaw = rotation.target;
}
