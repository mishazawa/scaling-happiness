import {
  BufferGeometry,
  LineBasicMaterial,
  LineLoop,
  Vector3,
  type Object3D,
  type Scene,
} from "three";
import type { Entity } from "../core/Entity";
import { createEntity } from "../core/Entity";
import { Path, type PathData } from "../core/Path";
import type { Grid } from "../setup/grid";

export function makePathAroundTheGrid(grid: Grid, padding: number): PathData {
  const { columns, rows, cellSize, center } = grid;

  const halfWidth = (columns * cellSize) / 2 + padding;
  const halfDepth = (rows * cellSize) / 2 + padding;

  return Path([
    new Vector3(center.x - halfWidth, center.y, center.z - halfDepth),
    new Vector3(center.x + halfWidth, center.y, center.z - halfDepth),
    new Vector3(center.x + halfWidth, center.y, center.z + halfDepth),
    new Vector3(center.x - halfWidth, center.y, center.z + halfDepth),
  ]);
}

export function DEBUG_pathVisualizer(
  path: PathData,
  renderables: Map<Entity, Object3D>,
  scene: Scene,
): Entity {
  const geometry = new BufferGeometry().setFromPoints(path.points);
  const material = new LineBasicMaterial({ color: "#ff00ff" });
  const line = new LineLoop(geometry, material);

  const entity = createEntity();
  renderables.set(entity, line);
  scene.add(line);

  return entity;
}
