import type { Vector3 } from "three";
import type { Entity } from "./Entity";
import type { BlockData } from "../setup/block";
import type { Tag } from "./Tag";
import type { PathData, PathFollowerData } from "./Path";

export type World = {
  positions: Map<Entity, Vector3>;
  blocks: Map<Entity, BlockData>;
  tags: Map<Entity, Set<Tag>>;
  tagIndex: Map<Tag, Set<Entity>>;
  gridToEntity: Map<number, Entity>;
  paths: Map<Entity, PathData>;
  pathFollowers: Map<Entity, PathFollowerData>;
};

export function createWorld(): World {
  return {
    positions: new Map(),
    blocks: new Map(),
    tags: new Map(),
    tagIndex: new Map(),
    gridToEntity: new Map(),
    paths: new Map<Entity, PathData>(),
    pathFollowers: new Map(),
  };
}
