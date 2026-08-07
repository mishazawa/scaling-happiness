import { Mesh, Vector3, type Object3D, type Texture } from "three";
import { Path, type PathData } from "../core/Path";
import { registerMesh } from "../render/modelRegistry";
import { trackMovingMaterial, trackStaticMaterial } from "../render/materials";
import { locateSegment, roundCorners } from "../utils/path";
import { uvBand, uvLengthU } from "../utils/geometry";
import {
  TRACK_CHECKPOINTS,
  TRACK_CORNER_RADIUS,
  TRACK_CORNER_SEGMENTS,
  TRACK_END_T,
  TRACK_MOVING_PART,
  TRACK_START_T,
  TRACK_STATIC_COLOR,
  TRACK_STATIC_PART,
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
  const { index, alpha } = locateSegment(segLengths, total, t);

  // Wraps: on a closed perimeter the last segment runs back to points[0].
  const start = points[index];
  const end = points[(index + 1) % points.length];

  return { point: start.clone().lerp(end, alpha), segmentIndex: index };
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
 * of the closed loop through TRACK_CHECKPOINTS at TRACK_START_T..TRACK_END_T,
 * so pawns enter and exit partway along a side rather than walking the whole
 * perimeter back to their starting corner.
 *
 * The corners themselves are authored in `constants.ts`; this only shapes them.
 */
export function makePathAroundTheGrid(): PathData {
  const perimeter = TRACK_CHECKPOINTS.map(([x, y, z]) => new Vector3(x, y, z));

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

/**
 * Registers the imported track as a plain, un-instanced mesh, and returns it
 * ready to be added to the scene.
 *
 * The track is scenery, not an entity: it exists once, never moves, and is drawn
 * straight from the loaded scene graph at the origin. That is also why it stays
 * out of the ECS — a world rebuild on restart would take it with it, and there
 * is no per-frame state to rebuild.
 *
 * Its geometry is *not* normalized or merged. The mesh was swept along the very
 * path `makePathAroundTheGrid` builds, in game coordinates, so it only lands on
 * the pawns' line at its authored scale; and its two halves need two materials,
 * which a single merged geometry could not carry:
 *
 *   - `Static` — the rails, a flat colour off a palette row.
 *   - `Moving` — the belt, wearing `arrow` and scrolling it at pawn speed off
 *     the clock the fish animate on.
 *
 * Both of the belt material's geometry-dependent numbers are measured here
 * rather than assumed: the uv band it occupies (the export gives each half a
 * slice of one shared layout, and the belt's is a strip a few percent tall) and
 * the world length one unit of `u` covers, which is what turns a pawn's speed
 * into a scroll rate.
 *
 * Both halves are asserted present: a rename in Blender would otherwise show up
 * as a track that silently kept the exporter's grey.
 */
export function makeTrack(root: Object3D, arrow: Texture): Object3D {
  const parts = new Set<string>();

  const track = registerMesh("track", root, (name, mesh: Mesh) => {
    parts.add(name);
    if (name === TRACK_STATIC_PART)
      return trackStaticMaterial(TRACK_STATIC_COLOR);
    if (name === TRACK_MOVING_PART)
      return trackMovingMaterial(
        arrow,
        uvBand(mesh.geometry),
        uvLengthU(mesh.geometry),
      );
    return null;
  });

  for (const part of [TRACK_STATIC_PART, TRACK_MOVING_PART]) {
    if (!parts.has(part))
      throw new Error(`track model is missing its "${part}" mesh`);
  }

  return track;
}
