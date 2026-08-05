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
import { TRACK_END_T, TRACK_START_T } from "../constants";

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

  return Path(trackPoints);
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
