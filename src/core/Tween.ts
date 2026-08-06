import { Vector3 } from "three";

/**
 * A position tween moves a `Vector3`-valued component from `from` to `to`
 * over `duration` seconds. Every property tween follows this same
 * `{from, to, elapsed, duration}` shape and lives in its own `world.xTweens`
 * map — never one polymorphic tween map — so each tick loop stays branch-free.
 *
 * The split is by *map*, not by type: scalar-valued tweens (scale, yaw, and
 * whatever comes next) all share `ScalarTweenData` below, because two
 * byte-identical numeric types would be duplication with no payoff. Only the
 * `Vector3` shape earns a type of its own.
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
  return _tempVec.copy(tween.from).lerp(tween.to, progress(tween));
}

/**
 * A number-valued tween, shared by every scalar property (scale, yaw). Which
 * component it drives is decided by which `world` map it sits in, not by
 * anything stored here.
 */
export type ScalarTweenData = {
  from: number;
  to: number;
  elapsed: number;
  duration: number;
};

export const ScalarTween = (
  from: number,
  to: number,
  duration: number,
): ScalarTweenData => ({ from, to, elapsed: 0, duration });

export function sampleScalarTween(tween: ScalarTweenData): number {
  const t = progress(tween);
  return tween.from + (tween.to - tween.from) * t;
}

/** Clamped 0..1 position through a tween. A zero duration is already over. */
function progress(tween: { elapsed: number; duration: number }): number {
  return tween.duration <= 0 ? 1 : Math.min(tween.elapsed / tween.duration, 1);
}
