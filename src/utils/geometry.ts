import { BufferAttribute, type BufferGeometry } from "three";
import { COLOR_ATTRIBUTE } from "../constants";

/**
 * Stamps a single colour slot across every vertex.
 *
 * Authored models carry `_color_id` per vertex from Blender, which is how one
 * fish gets four colour regions. Procedural geometry has no such tagging, so a
 * sphere that should read as one flat colour declares its slot here instead.
 */
export function tagColorSlot(
  geometry: BufferGeometry,
  slot: number,
): BufferGeometry {
  const count = geometry.getAttribute("position").count;
  geometry.setAttribute(
    COLOR_ATTRIBUTE,
    new BufferAttribute(new Float32Array(count).fill(slot), 1),
  );
  return geometry;
}

/**
 * The `v` range a geometry's texture coordinates actually occupy.
 *
 * A model exported with one shared texture layout gives each of its parts a
 * *slice* of `v`, not the whole 0..1 — the track's belt sits in a band about
 * 0.04 tall. A texture meant to fill that part therefore has to be stretched
 * onto its band, and this is what measures it, so the numbers come from the
 * export rather than from a constant that silently goes stale when the model is
 * re-exported.
 *
 * Reads the attribute rather than rewriting it: the band is the authored layout,
 * and normalizing it into the vertices would leave the other parts unable to
 * find their own slices later.
 */
export function uvBand(geometry: BufferGeometry): { min: number; max: number } {
  const uv = geometry.getAttribute("uv");
  if (!uv) throw new Error("geometry has no uv attribute to measure");

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < uv.count; i++) {
    const v = uv.getY(i);
    if (v < min) min = v;
    if (v > max) max = v;
  }

  if (!(max > min)) throw new Error("geometry's uv band has no height");
  return { min, max };
}

/**
 * How many world units one unit of `u` covers — the scale that turns a speed in
 * world units into a speed in texture coordinates.
 *
 * The belt's `u` runs 0..1 over its whole loop, so this is the loop's length,
 * and dividing a pawn's speed by it gives how fast the arrows must crawl to keep
 * pace with the pawns. Measured rather than written down, so re-exporting a
 * longer track doesn't leave the arrows quietly running at the old speed.
 *
 * Only edges that run *along* `u` are measured — an edge with any `v` span
 * carries part of the belt's width in its length, and a triangle's diagonal
 * carries most of it. Summing distance and `u`-span separately, rather than
 * averaging per-edge ratios, is what makes the result meaningful on a strip whose
 * parameterization isn't uniform: the track's corners take a smaller share of
 * `u` than their length, and a median or mean of local rates would report a
 * corner's rate rather than the loop's. Each lengthwise chain of edges spans the
 * full 0..1, so the ratio of the sums is the average length of one such chain —
 * the belt's own length, with its inner and outer rails averaged into a
 * centreline.
 *
 * Long edges are skipped along with `v`-spanning ones: an edge that jumps most
 * of `u` at once is the seam where the strip wraps, not a step along it, and it
 * would contribute a whole loop of `u` for almost no distance.
 */
export function uvLengthU(geometry: BufferGeometry): number {
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  if (!uv) throw new Error("geometry has no uv attribute to measure");

  const index = geometry.getIndex();
  const at = (i: number) => (index ? index.getX(i) : i);
  const count = index ? index.count : position.count;

  const measured = new Set<string>();
  let distance = 0;
  let span = 0;

  for (let i = 0; i + 2 < count; i += 3) {
    const triangle = [at(i), at(i + 1), at(i + 2)];
    for (let e = 0; e < 3; e++) {
      const a = triangle[e];
      const b = triangle[(e + 1) % 3];

      const du = Math.abs(uv.getX(a) - uv.getX(b));
      const dv = Math.abs(uv.getY(a) - uv.getY(b));
      if (du < MIN_MEASURABLE_DU || du > MAX_MEASURABLE_DU) continue;
      if (dv > MAX_LENGTHWISE_DV) continue;

      // Interior edges belong to two triangles; counting one twice would weight
      // its rail against the others.
      const edge = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (measured.has(edge)) continue;
      measured.add(edge);

      distance += Math.hypot(
        position.getX(a) - position.getX(b),
        position.getY(a) - position.getY(b),
        position.getZ(a) - position.getZ(b),
      );
      span += du;
    }
  }

  if (span === 0)
    throw new Error("geometry has no edge running along u to measure");

  return distance / span;
}

/**
 * An edge spanning less than this in `u` is too short to divide a distance by;
 * one spanning more than half of it is a seam rather than a step. The belt's
 * edges each span about 1/30 of `u`, comfortably between the two.
 */
const MIN_MEASURABLE_DU = 1e-4;
const MAX_MEASURABLE_DU = 0.5;

/**
 * How far off a constant `v` an edge may drift and still count as running along
 * the strip rather than across it.
 *
 * Absolute rather than relative to the band, so it assumes the rows of vertices
 * are spaced much wider than this — the belt's are 0.018 apart, which is two
 * orders of magnitude clear. A band exported thin enough to close that gap would
 * start admitting diagonals, and the measured length would creep up toward the
 * belt's width.
 */
const MAX_LENGTHWISE_DV = 1e-4;

/**
 * Puts a merged model geometry under the contract the palette shader and the
 * instanced renderer expect. Mutates in place — callers own a freshly merged
 * geometry, so there is nothing to protect.
 *
 * Two things happen here rather than at draw time:
 *
 * - `_color_id`, the model's per-vertex colour-region tag, is aliased (not
 *   copied) to `aID`, the name the shader declares. Its absence is the most
 *   common glTF export mistake and otherwise shows up as uniformly
 *   slot-0-coloured geometry, so it throws.
 * - Scale is normalized to `targetRadius`, which keeps the per-frame instance
 *   matrix down to a yaw and a translation instead of carrying a scale field
 *   through the ECS. `null` keeps the authored scale, for a model whose size is
 *   already meaningful in world units rather than relative to its own origin.
 *   Nothing passes it today; every instanced model is a creature or a bubble.
 */
export function prepareGeometry(
  geometry: BufferGeometry,
  targetRadius: number | null,
): BufferGeometry {
  const colorId = geometry.getAttribute(COLOR_ATTRIBUTE);
  if (!colorId)
    throw new Error(
      `missing ${COLOR_ATTRIBUTE} — enable Attributes in glTF export`,
    );
  geometry.setAttribute("aID", colorId);

  geometry.computeBoundingSphere();
  const radius = geometry.boundingSphere?.radius ?? 0;
  if (targetRadius !== null && radius > 0) {
    const scale = targetRadius / radius;
    geometry.scale(scale, scale, scale);
    geometry.computeBoundingSphere();
  }

  return geometry;
}
