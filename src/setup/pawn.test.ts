import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { createWorld } from "../core/World";
import { hasTag } from "../core/Tag";
import { PAWN_AMMO } from "../constants";
import { spawnPawn } from "./pawn";

describe("spawnPawn", () => {
  it("registers position and color on the world", () => {
    const world = createWorld();
    const position = new Vector3(1, 0, 2);

    const entity = spawnPawn(world, { color: "#FFF", position });

    expect(world.positions.get(entity)).toEqual(position);
    expect(world.colors.get(entity)).toBe("#FFF");
  });

  it("refuses a colour with no palette rather than drawing it wrong", () => {
    // Reaching the render system unmapped would write NaN into the row buffer
    // and silently fall back to palette row 0.
    const world = createWorld();

    expect(() =>
      spawnPawn(world, { color: "#e63946", position: new Vector3() }),
    ).toThrow("#e63946");
  });

  it("copies the position rather than aliasing it", () => {
    // spawnQueuedPawn hands over a queue's live position vector; storing it by
    // reference would make every pawn in that queue share one position.
    const world = createWorld();
    const position = new Vector3(1, 0, 2);

    const entity = spawnPawn(world, { color: "#FFF", position });
    position.set(9, 9, 9);

    expect(world.positions.get(entity)).toEqual(new Vector3(1, 0, 2));
  });

  it("tags the entity as a pawn", () => {
    const world = createWorld();
    const entity = spawnPawn(world, {
      color: "#000",
      position: new Vector3(),
    });

    expect(hasTag(world, entity, "pawn")).toBe(true);
  });

  it("draws as an instance, not as its own Object3D", () => {
    const world = createWorld();

    const entity = spawnPawn(world, {
      color: "#FFF",
      position: new Vector3(3, 0, -4),
    });

    expect(world.models.get(entity)?.modelId).toBe("pawn");
    expect(world.renderables.has(entity)).toBe(false);
  });

  it("picks the palette from the pawn's gameplay colour", () => {
    const world = createWorld();
    const light = spawnPawn(world, {
      color: "#FFF",
      position: new Vector3(),
    });
    const dark = spawnPawn(world, { color: "#000", position: new Vector3() });

    expect(world.models.get(light)?.palette).toBe("koi");
    expect(world.models.get(dark)?.palette).toBe("tide");
  });

  it("gives the pawn its starting ammo count", () => {
    const world = createWorld();
    const entity = spawnPawn(world, {
      color: "#FFF",
      position: new Vector3(),
    });

    expect(world.ammo.get(entity)).toBe(PAWN_AMMO);
  });

  it("assigns each entity a unique id", () => {
    const world = createWorld();

    const a = spawnPawn(world, { color: "#FFF", position: new Vector3() });
    const b = spawnPawn(world, { color: "#000", position: new Vector3() });

    expect(a).not.toBe(b);
  });
});
