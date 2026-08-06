import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { createWorld } from "../core/World";
import { createEntity } from "../core/Entity";
import { PathFollower } from "../core/Path";
import { addTag } from "../core/Tag";
import { spawnBlock } from "../setup/block";
import { gameStatusSystem } from "./gameStatus";

describe("gameStatusSystem", () => {
  it("stays playing while blocks remain and lifes are available", () => {
    const world = createWorld();
    spawnBlock(world, "#FFF", 0, 0, 1, new Vector3());

    gameStatusSystem(world);

    expect(world.status).toBe("playing");
  });

  it("wins once no blocks remain", () => {
    const world = createWorld();

    gameStatusSystem(world);

    expect(world.status).toBe("won");
  });

  it("does not lose at 0 lifes while a pawn is still in flight", () => {
    const world = createWorld();
    spawnBlock(world, "#FFF", 0, 0, 1, new Vector3());
    world.lifes = 0;
    world.pathFollowers.set(createEntity(), PathFollower(createEntity(), 1));

    gameStatusSystem(world);

    expect(world.status).toBe("playing");
  });

  it("does not lose at 0 lifes while a projectile is still in flight", () => {
    const world = createWorld();
    spawnBlock(world, "#FFF", 0, 0, 1, new Vector3());
    world.lifes = 0;
    addTag(world, createEntity(), "projectile");

    gameStatusSystem(world);

    expect(world.status).toBe("playing");
  });

  it("loses at 0 lifes with no pawns in flight and blocks remaining", () => {
    const world = createWorld();
    spawnBlock(world, "#FFF", 0, 0, 1, new Vector3());
    world.lifes = 0;

    gameStatusSystem(world);

    expect(world.status).toBe("lost");
  });

  it("is idempotent once terminal", () => {
    const world = createWorld();
    world.status = "won";
    spawnBlock(world, "#FFF", 0, 0, 1, new Vector3());
    world.lifes = 0;

    gameStatusSystem(world);

    expect(world.status).toBe("won");
  });
});
