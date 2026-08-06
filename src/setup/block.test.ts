import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { createWorld } from "../core/World";
import { hasTag } from "../core/Tag";
import { COLOR_ATTRIBUTE, BLOCK_COLOR_SLOT } from "../constants";
import { toFlat } from "../utils/gridMath";
import { makeBubbleMesh, spawnBlock, type SpawnBlockConfig } from "./block";

function config(overrides: Partial<SpawnBlockConfig> = {}): SpawnBlockConfig {
  return {
    flag: "light",
    palette: "koi",
    row: 0,
    column: 0,
    totalColumns: 1,
    position: new Vector3(),
    ...overrides,
  };
}

describe("spawnBlock", () => {
  it("registers position, block data, and grid lookup on the world", () => {
    const world = createWorld();
    const position = new Vector3(1, 0, 2);

    const entity = spawnBlock(
      world,
      config({ row: 1, column: 2, totalColumns: 5, position }),
    );

    expect(world.positions.get(entity)).toEqual(position);
    expect(world.blocks.get(entity)).toEqual({
      row: 1,
      column: 2,
    });
    expect(world.gridToEntity.get(toFlat(1, 2, 5))).toBe(entity);
  });

  it("stores the flag the shooting system matches on", () => {
    const world = createWorld();

    const entity = spawnBlock(world, config({ flag: "dark" }));

    expect(world.flags.get(entity)).toBe("dark");
  });

  it("tags the entity as a block", () => {
    const world = createWorld();
    const entity = spawnBlock(world, config());

    expect(hasTag(world, entity, "block")).toBe(true);
  });

  it("draws as an instance, not as its own Object3D", () => {
    const world = createWorld();

    const entity = spawnBlock(
      world,
      config({ position: new Vector3(3, 0, -4) }),
    );

    expect(world.models.get(entity)?.modelId).toBe("block");
    expect(world.renderables.has(entity)).toBe(false);
  });

  it("draws with the palette it was given, independent of the flag", () => {
    const world = createWorld();
    const a = spawnBlock(world, config({ flag: "light", palette: "koi" }));
    const b = spawnBlock(
      world,
      config({ flag: "light", palette: "tide", column: 1, totalColumns: 2 }),
    );

    expect(world.models.get(a)?.palette).toBe("koi");
    expect(world.models.get(b)?.palette).toBe("tide");
  });

  it("assigns each entity a unique id", () => {
    const world = createWorld();

    const a = spawnBlock(world, config({ totalColumns: 2 }));
    const b = spawnBlock(world, config({ column: 1, totalColumns: 2 }));

    expect(a).not.toBe(b);
  });
});

describe("makeBubbleMesh", () => {
  it("stamps one colour slot across the whole sphere", () => {
    // A procedural sphere has no Blender-authored colour regions, so without
    // this it would fail registration for a missing _color_id.
    const geometry = makeBubbleMesh().geometry;
    const slots = geometry.getAttribute(COLOR_ATTRIBUTE);

    expect(slots.count).toBe(geometry.getAttribute("position").count);
    expect(slots.getX(0)).toBe(BLOCK_COLOR_SLOT);
    expect(slots.getX(slots.count - 1)).toBe(BLOCK_COLOR_SLOT);
  });
});
