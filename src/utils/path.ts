import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineLoop,
  Vector3,
  type Scene,
} from "three";
import type { Entity } from "../core/Entity";
import { createEntity } from "../core/Entity";
import { Path, type PathData } from "../core/Path";
import type { World } from "../core/World";
import { addRenderable } from "../systems/render";
import type { Grid } from "../setup/grid";

export function makePathAroundTheGrid(grid: Grid, padding: number): PathData {
  const { columns, rows, cellSize, center } = grid;

  const halfWidth = (columns * cellSize) / 2 + padding;
  const halfDepth = (rows * cellSize) / 2 + padding;

  return Path(
    [
      new Vector3(center.x - halfWidth, center.y, center.z - halfDepth),
      new Vector3(center.x + halfWidth, center.y, center.z - halfDepth),
      new Vector3(center.x + halfWidth, center.y, center.z + halfDepth),
      new Vector3(center.x - halfWidth, center.y, center.z + halfDepth),
    ].reverse(),
  );
}

export function DEBUG_pathVisualizer(
  world: World,
  path: PathData,
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
  addRenderable(world, scene, entity, line);

  return entity;
}

const _tempVec = new Vector3();

export function samplePath(path: PathData, t: number): Vector3 {
  const { points, segLengths, total } = path;

  if (points.length === 0) return _tempVec.set(0, 0, 0);
  if (points.length === 1) return _tempVec.copy(points[0]);

  let distance = Math.min(Math.max(t, 0), 1) * total;

  for (let i = 0; i < segLengths.length; i++) {
    const segLength = segLengths[i];
    const isLastSegment = i === segLengths.length - 1;

    if (distance <= segLength || isLastSegment) {
      const start = points[i];
      const end = points[(i + 1) % points.length];
      const alpha = segLength > 0 ? Math.min(distance / segLength, 1) : 0;
      return _tempVec.copy(start).lerp(end, alpha);
    }

    distance -= segLength;
  }

  return _tempVec.copy(points[0]);
}
