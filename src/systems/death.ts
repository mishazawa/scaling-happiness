import {
  PAWN_DEATH_DURATION,
  PAWN_DEATH_END_SCALE,
  PAWN_DEATH_RISE_SPEED,
  PAWN_DEATH_SPIN_SPEED,
} from "../constants";
import { markDestroyed } from "../core/destroy";
import type { Entity } from "../core/Entity";
import { readEvents } from "../core/Event";
import { DEFAULT_SCALE } from "../core/Scale";
import { addTag, hasTag } from "../core/Tag";
import { PositionTween, ScalarTween } from "../core/Tween";
import type { World } from "../core/World";

/**
 * Owns the gap between a pawn resolving and the pawn leaving the world.
 *
 * `pawn-resolved` is the single fact of a pawn's death — pushed by
 * `pathFollowSystem` (ran out of track) and `shootingSystem` (ran out of ammo).
 * Neither destroys the pawn any more; this system does, once the pawn has
 * played out its death animation. Everything in between is three tweens, which
 * `timerSystem` ticks like any other:
 *
 *  - a rise, as a position tween straight up from where the pawn died;
 *  - a spin, as a rotation tween sweeping `SPIN_SPEED * DURATION` radians;
 *  - a shrink to nothing, as a scale tween. This one is the clock: its
 *    completion event is what tears the pawn down.
 *
 * The "dying" tag is the flag the rest of the schedule reads. A dying pawn is
 * still a whole entity for another `PAWN_DEATH_DURATION` seconds — long enough
 * for the systems that steer a live pawn to fight its tweens, or to resolve it
 * a second time — so `beginDeath` closes those doors up front.
 *
 * Reads: pawn-resolved, scale-tween-complete. Produces (via destroy.ts): the
 * "destroy" tag, and the "dying" tag.
 */
export function deathSystem(world: World): void {
  for (const event of readEvents(world, "pawn-resolved")) {
    beginDeath(world, event.entity);
  }

  for (const event of readEvents(world, "scale-tween-complete")) {
    if (!hasTag(world, event.entity, "dying")) continue;
    markDestroyed(world, event.entity);
  }
}

function beginDeath(world: World, entity: Entity): void {
  // Resolving twice would start the animation over, and (from shootingSystem)
  // refund a life every frame the pawn stayed at zero ammo.
  if (hasTag(world, entity, "dying")) return;
  addTag(world, entity, "dying");

  // Stops both pathFollowSystem writing over the rise tween's positions and
  // shootingSystem firing on the pawn's behalf while it dies.
  const follower = world.pathFollowers.get(entity);
  if (follower) follower.done = true;

  world.scales.set(entity, DEFAULT_SCALE);
  world.scaleTweens.set(
    entity,
    ScalarTween(DEFAULT_SCALE, PAWN_DEATH_END_SCALE, PAWN_DEATH_DURATION),
  );

  const rotation = world.rotations.get(entity);
  if (rotation) {
    world.rotationTweens.set(
      entity,
      ScalarTween(
        rotation.yaw,
        rotation.yaw + PAWN_DEATH_SPIN_SPEED * PAWN_DEATH_DURATION,
        PAWN_DEATH_DURATION,
      ),
    );
  }

  const position = world.positions.get(entity);
  if (position) {
    const risen = position.clone();
    risen.y += PAWN_DEATH_RISE_SPEED * PAWN_DEATH_DURATION;
    world.positionTweens.set(
      entity,
      PositionTween(position, risen, PAWN_DEATH_DURATION),
    );
  }
}
