import { Vector3 } from "three";
import type { PathData } from "../core/Path";

/** Quadratic Bézier point at `t`, with `control` as the (sharp) corner. */
function quadraticAt(
  start: Vector3,
  control: Vector3,
  end: Vector3,
  t: number,
): Vector3 {
  const u = 1 - t;
  return new Vector3(
    u * u * start.x + 2 * u * t * control.x + t * t * end.x,
    u * u * start.y + 2 * u * t * control.y + t * t * end.y,
    u * u * start.z + 2 * u * t * control.z + t * t * end.z,
  );
}

/**
 * Replaces every *interior* vertex with a short arc, turning hard corners into
 * fillets. The endpoints are left exactly where they were (pawns are spawned
 * onto `points[0]` and resolved at the last point), and the arcs are sampled
 * once here rather than in the frame loop — `Path()` re-measures the resulting
 * chords, so followers keep moving at a constant arc-length speed.
 *
 * The arcs are quadratic Béziers, not true circular fillets: sampling them at
 * a uniform parameter isn't uniform in arc length, but since the chord lengths
 * are what drive `samplePath`, the pawn's speed stays correct either way.
 */
export function roundCorners(
  points: Vector3[],
  radius: number,
  segments: number,
): Vector3[] {
  if (radius <= 0 || segments <= 0 || points.length < 3) return points;

  const rounded: Vector3[] = [points[0].clone()];

  for (let i = 1; i < points.length - 1; i++) {
    const corner = points[i];
    const toPrev = points[i - 1].clone().sub(corner);
    const toNext = points[i + 1].clone().sub(corner);
    const prevLength = toPrev.length();
    const nextLength = toNext.length();

    if (prevLength === 0 || nextLength === 0) {
      rounded.push(corner.clone());
      continue;
    }

    // Never eat more than half of either neighbouring segment, so adjacent
    // corners can't overlap however short the segments get.
    const r = Math.min(radius, prevLength / 2, nextLength / 2);

    const start = corner
      .clone()
      .addScaledVector(toPrev.divideScalar(prevLength), r);
    const end = corner
      .clone()
      .addScaledVector(toNext.divideScalar(nextLength), r);

    for (let s = 0; s <= segments; s++) {
      rounded.push(quadraticAt(start, corner, end, s / segments));
    }
  }

  rounded.push(points[points.length - 1].clone());

  return rounded;
}

/**
 * Walks `segLengths` to find which segment fraction `t` lands on, and how far
 * along it. Purely scalar — the caller looks up the points and interpolates,
 * which is what lets the open and closed walks share this despite differing in
 * wrap semantics and in whether they may return a shared vector.
 */
export function locateSegment(
  segLengths: number[],
  total: number,
  t: number,
): { index: number; alpha: number } {
  let distance = Math.min(Math.max(t, 0), 1) * total;

  for (let i = 0; i < segLengths.length; i++) {
    const segLength = segLengths[i];
    const isLastSegment = i === segLengths.length - 1;

    if (distance <= segLength || isLastSegment) {
      return {
        index: i,
        alpha: segLength > 0 ? Math.min(distance / segLength, 1) : 0,
      };
    }

    distance -= segLength;
  }

  return { index: 0, alpha: 0 };
}

const _tempVec = new Vector3();

/**
 * Samples an *open* path at fraction `t`.
 *
 * Returns a shared temporary — the result is invalidated by the next call, so
 * copy it if you need to hold on to it.
 */
export function samplePath(path: PathData, t: number): Vector3 {
  const { points, segLengths, total } = path;

  if (points.length === 0) return _tempVec.set(0, 0, 0);
  if (points.length === 1) return _tempVec.copy(points[0]);
  if (segLengths.length === 0) return _tempVec.copy(points[points.length - 1]);

  const { index, alpha } = locateSegment(segLengths, total, t);

  return _tempVec.copy(points[index]).lerp(points[index + 1], alpha);
}

const _tempDir = new Vector3();

/**
 * Direction of travel at fraction `t` — the unit tangent of the segment `t`
 * lands on, not a smoothed one. That is deliberate: the corners have already
 * been subdivided into `TRACK_CORNER_SEGMENTS` chords by `roundCorners`, so the
 * tangent steps round a corner in small increments, and whoever follows it
 * (`facingSystem`) rate-limits its turn anyway.
 *
 * Returns a shared temporary, on its own vector so a caller may hold a
 * `samplePath` result and a direction at the same time. Zero-length when the
 * path has no segment to speak of.
 */
export function samplePathDirection(path: PathData, t: number): Vector3 {
  const { points, segLengths, total } = path;

  if (points.length < 2 || segLengths.length === 0)
    return _tempDir.set(0, 0, 0);

  const { index } = locateSegment(segLengths, total, t);
  _tempDir.copy(points[index + 1]).sub(points[index]);

  return _tempDir.lengthSq() > 0 ? _tempDir.normalize() : _tempDir;
}
