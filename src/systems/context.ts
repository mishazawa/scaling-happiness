import type { Scene } from "three";
import type { Entity } from "../core/Entity";

export type SystemContext = {
  scene: Scene;
  pathEntity: Entity;
};
