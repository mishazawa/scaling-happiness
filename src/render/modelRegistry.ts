import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  type BufferGeometry,
  type Material,
  type Object3D,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ModelId } from "../core/Model";
import { prepareGeometry } from "../utils/geometry";
import { paletteMaterial } from "./materials";

export type RegisteredModel = {
  mesh: InstancedMesh;
  /** Palette row per instance — a `PALETTES_IDX` value. */
  rows: InstancedBufferAttribute;
  /** Idle-animation offset per instance, so instances don't breathe in sync. */
  phases: InstancedBufferAttribute;
  capacity: number;
};

/**
 * Instanced rendering resources, keyed by model id.
 *
 * Deliberately outside the ECS world: these are GPU resources shared by every
 * entity of a model, they must survive a world rebuild on restart, and putting
 * Three objects into component maps would break serialization. `main.ts`
 * registers once at startup and adds the meshes to the scene once; the render
 * system repacks the instance slots from scratch every frame, so a restart
 * clears itself with no teardown.
 *
 * Never cleared or disposed, for the same reason the material cache isn't.
 */
const models = new Map<ModelId, RegisteredModel>();

/**
 * Flattens a loaded glTF scene into the single geometry an `InstancedMesh` can
 * draw in one call.
 *
 * A glTF mesh is split into one primitive per material — the fish alone is four
 * — and the loader turns each into its own `Mesh`. Taking just the first would
 * silently render a fraction of the model, so they are all merged. Colour comes
 * from the palette lookup rather than from those materials, so nothing is lost
 * by collapsing them.
 *
 * Each node's world transform is baked in before merging: glTF carries the Y-up
 * conversion (and whatever the artist left on the object) on the *node*, and
 * instance matrices are built from a world position alone, so anything left on
 * the node would be dropped and every instance would render rotated or offset.
 */
function flattenToGeometry(root: Object3D): BufferGeometry {
  root.updateWorldMatrix(true, true);
  const geometries: BufferGeometry[] = [];

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    // Cloned because instanced attributes live on the geometry — each instanced
    // mesh must own its buffers rather than share the loader's.
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    geometries.push(geometry);
  });

  if (geometries.length === 0)
    throw new Error("model has no meshes to instance");

  const merged =
    geometries.length === 1 ? geometries[0] : mergeGeometries(geometries);
  if (!merged)
    throw new Error(
      "model primitives have mismatched attributes and cannot be merged",
    );

  return merged;
}

/**
 * Builds the instanced mesh for a loaded model.
 *
 * Every model shares one `paletteMaterial()`; per-object variation lives
 * entirely in the attributes allocated here. Capacity is fixed: the buffers are
 * sized once and the render system throws if the game ever tries to exceed them.
 *
 * `targetRadius: null` keeps the authored scale (see `prepareGeometry`), and
 * `material` swaps the palette shader out for geometry that carries no
 * `_color_id`. Both are extension points with no caller at the moment — the
 * track used to be the one, before it stopped being instanced.
 */
export function registerModel(
  id: ModelId,
  root: Object3D,
  capacity: number,
  targetRadius: number | null,
  material: Material = paletteMaterial(),
): RegisteredModel {
  const prepared = prepareGeometry(flattenToGeometry(root), targetRadius);

  const rows = new InstancedBufferAttribute(new Float32Array(capacity), 1);
  const phases = new InstancedBufferAttribute(new Float32Array(capacity), 1);
  rows.setUsage(DynamicDrawUsage);
  phases.setUsage(DynamicDrawUsage);
  prepared.setAttribute("aRow", rows);
  prepared.setAttribute("aPhase", phases);

  const mesh = new InstancedMesh(prepared, material, capacity);
  // Nothing is drawn until the render system packs slots on the first frame.
  mesh.count = 0;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // The mesh's bounds come from the source geometry and say nothing about where
  // the instances actually are, so culling would pop entities in and out at the
  // screen edges. Recomputing bounds every frame costs more than it saves here.
  mesh.frustumCulled = false;

  models.set(id, { mesh, rows, phases, capacity });
  return models.get(id)!;
}

export function getModel(id: ModelId): RegisteredModel {
  const model = models.get(id);
  if (!model) throw new Error(`model not registered: ${id}`);
  return model;
}

/**
 * Every *instanced* model, for the render system's per-frame repack.
 *
 * Deliberately excludes the plain meshes below: they have no instance slots to
 * pack, and the repack loop would zero a `count` they don't have.
 */
export function registeredModels(): IterableIterator<RegisteredModel> {
  return models.values();
}

/**
 * Plain, un-instanced models — a second registry alongside the instanced one.
 *
 * Not everything that comes out of a glTF wants instancing. Scenery exists once,
 * never moves, and is drawn straight from its own `Object3D`; forcing it through
 * `InstancedMesh` costs it its per-part materials, since a merged geometry can
 * only carry one. Registering it here keeps the "one place resolves a `ModelId`
 * to something drawable" rule while leaving those parts separate.
 *
 * Same lifetime as `models`: registered once at startup, never cleared.
 */
const meshes = new Map<ModelId, Object3D>();

/**
 * Registers a loaded model as an ordinary `Object3D`, keeping its node structure
 * and giving each `Mesh` the material `materialFor` returns for it.
 *
 * The mesh comes along with its node name because a material can depend on what
 * it is being applied to — the track's belt sizes its texture from the uv band
 * its geometry actually occupies.
 *
 * A `null` return means "leave the loader's own material alone". Every mesh is
 * visited, at any depth, so a name that never turns up is a silent mis-export
 * rather than a crash — callers that depend on a specific part should assert on
 * it (see `setup/track.ts`).
 *
 * The scene graph is used as loaded, not cloned: assets are loaded once and
 * registered once, and the cache in `setup/assets.ts` has no other reader.
 */
export function registerMesh(
  id: ModelId,
  root: Object3D,
  materialFor: (name: string, mesh: Mesh) => Material | null,
): Object3D {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;

    const material = materialFor(object.name, object);
    if (material) object.material = material;

    object.castShadow = true;
    object.receiveShadow = true;
  });

  meshes.set(id, root);
  return root;
}

export function getMesh(id: ModelId): Object3D {
  const mesh = meshes.get(id);
  if (!mesh) throw new Error(`mesh not registered: ${id}`);
  return mesh;
}
