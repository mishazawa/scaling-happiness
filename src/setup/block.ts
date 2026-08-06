import {
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
  type Scene,
  type Vector3,
} from "three";
import { BLOCK_SIZE } from "../constants";
import { createEntity, type Entity } from "../core/Entity";
import { Position } from "../core/Position";
import type { World } from "../core/World";
import { addTag } from "../core/Tag";
import { addRenderable } from "../render/renderable";
import { toFlat } from "../utils";
import type { BlockColor } from "../core/Block";

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
  scene: Scene,
  color: BlockColor,
  row: number,
  column: number,
  totalColumns: number,
  position: Vector3,
): Entity {
  const entity = createEntity();

  world.positions.set(entity, Position(position.x, position.y, position.z));
  world.blocks.set(entity, { row, column });
  world.colors.set(entity, color);
  world.gridToEntity.set(toFlat(row, column, totalColumns), entity);

  addTag(world, entity, "block");

  const mesh = new Mesh(BLOCK_GEOMETRY, getBlockMaterial(color));
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  addRenderable(world, scene, entity, mesh);

  return entity;
}
