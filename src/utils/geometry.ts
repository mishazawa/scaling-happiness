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
 *   through the ECS.
 */
export function prepareGeometry(
  geometry: BufferGeometry,
  targetRadius: number,
): BufferGeometry {
  const colorId = geometry.getAttribute(COLOR_ATTRIBUTE);
  if (!colorId)
    throw new Error(
      `missing ${COLOR_ATTRIBUTE} — enable Attributes in glTF export`,
    );
  geometry.setAttribute("aID", colorId);

  geometry.computeBoundingSphere();
  const radius = geometry.boundingSphere?.radius ?? 0;
  if (radius > 0) {
    const scale = targetRadius / radius;
    geometry.scale(scale, scale, scale);
    geometry.computeBoundingSphere();
  }

  return geometry;
}
