import { describe, it, expect } from "vitest";
import { Object3D, Scene, Vector3 } from "three";
import { createWorld } from "../core/World";
import { hasTag } from "../core/Tag";
import { toFlat } from "../utils";
import { spawnBlock } from "./block";

describe("spawnBlock", () => {
  it("registers position, block data, and grid lookup on the world", () => {
    const world = createWorld();
    const renderables = new Map();
    const scene = new Scene();
    const position = new Vector3(1, 0, 2);

    const entity = spawnBlock(
      world,
      renderables,
      scene,
      "#FFF",
      1,
      2,
      5,
      position,
    );

    expect(world.positions.get(entity)).toEqual(position);
    expect(world.blocks.get(entity)).toEqual({
      color: "#FFF",
      row: 1,
      column: 2,
    });
    expect(world.gridToEntity.get(toFlat(1, 2, 5))).toBe(entity);
  });

  it("tags the entity as a block", () => {
    const world = createWorld();
    const entity = spawnBlock(
      world,
      new Map(),
      new Scene(),
      "#000",
      0,
      0,
      1,
      new Vector3(),
    );

    expect(hasTag(world, entity, "block")).toBe(true);
  });

  it("adds a renderable mesh positioned at the given coordinates and adds it to the scene", () => {
    const world = createWorld();
    const renderables = new Map();
    const scene = new Scene();
    const position = new Vector3(3, 0, -4);

    const entity = spawnBlock(
      world,
      renderables,
      scene,
      "#FFF",
      0,
      0,
      1,
      position,
    );

    const mesh = renderables.get(entity);
    expect(mesh).toBeInstanceOf(Object3D);
    expect(mesh!.position.equals(position)).toBe(true);
    expect(scene.children).toContain(mesh);
  });

  it("assigns each entity a unique id", () => {
    const world = createWorld();
    const renderables = new Map();
    const scene = new Scene();

    const a = spawnBlock(world, renderables, scene, "#FFF", 0, 0, 2, new Vector3());
    const b = spawnBlock(world, renderables, scene, "#000", 0, 1, 2, new Vector3());

    expect(a).not.toBe(b);
  });
});
