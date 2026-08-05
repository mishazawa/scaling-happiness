import type { World } from "../core/World";
import type { Entity } from "../core/Entity";
import type { Object3D, Scene } from "three";
import { Renderable } from "../core/Renderable";

export function addRenderable(
  world: World,
  scene: Scene,
  entity: Entity,
  object3D: Object3D,
): void {
  world.renderables.set(entity, Renderable(object3D));
  scene.add(object3D);
}

export function renderSystem(world: World, _dt: number): void {
  for (const [entity, position] of world.positions) {
    const object3D = world.renderables.get(entity);
    if (!object3D) continue;

    object3D.position.copy(position);
  }
}
