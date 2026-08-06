import { Mesh, Vector3, type Object3D } from "three";
import { Path, type PathData } from "../core/Path";
import { createEntity, type Entity } from "../core/Entity";
import { Model } from "../core/Model";
import { Position } from "../core/Position";
import { addTag } from "../core/Tag";
import type { World } from "../core/World";
import { tagColorSlot } from "../utils/geometry";
import { locateSegment, roundCorners } from "../utils/path";
import {
  LIGHT_PALETTE_SLOT,
  TRACK_CHECKPOINTS,
  TRACK_COLOR_SLOT,
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
 * Stamps a dummy colour slot across the imported track mesh, so it satisfies
 * `prepareGeometry`'s `_color_id` contract without being authored for the
 * palette yet — the same trick `makeBubbleMesh` plays for a procedural sphere,
 * done here by traversal because the model arrives as a loaded scene graph.
 *
 * Mutates the cached asset's geometry in place. Safe because the track is
 * registered exactly once, at startup, and nothing else reads that asset.
 *
 * The glTF holds two meshes, `TrackMoving` and `TrackStatic`; registration
 * merges them into one instanced draw. If the moving half ever has to animate
 * separately, that becomes two model ids rather than one.
 */
export function prepareTrackModel(root: Object3D): Object3D {
  root.traverse((object) => {
    if (object instanceof Mesh) tagColorSlot(object.geometry, TRACK_COLOR_SLOT);
  });
  return root;
}

/**
 * The track mesh as a world entity: one instance, parked at the origin.
 *
 * No position or scale of its own beyond that — the mesh was swept along the
 * very path `makePathAroundTheGrid` builds, in game coordinates, so it lands on
 * the pawns' line only if it is registered unnormalized (`targetRadius: null`)
 * and drawn at the world centre the grid is centred on.
 *
 * Created per game rather than at registration time: `initGame` rebuilds the
 * world, and an entity created outside it would vanish on the first restart.
 * The palette name is inert — the dummy material ignores `aRow`.
 */
export function spawnTrack(world: World): Entity {
  const entity = createEntity();

  world.positions.set(entity, Position(0, 0, 0));
  addTag(world, entity, "track");
  world.models.set(entity, Model("track", LIGHT_PALETTE_SLOT));

  return entity;
}
