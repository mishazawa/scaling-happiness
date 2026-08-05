import { Vector3 } from "three";

/**
 * A position tween moves a `Vector3`-valued component from `from` to `to`
 * over `duration` seconds. Future property tweens (scale, rotation,
 * opacity) should follow this same `{from, to, elapsed, duration}` shape,
 * each with its own `XTweenData`/`XTween` pair and its own `world.xTweens`
 * map — not a single polymorphic tween — so each tick loop stays branch-free.
 */
export type PositionTweenData = {
  from: Vector3;
  to: Vector3;
  elapsed: number;
  duration: number;
};

export const PositionTween = (
  from: Vector3,
  to: Vector3,
  duration: number,
): PositionTweenData => ({
  from: from.clone(),
  to: to.clone(),
  elapsed: 0,
  duration,
});

const _tempVec = new Vector3();

export function samplePositionTween(tween: PositionTweenData): Vector3 {
  const t =
    tween.duration <= 0 ? 1 : Math.min(tween.elapsed / tween.duration, 1);
  return _tempVec.copy(tween.from).lerp(tween.to, t);
}
