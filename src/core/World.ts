import type { Vector3, Object3D } from "three";
import type { Entity } from "./Entity";
import type { BlockColor, BlockData } from "../setup/block";
import type { Tag } from "./Tag";
import type { PathData, PathFollowerData } from "./Path";
import type { Event } from "./Event";
import type { AmmoData } from "./Ammo";
import { LIFES_COUNT } from "../constants";

export type World = {
  positions: Map<Entity, Vector3>;
  blocks: Map<Entity, BlockData>;
  colors: Map<Entity, BlockColor>;
  tags: Map<Entity, Set<Tag>>;
  tagIndex: Map<Tag, Set<Entity>>;
  gridToEntity: Map<number, Entity>;
  paths: Map<Entity, PathData>;
  pathFollowers: Map<Entity, PathFollowerData>;
  renderables: Map<Entity, Object3D>;
  queues: Map<Entity, Entity[]>;
  queueMembership: Map<Entity, Entity>;
  lastFiredLanes: Map<Entity, number>;
  ammo: Map<Entity, AmmoData>;
  events: Event[];
  lifes: number;
};

export function createWorld(): World {
  return {
    lifes: LIFES_COUNT,
    positions: new Map(),
    blocks: new Map(),
    colors: new Map(),
    tags: new Map(),
    tagIndex: new Map(),
    gridToEntity: new Map(),
    paths: new Map<Entity, PathData>(),
    pathFollowers: new Map(),
    renderables: new Map(),
    queues: new Map(),
    queueMembership: new Map(),
    lastFiredLanes: new Map(),
    ammo: new Map(),
    events: [],
  };
}
