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
  easing: keyof typeof Easing;
};

export const PositionTween = (
  from: Vector3,
  to: Vector3,
  duration: number,
  easing: keyof typeof Easing,
): PositionTweenData => ({
  from: from.clone(),
  to: to.clone(),
  elapsed: 0,
  duration,
  easing,
});

const _tempVec = new Vector3();

export function samplePositionTween(tween: PositionTweenData): Vector3 {
  const t = progress(tween);
  const easedT = Easing[tween.easing](t);

  return _tempVec.copy(tween.from).lerp(tween.to, easedT);
}

export type EasingFunction = (t: number) => number;

// A collection of common easing functions.
// You can add more (like Elastic, Bounce, etc.) as needed.
const Easing = {
  linear: (t: number) => t,

  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,

  easeInSine: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: (t: number) => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
};

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
  easing: keyof typeof Easing;
};

export const ScalarTween = (
  from: number,
  to: number,
  duration: number,
  easing: keyof typeof Easing,
): ScalarTweenData => ({ from, to, elapsed: 0, duration, easing });

export function sampleScalarTween(tween: ScalarTweenData): number {
  const t = progress(tween);
  const easedT = Easing[tween.easing](t);
  return tween.from + (tween.to - tween.from) * easedT;
}

/** Clamped 0..1 position through a tween. A zero duration is already over. */
function progress(tween: { elapsed: number; duration: number }): number {
  return tween.duration <= 0 ? 1 : Math.min(tween.elapsed / tween.duration, 1);
}
