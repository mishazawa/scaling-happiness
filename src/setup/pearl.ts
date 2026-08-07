import {
  Mesh,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from "three";
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

/**
 * What it takes to spawn a copy of the bead as an entity: the geometry to draw,
 * the material to draw it with, and where the original stands.
 *
 * The material is the bead's own instance, not a second `reflectiveMaterial`
 * call — that factory mints a fresh material every time (deliberately: the
 * shared cache is keyed by colour alone and could not hold two roughnesses of
 * one colour), so calling it again would quietly double the pearl's materials.
 */
export type LifePearlSource = {
  geometry: BufferGeometry;
  material: Material;
  anchor: Vector3;
};

/**
 * Derives that source from a built pearl — see `spawnLifePearl` for what spawns
 * from it.
 *
 * A pure function of the object rather than something `makePearl` stashes away,
 * so nothing here is module state a test has to arrange around.
 *
 * The bead's world matrix is baked into the geometry rather than left on a node:
 * the bead is a child under the parent's authored turns, `PEARL_POSITION` and
 * `PEARL_SCALE` (4), and a copy that inherited none of that would draw at raw
 * export size. Baking it in also makes `LIFE_PEARL_SCALE` mean "a fraction of
 * the pearl you can see" rather than a size in world units.
 *
 * Recentring is what splits the two halves of that matrix apart again: the
 * translation becomes `anchor`, which a position component then owns, and the
 * geometry keeps only the rotation and scale. Without it every copy would be
 * pinned to the original's offset and the position tween would move it relative
 * to that.
 */
export function pearlBeadSource(pearl: Object3D): LifePearlSource {
  pearl.updateWorldMatrix(true, true);

  const bead = pearl.getObjectByName(PEARL_PEARL_PART);
  if (!(bead instanceof Mesh))
    throw new Error(`pearl model is missing its "${PEARL_PEARL_PART}" mesh`);

  const geometry: BufferGeometry = bead.geometry.clone();
  geometry.applyMatrix4(bead.matrixWorld);

  // Read before centring, since centring is what removes it.
  geometry.computeBoundingBox();
  const anchor = new Vector3();
  geometry.boundingBox?.getCenter(anchor);
  geometry.center();

  const material = Array.isArray(bead.material)
    ? bead.material[0]
    : bead.material;

  return { geometry, material, anchor };
}
