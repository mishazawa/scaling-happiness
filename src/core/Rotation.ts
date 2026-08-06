import { MODEL_FORWARD_YAW_OFFSET, PAWN_TURN_SPEED } from "../constants";

/**
 * Which way an entity faces, as a single yaw angle about world +Y.
 *
 * Only yaw, deliberately: the palette shader's breathing deformation lifts the
 * model along *object* +Y before `instanceMatrix` applies (see
 * `render/materials.ts`), and yaw is the one rotation that leaves that lift
 * pointing up. Pitch or roll here would tilt the breath with the model.
 *
 * `yaw` is what gets drawn, `target` is what it is turning toward — the two are
 * separate so a turn takes time (`turnSpeed`, rad/s) instead of snapping.
 *
 * What sets `target` lives outside this component: `facingSystem` picks between
 * the track and the field depending on whether the pawn has fired yet.
 */
export type RotationData = {
  yaw: number;
  target: number;
  turnSpeed: number;
};

export const Rotation = (
  yaw: number = 0,
  turnSpeed: number = PAWN_TURN_SPEED,
): RotationData => ({
  yaw,
  target: yaw,
  turnSpeed,
});

/**
 * Heading of a direction on the XZ plane, in the convention the models are
 * authored in — `MODEL_FORWARD_YAW_OFFSET` absorbs whichever local axis the
 * mesh actually swims down, so every caller here speaks in world headings.
 *
 * A zero-length direction has no heading; callers pass the previous yaw as
 * `fallback` rather than getting an arbitrary 0 (which would spin a stationary
 * pawn to face +Z).
 */
export function yawFromDirection(
  x: number,
  z: number,
  fallback: number = 0,
): number {
  if (x === 0 && z === 0) return fallback;
  return Math.atan2(x, z) + MODEL_FORWARD_YAW_OFFSET;
}

/**
 * Heading of a direction's *dominant* axis — one of the four cardinals, never
 * anything between them.
 *
 * A pawn facing the field squares up to it rather than tracking whichever block
 * it happens to be shooting: the blocks in a lane sit a fraction of a cell apart
 * in the cross-axis, and following that exactly reads as jitter, not aim. Ties
 * (a perfect diagonal) resolve to z, arbitrarily but consistently.
 */
export function axisYawFromDirection(
  x: number,
  z: number,
  fallback: number = 0,
): number {
  if (x === 0 && z === 0) return fallback;
  return Math.abs(x) > Math.abs(z)
    ? yawFromDirection(Math.sign(x), 0, fallback)
    : yawFromDirection(0, Math.sign(z), fallback);
}

/** Wraps an angle into (-π, π]. */
export function normalizeAngle(angle: number): number {
  const wrapped = ((angle + Math.PI) % (Math.PI * 2)) - Math.PI;
  return wrapped <= -Math.PI ? wrapped + Math.PI * 2 : wrapped;
}

/** Signed shortest way round from `from` to `to`, in (-π, π]. */
export function shortestAngleDelta(from: number, to: number): number {
  return normalizeAngle(to - from);
}

/**
 * Moves `current` at most `maxDelta` radians toward `target`, the short way
 * round. Turning the short way is what keeps a pawn crossing the ±π seam (the
 * track's -Z side) from unwinding a full circle to get there.
 */
export function stepAngle(
  current: number,
  target: number,
  maxDelta: number,
): number {
  const delta = shortestAngleDelta(current, target);
  if (maxDelta <= 0) return normalizeAngle(current);
  if (Math.abs(delta) <= maxDelta) return normalizeAngle(target);
  return normalizeAngle(current + Math.sign(delta) * maxDelta);
}
