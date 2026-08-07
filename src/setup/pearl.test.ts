import { describe, it, expect } from "vitest";
import {
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from "three";
import { degToRad } from "three/src/math/MathUtils.js";
import { makePearl } from "./pearl";
import { getMesh } from "../render/modelRegistry";
import {
  PEARL_COLOR,
  PEARL_METALNESS,
  PEARL_PEARL_PART,
  PEARL_POSITION,
  PEARL_ROUGHNESS,
  PEARL_SCALE,
  PEARL_SHELL_COLOR,
  PEARL_SHELL_METALNESS,
  PEARL_SHELL_PART,
  PEARL_SHELL_ROUGHNESS,
} from "../constants";

function pearlModel(...names: string[]): Object3D {
  const root = new Object3D();
  for (const name of names) {
    const mesh = new Mesh(new SphereGeometry(1, 4, 2));
    mesh.name = name;
    root.add(mesh);
  }
  return root;
}

function build(...names: string[]) {
  return makePearl(pearlModel(...names));
}

function materialOf(root: Object3D, name: string): MeshStandardMaterial {
  return (root.getObjectByName(name) as Mesh).material as MeshStandardMaterial;
}

describe("makePearl", () => {
  it("gives the shell a metallic gold and the bead a glossy bright colour", () => {
    // Two materials is the whole reason the pearl is not instanced: a merged
    // instanced geometry could only carry one.
    const root = build(PEARL_SHELL_PART, PEARL_PEARL_PART);

    const shell = materialOf(root, PEARL_SHELL_PART);
    const bead = materialOf(root, PEARL_PEARL_PART);

    expect(shell).not.toBe(bead);

    expect(shell.color.getHex()).toBe(PEARL_SHELL_COLOR);
    expect(shell.metalness).toBe(PEARL_SHELL_METALNESS);
    expect(shell.roughness).toBe(PEARL_SHELL_ROUGHNESS);

    expect(bead.color.getHex()).toBe(PEARL_COLOR);
    expect(bead.metalness).toBe(PEARL_METALNESS);
    expect(bead.roughness).toBe(PEARL_ROUGHNESS);
    // The gloss is the low roughness, and it is only gloss while it stays low.
    expect(bead.roughness).toBeLessThan(0.2);
  });

  it("builds its materials fresh, not out of the shared colour cache", () => {
    // Entries there are keyed by colour alone and shared, so a roughness set on
    // one would follow that colour onto everything else drawn in it.
    const first = materialOf(
      build(PEARL_SHELL_PART, PEARL_PEARL_PART),
      PEARL_SHELL_PART,
    );
    const second = materialOf(
      build(PEARL_SHELL_PART, PEARL_PEARL_PART),
      PEARL_SHELL_PART,
    );

    expect(first).not.toBe(second);
  });

  it("stands on its authored transform", () => {
    // Position and scale are placed by eye against the track's entrance, so
    // this only pins that the constants are what reaches the object — their
    // values are a judgement no test can make.
    const root = build(PEARL_SHELL_PART, PEARL_PEARL_PART);

    expect(root.position.equals(new Vector3(...PEARL_POSITION))).toBe(true);
    expect(
      root.scale.equals(new Vector3(PEARL_SCALE, PEARL_SCALE, PEARL_SCALE)),
    ).toBe(true);
  });

  it("turns the shell's mouth away from the camera and tips it back", () => {
    // The model is authored facing +z with its opening down its long axis; left
    // as exported it would present its back and sit flat. Asserted as the
    // direction its own forward ends up pointing, rather than as the two
    // rotations that got it there.
    const root = build(PEARL_SHELL_PART, PEARL_PEARL_PART);

    const forward = new Vector3(0, 0, 1).applyQuaternion(root.quaternion);

    // Half a turn about y: forward now runs back up the screen...
    expect(forward.z).toBeLessThan(0);
    // ...and the tip about x pitches it downward, so the shell leans toward
    // the camera instead of lying flat. The sign is the whole content of the
    // tilt, so it is pinned rather than merely asserted nonzero.
    expect(forward.y).toBeCloseTo(-Math.sin(degToRad(25)));
    // Neither turn rolls it: its forward stays in the y/z plane.
    expect(Math.abs(forward.x)).toBeLessThan(1e-6);
  });

  it("registers the result so it resolves by model id", () => {
    const root = build(PEARL_SHELL_PART, PEARL_PEARL_PART);

    expect(getMesh("pearl")).toBe(root);
  });

  it("throws when a half is missing rather than silently keeping grey", () => {
    expect(() => build(PEARL_SHELL_PART)).toThrow(PEARL_PEARL_PART);
    expect(() => build(PEARL_PEARL_PART)).toThrow(PEARL_SHELL_PART);
  });
});
