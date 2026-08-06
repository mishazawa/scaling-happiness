import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  Vector3,
  type Scene,
} from "three";
import type { Entity } from "../core/Entity";
import { createEntity } from "../core/Entity";
import { Path, type PathData } from "../core/Path";
import type { World } from "../core/World";
import { addRenderable } from "../systems/render";
import type { Grid } from "../setup/grid";
import {
  TRACK_CORNER_RADIUS,
  TRACK_CORNER_SEGMENTS,
  TRACK_END_T,
  TRACK_START_T,
} from "../constants";

/**
 * Locates the point at fraction `t` around the *closed* perimeter defined by
 * `points` (wrapping from the last point back to the first), along with the
 * index of the segment it falls on. Used only at track-generation time, to
 * slice an open track out of the grid's closed boundary loop.
 */
function locateOnClosedPerimeter(
  points: Vector3[],
  segLengths: number[],
  total: number,
  t: number,
): { point: Vector3; segmentIndex: number } {
  let distance = Math.min(Math.max(t, 0), 1) * total;

  for (let i = 0; i < segLengths.length; i++) {
    const segLength = segLengths[i];
    const isLastSegment = i === segLengths.length - 1;

    if (distance <= segLength || isLastSegment) {
      const start = points[i];
      const end = points[(i + 1) % points.length];
      const alpha = segLength > 0 ? Math.min(distance / segLength, 1) : 0;
      return { point: start.clone().lerp(end, alpha), segmentIndex: i };
    }

    distance -= segLength;
  }

  return { point: points[0].clone(), segmentIndex: 0 };
}

function closedPerimeterMetrics(points: Vector3[]): {
  segLengths: number[];
  total: number;
} {
  const segLengths: number[] = [];
  let total = 0;

  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    const length = points[i].distanceTo(next);
    segLengths.push(length);
    total += length;
  }

  return { segLengths, total };
}

/**
 * Cuts the open track segment spanning fractions `startT`..`endT` out of a
 * closed perimeter (any interior corners between the two cut points are kept,
 * so the track still bends around the grid).
 */
function sliceTrack(
  points: Vector3[],
  segLengths: number[],
  total: number,
  startT: number,
  endT: number,
): Vector3[] {
  const start = locateOnClosedPerimeter(points, segLengths, total, startT);
  const end = locateOnClosedPerimeter(points, segLengths, total, endT);

  const track: Vector3[] = [start.point];
  for (let i = start.segmentIndex + 1; i <= end.segmentIndex; i++) {
    track.push(points[i].clone());
  }
  track.push(end.point);

  return track;
}

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
 * The track is an open path, not the full loop around the grid: it's cut out
 * of the grid's closed boundary at TRACK_START_T..TRACK_END_T, so pawns
 * enter and exit partway along a side rather than walking the whole
 * perimeter back to their starting corner.
 */
export function makePathAroundTheGrid(grid: Grid, padding: number): PathData {
  const { columns, rows, cellSize, center } = grid;

  const halfWidth = (columns * cellSize) / 2 + padding;
  const halfDepth = (rows * cellSize) / 2 + padding;

  const perimeter = [
    new Vector3(center.x - halfWidth, center.y, center.z - halfDepth),
    new Vector3(center.x + halfWidth, center.y, center.z - halfDepth),
    new Vector3(center.x + halfWidth, center.y, center.z + halfDepth),
    new Vector3(center.x - halfWidth, center.y, center.z + halfDepth),
  ].reverse();

  const { segLengths, total } = closedPerimeterMetrics(perimeter);
  const trackPoints = sliceTrack(
    perimeter,
    segLengths,
    total,
    TRACK_START_T,
    TRACK_END_T,
  );

  // Rounding runs after the slice, so TRACK_START_T/TRACK_END_T still cut the
  // sharp perimeter and the entry/exit points stay exactly where they were.
  return Path(
    roundCorners(trackPoints, TRACK_CORNER_RADIUS, TRACK_CORNER_SEGMENTS),
  );
}

export function DEBUG_pathVisualizer(
  world: World,
  path: PathData,
  scene: Scene,
  colorStart: string = "#ff00ff",
  colorEnd: string = "#00ffff",
): Entity {
  const geometry = new BufferGeometry().setFromPoints(path.points);

  const c1 = new Color(colorStart);
  const c2 = new Color(colorEnd);
  const colors: number[] = [];

  path.points.forEach((_, i) => {
    const t = i / (path.points.length - 1);
    const c = c1.clone().lerp(c2, t);
    colors.push(c.r, c.g, c.b);
  });

  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));

  const material = new LineBasicMaterial({ vertexColors: true });
  const line = new Line(geometry, material);

  const entity = createEntity();
  addRenderable(world, scene, entity, line);

  return entity;
}

const _tempVec = new Vector3();

export function samplePath(path: PathData, t: number): Vector3 {
  const { points, segLengths, total } = path;

  if (points.length === 0) return _tempVec.set(0, 0, 0);
  if (points.length === 1) return _tempVec.copy(points[0]);

  let distance = Math.min(Math.max(t, 0), 1) * total;

  for (let i = 0; i < segLengths.length; i++) {
    const segLength = segLengths[i];
    const isLastSegment = i === segLengths.length - 1;

    if (distance <= segLength || isLastSegment) {
      const start = points[i];
      const end = points[i + 1];
      const alpha = segLength > 0 ? Math.min(distance / segLength, 1) : 0;
      return _tempVec.copy(start).lerp(end, alpha);
    }

    distance -= segLength;
  }

  return _tempVec.copy(points[points.length - 1]);
}
