import { describe, it, expect } from "vitest";
import { Object3D, Scene, Vector3 } from "three";
import { createWorld } from "../core/World";
import { hasTag } from "../core/Tag";
import { spawnPawn } from "./pawn";

describe("spawnPawn", () => {
  it("registers position and color on the world", () => {
    const world = createWorld();
    const scene = new Scene();
    const position = new Vector3(1, 0, 2);

    const entity = spawnPawn(world, scene, { color: "#e63946", position });

    expect(world.positions.get(entity)).toEqual(position);
    expect(world.colors.get(entity)).toBe("#e63946");
  });

  it("tags the entity as a pawn", () => {
    const world = createWorld();
    const entity = spawnPawn(world, new Scene(), {
      color: "#000",
      position: new Vector3(),
    });

    expect(hasTag(world, entity, "pawn")).toBe(true);
  });

  it("adds a renderable mesh positioned at the given coordinates and adds it to the scene", () => {
    const world = createWorld();
    const scene = new Scene();
    const position = new Vector3(3, 0, -4);

    const entity = spawnPawn(world, scene, { color: "#FFF", position });

    const mesh = world.renderables.get(entity);
    expect(mesh).toBeInstanceOf(Object3D);
    expect(mesh!.position.equals(position)).toBe(true);
    expect(scene.children).toContain(mesh);
  });

  it("assigns each entity a unique id", () => {
    const world = createWorld();
    const scene = new Scene();

    const a = spawnPawn(world, scene, { color: "#FFF", position: new Vector3() });
    const b = spawnPawn(world, scene, { color: "#000", position: new Vector3() });

    expect(a).not.toBe(b);
  });
});
