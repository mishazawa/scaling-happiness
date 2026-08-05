import type { World } from "../core/World";

export type System = (world: World, dt: number, args: unknown) => void;
