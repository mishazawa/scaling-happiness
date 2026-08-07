import type { Scene } from "three";
import {
  LIFE_PEARL_DURATION,
  LIFE_PEARL_END_SCALE,
  LIFE_PEARL_RISE_SPEED,
  LIFE_PEARL_SCALE,
} from "../constants";
import type { Entity } from "../core/Entity";
import { PositionTween, ScalarTween } from "../core/Tween";
import type { World } from "../core/World";
import type { LifePearlSource } from "./pearl";
import { createMeshEntity } from "./meshEntity";

/** Which way round the animation runs — a life spent, or a life handed back. */
export type LifeChange = "spent" | "refunded";

/** How far the pearl travels: a speed over the animation's duration, as a death's rise is. */
export const LIFE_PEARL_TRAVEL = LIFE_PEARL_RISE_SPEED * LIFE_PEARL_DURATION;

/**
 * Spawns one pearl playing out a change to the life count, and leaves it to its
 * tweens — `timerSystem` ticks them and `lifePearlSystem` tears the entity down
 * when the scale tween, the animation's clock, finishes.
 *
 * The two directions are the same three tweens read backwards:
 *
 *  - "spent" — out of the shell, rising, spinning, shrinking to nothing.
 *  - "refunded" — in from above, falling and counter-spinning, growing from
 *    nothing back to full size.
 *
 * A refund lands on `anchor` itself rather than short of it. There it is a copy
 * of the standing bead, concentric with it and (`LIFE_PEARL_SCALE` being under
 * 1) strictly smaller, so the bead hides it exactly when it is removed — the
 * disappearance costs nothing to hide and needs no distance tuned by eye.
 *
 * Shadows are off, as on projectiles: the pearl is small, brief, and spends the
 * animation in the air above the shell where a cast shadow would only flicker
 * across the track.
 */
export function spawnLifePearl(
  world: World,
  scene: Scene,
  source: LifePearlSource,
  change: LifeChange,
): Entity {
  const spent = change === "spent";

  const start = source.anchor.clone();
  const end = source.anchor.clone();
  if (spent) end.y += LIFE_PEARL_TRAVEL;
  else start.y += LIFE_PEARL_TRAVEL;

  const entity = createMeshEntity(
    world,
    scene,
    "life-pearl",
    source.geometry,
    source.material,
    start,
    { shadows: false },
  );

  const from = LIFE_PEARL_SCALE;
  const to = LIFE_PEARL_END_SCALE;

  world.scales.set(entity, from);
  world.scaleTweens.set(
    entity,
    ScalarTween(from, to, LIFE_PEARL_DURATION, "easeOutQuad"),
  );

  world.positionTweens.set(
    entity,
    PositionTween(start, end, LIFE_PEARL_DURATION, "easeInOutQuad"),
  );

  return entity;
}
