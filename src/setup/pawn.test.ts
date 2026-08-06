import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { createWorld } from "../core/World";
import { hasTag } from "../core/Tag";
import {
  FLAG_DARK,
  FLAG_LIGHT,
  PAWN_AMMO,
  QUEUE_PAWN_YAW,
} from "../constants";
import { randomPawnKind, spawnPawn } from "./pawn";

describe("spawnPawn", () => {
  it("registers position and flag on the world", () => {
    const world = createWorld();
    const position = new Vector3(1, 0, 2);

    const entity = spawnPawn(world, {
      flag: "light",
      palette: "koi",
      position,
    });

    expect(world.positions.get(entity)).toEqual(position);
    expect(world.flags.get(entity)).toBe("light");
  });

  it("copies the position rather than aliasing it", () => {
    // spawnQueuedPawn hands over a queue's live position vector; storing it by
    // reference would make every pawn in that queue share one position.
    const world = createWorld();
    const position = new Vector3(1, 0, 2);

    const entity = spawnPawn(world, {
      flag: "light",
      palette: "koi",
      position,
    });
    position.set(9, 9, 9);

    expect(world.positions.get(entity)).toEqual(new Vector3(1, 0, 2));
  });

  it("tags the entity as a pawn", () => {
    const world = createWorld();
    const entity = spawnPawn(world, {
      flag: "dark",
      palette: "tide",
      position: new Vector3(),
    });

    expect(hasTag(world, entity, "pawn")).toBe(true);
  });

  it("draws as an instance, not as its own Object3D", () => {
    const world = createWorld();

    const entity = spawnPawn(world, {
      flag: "light",
      palette: "koi",
      position: new Vector3(3, 0, -4),
    });

    expect(world.models.get(entity)?.modelId).toBe("pawn");
    expect(world.renderables.has(entity)).toBe(false);
  });

  it("draws with the palette it was given, independent of the flag", () => {
    const world = createWorld();
    const a = spawnPawn(world, {
      flag: "light",
      palette: "koi",
      position: new Vector3(),
    });
    const b = spawnPawn(world, {
      flag: "light",
      palette: "tide",
      position: new Vector3(),
    });

    expect(world.models.get(a)?.palette).toBe("koi");
    expect(world.models.get(b)?.palette).toBe("tide");
  });

  it("faces the pawn up its queue while it waits", () => {
    const world = createWorld();
    const entity = spawnPawn(world, {
      flag: "light",
      palette: "koi",
      position: new Vector3(),
    });

    const rotation = world.rotations.get(entity)!;
    expect(rotation.yaw).toBeCloseTo(QUEUE_PAWN_YAW, 6);
    // Already there, so facingSystem has no turn to play out on a queued pawn.
    expect(rotation.target).toBeCloseTo(QUEUE_PAWN_YAW, 6);
  });

  it("gives the pawn its starting ammo count", () => {
    const world = createWorld();
    const entity = spawnPawn(world, {
      flag: "light",
      palette: "koi",
      position: new Vector3(),
    });

    expect(world.ammo.get(entity)).toBe(PAWN_AMMO);
  });

  it("assigns each entity a unique id", () => {
    const world = createWorld();

    const a = spawnPawn(world, {
      flag: "light",
      palette: "koi",
      position: new Vector3(),
    });
    const b = spawnPawn(world, {
      flag: "dark",
      palette: "tide",
      position: new Vector3(),
    });

    expect(a).not.toBe(b);
  });
});

describe("randomPawnKind", () => {
  it("only deals kinds that carry both a flag and a palette", () => {
    for (let i = 0; i < 50; i++) {
      const kind = randomPawnKind();

      expect([FLAG_LIGHT, FLAG_DARK]).toContain(kind.flag);
      expect(kind.palette).toBeTruthy();
    }
  });
});
