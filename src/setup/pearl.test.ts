import { describe, it, expect } from "vitest";
import {
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from "three";
import { degToRad } from "three/src/math/MathUtils.js";
import { makePearl, pearlBeadSource } from "./pearl";
import { getMesh } from "../render/modelRegistry";
import {
  HEIGHT_OFFSET,
  LIFE_PEARL_SCALE,
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

describe("pearlBeadSource", () => {
  it("hands back the bead's own material rather than a second one", () => {
    // reflectiveMaterial mints a fresh instance per call, so asking for the
    // pearl's colours again would be a whole extra material to keep in step.
    const root = build(PEARL_SHELL_PART, PEARL_PEARL_PART);

    expect(pearlBeadSource(root).material).toBe(
      materialOf(root, PEARL_PEARL_PART),
    );
  });

  it("reports where the bead stands, plus the crutch offset", () => {
    const root = build(PEARL_SHELL_PART, PEARL_PEARL_PART);

    // The bead sits at its parent's origin in the fixture, so the anchor is the
    // authored position — the point a spawned pearl leaves from and returns to —
    // shifted by the hand-tuned nudge marked `// crutch` in pearl.ts. Written
    // out here rather than folded into a number, so the hack stays visible.
    const CRUTCH = new Vector3(-HEIGHT_OFFSET / 2, -HEIGHT_OFFSET, 0);

    const anchor = pearlBeadSource(root).anchor;
    expect(anchor.x).toBeCloseTo(PEARL_POSITION[0] + CRUTCH.x, 5);
    expect(anchor.y).toBeCloseTo(PEARL_POSITION[1] + CRUTCH.y, 5);
    expect(anchor.z).toBeCloseTo(PEARL_POSITION[2] + CRUTCH.z, 5);
  });

  it("centres the geometry so a position component can place it", () => {
    // Left on the bead's own offset, every copy would be pinned there and the
    // position tween would move it relative to that rather than to the shell.
    const root = build(PEARL_SHELL_PART, PEARL_PEARL_PART);

    const { geometry } = pearlBeadSource(root);
    geometry.computeBoundingBox();
    const center = new Vector3();
    geometry.boundingBox!.getCenter(center);

    expect(center.length()).toBeLessThan(1e-6);
  });

  /**
   * The flying pearl is its own sphere of LIFE_PEARL_SCALE put through the
   * bead's world matrix, not a clone of the bead's geometry. The matrix is what
   * matters: the bead is a child under the parent's turns, PEARL_POSITION and
   * PEARL_SCALE, and a copy that inherited none of that would draw at raw
   * export size. Baking it in is also what makes LIFE_PEARL_SCALE a fraction of
   * the pearl on screen rather than a size in world units.
   */
  it("bakes the pearl's scale into the geometry", () => {
    const root = build(PEARL_SHELL_PART, PEARL_PEARL_PART);

    const { geometry } = pearlBeadSource(root);
    geometry.computeBoundingSphere();

    expect(geometry.boundingSphere!.radius).toBeCloseTo(
      LIFE_PEARL_SCALE * PEARL_SCALE,
      5,
    );
  });

  it("leaves the pearl it read from alone", () => {
    const root = build(PEARL_SHELL_PART, PEARL_PEARL_PART);
    const bead = root.getObjectByName(PEARL_PEARL_PART) as Mesh;
    const before = bead.geometry;

    pearlBeadSource(root);

    expect(bead.geometry).toBe(before);
    expect(bead.position.length()).toBe(0);
  });

  it("throws when there is no bead to copy", () => {
    const root = new Object3D();

    expect(() => pearlBeadSource(root)).toThrow(PEARL_PEARL_PART);
  });
});
