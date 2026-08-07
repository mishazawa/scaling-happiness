import { Vector3, type Scene } from "three";
import {
  LIFE_PEARL_DURATION,
  LIFE_PEARL_END_SCALE,
  LIFE_PEARL_RISE_SPEED,
  LIFE_PEARL_SCALE,
  LIFE_PEARL_SPIN_SPEED,
  PEARL_POSITION,
} from "../constants";
import type { Entity } from "../core/Entity";
import { Rotation } from "../core/Rotation";
import { PositionTween, ScalarTween } from "../core/Tween";
import type { World } from "../core/World";
import { PEARL_GEOMETRY, PEARL_MATERIAL } from "./pearl";
import { createMeshEntity } from "./meshEntity";

/** Which way round the animation runs — a life spent, or a life handed back. */
export type LifeChange = "spent" | "refunded";

/** How far the pearl travels: a speed over the animation's duration, as a death's rise is. */
export const LIFE_PEARL_TRAVEL = LIFE_PEARL_RISE_SPEED * LIFE_PEARL_DURATION;

/**
 * Where a pearl leaves from and returns to: the standing pearl's own place.
 * Read once into a vector `createMeshEntity` can copy, and never handed out —
 * every spawn clones it, so nothing can write back through it and drag the
 * standing pearl's position around behind them.
 */
const ANCHOR = new Vector3(...PEARL_POSITION);

/**
 * Spawns one pearl playing out a change to the life count, and leaves it to its
 * tweens — `timerSystem` ticks them and `lifePearlSystem` tears the entity down
 * when the scale tween, the animation's clock, finishes.
 *
 * The two directions are the same three tweens read backwards:
 *
 *  - "spent" — off the standing pearl, rising, spinning, shrinking to nothing.
 *  - "refunded" — in from above, falling and counter-spinning, growing from
 *    nothing back to full size.
 *
 * A refund lands on the anchor itself rather than short of it. There it is the
 * same sphere as the standing pearl, concentric with it and (`LIFE_PEARL_SCALE`
 * being under 1) strictly smaller, so the standing one hides it exactly when it
 * is removed — the disappearance costs nothing to hide and needs no distance
 * tuned by eye.
 *
 * Shadows are off, as on projectiles: the pearl is small, brief, and spends the
 * animation in the air where a cast shadow would only flicker across the track.
 */
export function spawnLifePearl(
  world: World,
  scene: Scene,
  change: LifeChange,
): Entity {
  const spent = change === "spent";

  const start = ANCHOR.clone();
  const end = ANCHOR.clone();
  if (spent) end.y += LIFE_PEARL_TRAVEL;
  else start.y += LIFE_PEARL_TRAVEL;

  const entity = createMeshEntity(
    world,
    scene,
    "life-pearl",
    PEARL_GEOMETRY,
    PEARL_MATERIAL,
    start,
    { shadows: false },
  );

  // Set alongside the tween, not left to it: the tween is not sampled until the
  // next timerSystem pass, and a pearl drawn at DEFAULT_SCALE for that one frame
  // would flash at twice its size.
  const from = spent ? LIFE_PEARL_SCALE : LIFE_PEARL_END_SCALE;
  const to = spent ? LIFE_PEARL_END_SCALE : LIFE_PEARL_SCALE;
  world.scales.set(entity, from);
  world.scaleTweens.set(entity, ScalarTween(from, to, LIFE_PEARL_DURATION));

  world.positionTweens.set(
    entity,
    PositionTween(start, end, LIFE_PEARL_DURATION),
  );

  const sweep = LIFE_PEARL_SPIN_SPEED * LIFE_PEARL_DURATION;
  world.rotations.set(entity, Rotation(0));
  world.rotationTweens.set(
    entity,
    ScalarTween(0, spent ? sweep : -sweep, LIFE_PEARL_DURATION),
  );

  return entity;
}
