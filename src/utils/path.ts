import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
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
  colorStart: string = "#ff00ff",
  colorEnd: string = "#00ffff",
): Entity {
  const geometry = new BufferGeometry().setFromPoints(path.points);

  const c1 = new Color(colorStart);
  const c2 = new Color(colorEnd);
  const colors: number[] = [];

  path.points.forEach((_, i) => {
    const t = i / (path.points.length - 1);
    const c = c1.clone().lerp(c2, t);
    colors.push(c.r, c.g, c.b);
  });

  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));

  const material = new LineBasicMaterial({ vertexColors: true });
  const line = new LineLoop(geometry, material);

  const entity = createEntity();
  renderables.set(entity, line);
  scene.add(line);

  return entity;
}
