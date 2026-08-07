import { Mesh, SphereGeometry, type Object3D } from "three";
import { reflectiveMaterial } from "../render/materials";
import {
  PEARL_COLOR,
  PEARL_METALNESS,
  PEARL_POSITION,
  PEARL_RADIUS,
  PEARL_ROUGHNESS,
  PEARL_SEGMENTS,
} from "../constants";

/**
 * The pearl's geometry and material, shared by the one standing at the track and
 * by every pearl the life count throws off it.
 *
 * A sphere in code rather than an authored model: a pearl is a sphere, and one
 * built here needs no file loaded, no exporter to keep in step, and no node
 * names to assert. Its radius lives in the geometry rather than in a scale on
 * the mesh, which is what lets `LIFE_PEARL_SCALE` mean "a fraction of the pearl
 * you can see" — the standing pearl draws it at 1.
 *
 * One instance of each, module-level, on the same terms as
 * `PROJECTILE_GEOMETRY`: they are rendering resources shared by everything drawn
 * from them, not per-object state, and a restart neither rebuilds nor disposes
 * them. `reflectiveMaterial` is called exactly once here — it mints a fresh
 * material per call (the shared cache is keyed by colour alone and could not
 * hold two roughnesses of one colour), so calling it per pearl would be a new
 * material every time the count moved.
 */
export const PEARL_GEOMETRY = new SphereGeometry(
  PEARL_RADIUS,
  PEARL_SEGMENTS,
  PEARL_SEGMENTS,
);

export const PEARL_MATERIAL = reflectiveMaterial(
  PEARL_COLOR,
  PEARL_METALNESS,
  PEARL_ROUGHNESS,
);

/**
 * Stands a pearl at the mouth of the track, ready to be added to the scene.
 *
 * Scenery, on exactly the terms the track is (see `makeTrack`): it exists once,
 * never moves, has no per-frame state, and so stays out of the ECS rather than
 * being taken down and rebuilt by a restart.
 *
 * Where it stands is authored, not derived: PEARL_POSITION was placed by eye
 * against the track's entrance, which is something only the rendered frame can
 * judge. Nothing reads its transform, so it is set here and never touched again.
 */
export function makePearl(): Object3D {
  const pearl = new Mesh(PEARL_GEOMETRY, PEARL_MATERIAL);

  pearl.position.set(...PEARL_POSITION);
  pearl.castShadow = true;
  pearl.receiveShadow = true;

  return pearl;
}
