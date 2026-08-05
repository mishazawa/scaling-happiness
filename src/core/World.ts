import type { Vector3 } from "three";
import type { Entity } from "./Entity";
import type { BlockData } from "../setup/block";

export type World = {
  positions: Map<Entity, Vector3>;
  blocks: Map<Entity, BlockData>;
  blockTags: Set<Entity>;
};

export function createWorld(): World {
  return {
    positions: new Map(),
    blocks: new Map(),
    blockTags: new Set(),
  };
}
