import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  type Scene,
} from "three";
import type { Entity } from "../core/Entity";
import { createEntity } from "../core/Entity";
import type { PathData } from "../core/Path";
import type { World } from "../core/World";
import { addRenderable } from "../render/renderable";

/** Draws the track as a gradient line. Called unconditionally from main. */
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
  const line = new Line(geometry, material);

  const entity = createEntity();
  addRenderable(world, scene, entity, line);

  return entity;
}
