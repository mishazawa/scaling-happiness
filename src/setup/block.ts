import {
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  type Scene,
  type Vector3,
} from "three";
import { BLOCK_SIZE } from "../constants";
import { createEntity, type Entity } from "../core/Entity";
import { Position } from "../core/Position";
import type { World } from "../core/World";
import { addTag } from "../core/Tag";
import { toFlat } from "../utils";

export type BlockColor = "#FFF" | "#000";

export type BlockData = {
  color: BlockColor;
  column: number;
  row: number;
};

const BLOCK_GEOMETRY = new BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

const materialsByColor = new Map<BlockColor, MeshStandardMaterial>();

function getBlockMaterial(color: BlockColor): MeshStandardMaterial {
  let material = materialsByColor.get(color);
  if (!material) {
    material = new MeshStandardMaterial({ color });
    materialsByColor.set(color, material);
  }
  return material;
}

export function spawnBlock(
  world: World,
  renderables: Map<Entity, Object3D>,
  scene: Scene,
  color: BlockColor,
  row: number,
  column: number,
  totalColumns: number,
  position: Vector3,
): Entity {
  const entity = createEntity();

  world.positions.set(entity, Position(position.x, position.y, position.z));
  world.blocks.set(entity, { color, row, column });
  world.gridToEntity.set(toFlat(row, column, totalColumns), entity);

  addTag(world, entity, "block");

  const mesh = new Mesh(BLOCK_GEOMETRY, getBlockMaterial(color));
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  renderables.set(entity, mesh);
  scene.add(mesh);

  return entity;
}
