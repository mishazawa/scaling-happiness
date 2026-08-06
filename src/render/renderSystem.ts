import { Matrix4 } from "three";
import { PALETTES_IDX } from "../constants";
import type { Entity } from "../core/Entity";
import type { ModelId } from "../core/Model";
import type { World } from "../core/World";
import { uniforms } from "./materials";
import { getModel, registeredModels } from "./modelRegistry";

const matrix = new Matrix4();

/**
 * Idle-animation offset for an entity, in radians.
 *
 * Derived from the entity id rather than drawn at random so a given entity
 * always breathes the same way — deterministic across replays and snapshots.
 * The golden-ratio step spreads consecutive ids evenly around the cycle instead
 * of clustering them, which random sampling wouldn't guarantee either.
 */
export function phaseForEntity(entity: Entity): number {
  return ((entity * 0.6180339887) % 1) * Math.PI * 2;
}

/**
 * Pushes world state onto the GPU. Two passes, because entities are drawn one of
 * two ways and never both:
 *
 * 1. Entities with their own `Object3D` (blocks, projectiles, the debug path,
 *    queue pick boxes) just get their transform copied.
 * 2. Entities with a `models` component are packed into their model's shared
 *    `InstancedMesh`, into consecutive slots starting from zero.
 *
 * The instanced pass repacks from scratch every frame rather than tracking slot
 * ownership, which is what keeps despawning free — but it also means an entity's
 * slot changes as others die, so `aPhase` has to be rewritten alongside the
 * matrix rather than set once at spawn.
 */
export function renderSystem(world: World, dt: number): void {
  uniforms.uTime.value += dt;

  for (const [entity, position] of world.positions) {
    const object3D = world.renderables.get(entity);
    if (!object3D) continue;

    object3D.position.copy(position);

    const rotation = world.rotations.get(entity);
    if (rotation) object3D.rotation.y = rotation.yaw;
  }

  const counts = new Map<ModelId, number>();
  // Reset up front, not at the end: a model whose last entity died this frame
  // never appears in the loop below, and would otherwise keep drawing whatever
  // count it had before.
  for (const model of registeredModels()) model.mesh.count = 0;

  for (const [entity, { modelId, palette }] of world.models) {
    const position = world.positions.get(entity);
    if (!position) continue;

    const model = getModel(modelId);
    const slot = counts.get(modelId) ?? 0;
    if (slot >= model.capacity)
      throw new Error(
        `instance capacity exceeded for model "${modelId}": ${model.capacity}`,
      );

    // Yaw first, then the translation column: `makeRotationY` zeroes that
    // column, so `setPosition` has to come second. Entities without a rotation
    // (blocks) fall back to identity, i.e. the pure translation this was.
    matrix.makeRotationY(world.rotations.get(entity)?.yaw ?? 0);
    matrix.setPosition(position.x, position.y, position.z);
    model.mesh.setMatrixAt(slot, matrix);
    model.rows.array[slot] = PALETTES_IDX[palette];
    model.phases.array[slot] = phaseForEntity(entity);

    counts.set(modelId, slot + 1);
    model.mesh.count = slot + 1;
  }

  for (const model of registeredModels()) {
    model.mesh.instanceMatrix.needsUpdate = true;
    model.rows.needsUpdate = true;
    model.phases.needsUpdate = true;
  }
}
