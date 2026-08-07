import { describe, expect, it } from "vitest";
import { MeshStandardMaterial, Scene, SphereGeometry, Vector3 } from "three";
import {
  LIFE_PEARL_DURATION,
  LIFE_PEARL_END_SCALE,
  LIFE_PEARL_SCALE,
  LIFE_PEARL_SPIN_SPEED,
} from "../constants";
import { createWorld } from "../core/World";
import { hasTag } from "../core/Tag";
import { LIFE_PEARL_TRAVEL, spawnLifePearl } from "./lifePearl";
import type { LifePearlSource } from "./pearl";

const ANCHOR = new Vector3(-5, 2, 3);

function source(): LifePearlSource {
  return {
    geometry: new SphereGeometry(1, 4, 2),
    material: new MeshStandardMaterial(),
    anchor: ANCHOR.clone(),
  };
}

function spawn(change: "spent" | "refunded") {
  const world = createWorld();
  const scene = new Scene();
  const src = source();
  const entity = spawnLifePearl(world, scene, src, change);

  return { world, scene, src, entity };
}

describe("spawnLifePearl", () => {
  it("draws the pearl from the bead it was given", () => {
    const { world, scene, src, entity } = spawn("spent");

    const mesh = world.renderables.get(entity)!;
    expect(scene.children).toContain(mesh);
    // Shared, not copied: one geometry and one material serve every pearl the
    // shell ever throws, however many are in the air at once.
    expect((mesh as never as { geometry: unknown }).geometry).toBe(src.geometry);
    expect((mesh as never as { material: unknown }).material).toBe(src.material);
    expect(hasTag(world, entity, "life-pearl")).toBe(true);
  });

  it("starts a spent life at the shell and lifts it clear", () => {
    const { world, entity } = spawn("spent");

    expect(world.positions.get(entity)!.toArray()).toEqual(ANCHOR.toArray());

    const tween = world.positionTweens.get(entity)!;
    expect(tween.from.y).toBe(ANCHOR.y);
    expect(tween.to.y).toBe(ANCHOR.y + LIFE_PEARL_TRAVEL);
    // It only ever moves straight up — the shell is what places it laterally.
    expect(tween.to.x).toBe(ANCHOR.x);
    expect(tween.to.z).toBe(ANCHOR.z);
  });

  it("shrinks a spent life away, from full size on the first frame", () => {
    const { world, entity } = spawn("spent");

    // Written alongside the tween, since nothing samples the tween until the
    // next timerSystem pass and DEFAULT_SCALE would flash for that frame.
    expect(world.scales.get(entity)).toBe(LIFE_PEARL_SCALE);

    const tween = world.scaleTweens.get(entity)!;
    expect(tween.from).toBe(LIFE_PEARL_SCALE);
    expect(tween.to).toBe(LIFE_PEARL_END_SCALE);
    expect(tween.duration).toBe(LIFE_PEARL_DURATION);
  });

  it("runs a refund the other way, from above and back into the shell", () => {
    const { world, entity } = spawn("refunded");

    expect(world.positions.get(entity)!.y).toBe(ANCHOR.y + LIFE_PEARL_TRAVEL);

    const tween = world.positionTweens.get(entity)!;
    expect(tween.from.y).toBe(ANCHOR.y + LIFE_PEARL_TRAVEL);
    // Onto the anchor exactly: there it is a smaller copy of the bead standing
    // in the shell, concentric with it, so the bead hides it being removed.
    expect(tween.to.toArray()).toEqual(ANCHOR.toArray());
  });

  it("grows a refund from nothing", () => {
    const { world, entity } = spawn("refunded");

    expect(world.scales.get(entity)).toBe(LIFE_PEARL_END_SCALE);

    const tween = world.scaleTweens.get(entity)!;
    expect(tween.from).toBe(LIFE_PEARL_END_SCALE);
    expect(tween.to).toBe(LIFE_PEARL_SCALE);
  });

  it("is small enough for the bead to hide it when it lands", () => {
    // The whole reason a refund can end on the anchor without a pop.
    expect(LIFE_PEARL_SCALE).toBeLessThan(1);
  });

  it("spins one way out and the other way back", () => {
    const out = spawn("spent");
    const back = spawn("refunded");

    const sweep = LIFE_PEARL_SPIN_SPEED * LIFE_PEARL_DURATION;
    expect(out.world.rotationTweens.get(out.entity)!.to).toBe(sweep);
    expect(back.world.rotationTweens.get(back.entity)!.to).toBe(-sweep);

    // Both need a rotation for the tween to have anything to write into.
    expect(out.world.rotations.get(out.entity)!.yaw).toBe(0);
  });

  it("gives every tween the one duration that times the animation", () => {
    const { world, entity } = spawn("spent");

    expect(world.positionTweens.get(entity)!.duration).toBe(
      LIFE_PEARL_DURATION,
    );
    expect(world.scaleTweens.get(entity)!.duration).toBe(LIFE_PEARL_DURATION);
    expect(world.rotationTweens.get(entity)!.duration).toBe(
      LIFE_PEARL_DURATION,
    );
  });

  it("does not alias the anchor it was given", () => {
    // Every pearl shares one source; writing through to it would drag the
    // shell's own position around behind them.
    const { world, src, entity } = spawn("spent");

    world.positions.get(entity)!.set(99, 99, 99);

    expect(src.anchor.toArray()).toEqual(ANCHOR.toArray());
  });
});
