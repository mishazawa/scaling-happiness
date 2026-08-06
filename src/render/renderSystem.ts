import type { World } from "../core/World";

/** Syncs every renderable Object3D's transform from its position component. */
export function renderSystem(world: World, _dt: number): void {
  for (const [entity, position] of world.positions) {
    const object3D = world.renderables.get(entity);
    if (!object3D) continue;

    object3D.position.copy(position);
  }
}
