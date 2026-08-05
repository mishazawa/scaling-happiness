import type { World } from "../core/World";
import type { Entity } from "../core/Entity";
import type { Object3D, Scene } from "three";

export function renderSystem(
  _world: World,
  _renderables: Map<Entity, Object3D>,
) {
  // iterate over world.positions and copy positions
}

export function renderSystemInit(
  _world: World,
  _renderables: Map<Entity, Object3D>,
  scene: Scene,
) {
  // iterate over world.renderables and add to scene
}
