import type { World } from "../core/World";
import type { Entity } from "../core/Entity";
import type { Object3D, Scene } from "three";
import { Renderable } from "../core/Renderable";

/**
 * Registers an entity's Object3D: stores the component, stamps the reverse
 * lookup that raycasting reads back (see render/interaction.ts), and adds the
 * object to the scene graph.
 *
 * This is a construction-time helper rather than a per-frame system, which is
 * why it sits below setup/ — the setup factories call it, and keeping it out of
 * systems/ is what stops setup/ and systems/ importing each other.
 */
export function addRenderable(
  world: World,
  scene: Scene,
  entity: Entity,
  object3D: Object3D,
): void {
  world.renderables.set(entity, Renderable(object3D));
  object3D.userData.entity = entity;
  scene.add(object3D);
}
