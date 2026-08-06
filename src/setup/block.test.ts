import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { createWorld } from "../core/World";
import { hasTag } from "../core/Tag";
import { COLOR_ATTRIBUTE, BLOCK_COLOR_SLOT } from "../constants";
import { toFlat } from "../utils/gridMath";
import { makeBubbleMesh, spawnBlock } from "./block";

describe("spawnBlock", () => {
  it("registers position, block data, and grid lookup on the world", () => {
    const world = createWorld();
    const position = new Vector3(1, 0, 2);

    const entity = spawnBlock(world, "#FFF", 1, 2, 5, position);

    expect(world.positions.get(entity)).toEqual(position);
    expect(world.blocks.get(entity)).toEqual({
      row: 1,
      column: 2,
    });
    expect(world.colors.get(entity)).toEqual("#FFF");
    expect(world.gridToEntity.get(toFlat(1, 2, 5))).toBe(entity);
  });

  it("tags the entity as a block", () => {
    const world = createWorld();
    const entity = spawnBlock(world, "#000", 0, 0, 1, new Vector3());

    expect(hasTag(world, entity, "block")).toBe(true);
  });

  it("draws as an instance, not as its own Object3D", () => {
    const world = createWorld();

    const entity = spawnBlock(world, "#FFF", 0, 0, 1, new Vector3(3, 0, -4));

    expect(world.models.get(entity)?.modelId).toBe("block");
    expect(world.renderables.has(entity)).toBe(false);
  });

  it("picks the palette from the block's gameplay colour", () => {
    const world = createWorld();
    const light = spawnBlock(world, "#FFF", 0, 0, 2, new Vector3());
    const dark = spawnBlock(world, "#000", 0, 1, 2, new Vector3());

    expect(world.models.get(light)?.palette).toBe("koi");
    expect(world.models.get(dark)?.palette).toBe("tide");
  });

  it("refuses a colour with no palette rather than drawing it wrong", () => {
    const world = createWorld();

    expect(() => spawnBlock(world, "#e63946", 0, 0, 1, new Vector3())).toThrow(
      "#e63946",
    );
  });

  it("assigns each entity a unique id", () => {
    const world = createWorld();

    const a = spawnBlock(world, "#FFF", 0, 0, 2, new Vector3());
    const b = spawnBlock(world, "#000", 0, 1, 2, new Vector3());

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
