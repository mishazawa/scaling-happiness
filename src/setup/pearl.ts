import type { Object3D } from "three";
import { registerMesh } from "../render/modelRegistry";
import { reflectiveMaterial } from "../render/materials";
import {
  PEARL_COLOR,
  PEARL_METALNESS,
  PEARL_PEARL_PART,
  PEARL_POSITION,
  PEARL_ROUGHNESS,
  PEARL_SCALE,
  PEARL_SHELL_COLOR,
  PEARL_SHELL_METALNESS,
  PEARL_SHELL_PART,
  PEARL_SHELL_ROUGHNESS,
} from "../constants";
import { degToRad } from "three/src/math/MathUtils.js";

/**
 * Registers the imported pearl as a plain, un-instanced mesh and stands it at
 * the mouth of the track, ready to be added to the scene.
 *
 * Scenery, on exactly the terms the track is (see `makeTrack`): it exists once,
 * never moves, has no per-frame state, and so stays out of the ECS rather than
 * being taken down and rebuilt by a restart. Its node structure survives for the
 * same reason too — its two halves need two materials, which one merged
 * instanced geometry could not carry:
 *
 *   - `shell` — gold, metallic.
 *   - `pearl` — the bead, a glossy dielectric.
 *
 * Where it stands is authored, not derived: PEARL_POSITION/PEARL_SCALE and the
 * two turns below were placed by eye against the track's entrance, which is
 * something only the rendered frame can judge. Nothing reads its transform, so
 * it is set here and never touched again.
 *
 * Both halves are asserted present — a rename in Blender would otherwise show up
 * as a pearl that silently kept the exporter's grey.
 */
export function makePearl(root: Object3D): Object3D {
  const parts = new Set<string>();

  const pearl = registerMesh("pearl", root, (name) => {
    parts.add(name);
    if (name === PEARL_SHELL_PART)
      return reflectiveMaterial(
        PEARL_SHELL_COLOR,
        PEARL_SHELL_METALNESS,
        PEARL_SHELL_ROUGHNESS,
      );
    if (name === PEARL_PEARL_PART)
      return reflectiveMaterial(PEARL_COLOR, PEARL_METALNESS, PEARL_ROUGHNESS);
    return null;
  });

  for (const part of [PEARL_SHELL_PART, PEARL_PEARL_PART]) {
    if (!parts.has(part))
      throw new Error(`pearl model is missing its "${part}" mesh`);
  }
  pearl.rotateY(degToRad(180));
  pearl.rotateX(degToRad(25));
  pearl.position.set(...PEARL_POSITION);
  pearl.scale.set(PEARL_SCALE, PEARL_SCALE, PEARL_SCALE);

  return pearl;
}
