import type { Object3D } from "three";

export type RenderableData = Object3D;

export const Renderable = (object3D: Object3D): RenderableData => object3D;
