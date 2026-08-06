import { MeshStandardMaterial } from "three";
import type { BlockColor } from "../core/Block";

/**
 * Shared material cache, keyed by colour.
 *
 * Intentionally never cleared: the game's whole palette is the two checkerboard
 * colours, so this reaches two entries during the first game and never grows —
 * restarts reuse the same materials rather than accumulating new ones. Disposal
 * would also be unsafe here, since a restart tears the scene down while these
 * materials are still referenced by the objects being removed.
 */
const materialsByColor = new Map<BlockColor, MeshStandardMaterial>();

export function standardMaterial(color: BlockColor): MeshStandardMaterial {
  let material = materialsByColor.get(color);
  if (!material) {
    material = new MeshStandardMaterial({ color });
    materialsByColor.set(color, material);
  }
  return material;
}
