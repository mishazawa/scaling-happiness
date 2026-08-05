import type { Vector3 } from "three";
import type { Entity } from "./Entity";
import type { BlockData } from "../setup/block";
import type { Tag } from "./Tag";

export type World = {
  positions: Map<Entity, Vector3>;
  blocks: Map<Entity, BlockData>;
  tags: Map<Entity, Set<Tag>>;
  tagIndex: Map<Tag, Set<Entity>>;
  gridToEntity: Map<number, Entity>;
};

export function createWorld(): World {
  return {
    positions: new Map(),
    blocks: new Map(),
    tags: new Map(),
    tagIndex: new Map(),
    gridToEntity: new Map(),
  };
}
