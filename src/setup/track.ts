import { Vector3 } from "three";
import { Path, type PathData } from "../core/Path";
import type { Grid } from "../core/Grid";
import { roundCorners } from "../utils/path";
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
 *
 * Returns a fresh Vector3 — unlike `samplePath`, `sliceTrack` holds two results
 * live at once, so this must not share a temporary.
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
