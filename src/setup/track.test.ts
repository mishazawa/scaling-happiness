import { describe, it, expect } from "vitest";
import {
  ClampToEdgeWrapping,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  Texture,
  Vector3,
} from "three";
import { makePathAroundTheGrid, makeTrack } from "./track";
import { getMesh } from "../render/modelRegistry";
import { uniforms } from "../render/materials";
import {
  TRACK_CHECKPOINTS,
  TRACK_CORNER_RADIUS,
  PAWN_SPEED,
  TRACK_ARROW_REPEAT,
  TRACK_END_T,
  TRACK_MOVING_PART,
  TRACK_START_T,
  TRACK_STATIC_COLOR,
  TRACK_STATIC_PART,
} from "../constants";

// A stand-in for the export: a strip whose uvs occupy a thin band of a shared
// layout rather than the whole 0..1, segmented along its length the way a swept
// track is. Its `u` covers BELT_LENGTH world units, which is what sets the
// scroll rate.
const BAND = { min: 0.92, max: 0.96 };
const BELT_LENGTH = 4;

function trackModel(...names: string[]): Object3D {
  const root = new Object3D();
  for (const name of names) {
    const geometry = new PlaneGeometry(BELT_LENGTH, 1, 8, 1);
    const uv = geometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) {
      uv.setY(i, BAND.min + uv.getY(i) * (BAND.max - BAND.min));
    }
    const mesh = new Mesh(geometry);
    mesh.name = name;
    root.add(mesh);
  }
  return root;
}

function build(...names: string[]) {
  return makeTrack(trackModel(...names), new Texture());
}

// Runs the material's onBeforeCompile over a stand-in for three's shader source,
// carrying the chunks it hooks into.
function compile(root: Object3D) {
  const shader = {
    uniforms: {} as Record<string, unknown>,
    vertexShader: "",
    fragmentShader:
      "#include <common>\n#include <map_fragment>\n#include <color_fragment>",
  };
  materialOf(root, TRACK_MOVING_PART).onBeforeCompile(
    shader as never,
    null as never,
  );
  return shader;
}

function materialOf(root: Object3D, name: string): MeshStandardMaterial {
  return (root.getObjectByName(name) as Mesh).material as MeshStandardMaterial;
}

const corners = TRACK_CHECKPOINTS.map(([x, y, z]) => new Vector3(x, y, z));

// The half-extents the checkpoints describe. Read off the authored corners
// rather than recomputed from the grid, so these tests keep testing the shape
// the game actually walks if the checkpoints are ever moved.
const halfWidth = Math.max(...corners.map((c) => Math.abs(c.x)));
const halfDepth = Math.max(...corners.map((c) => Math.abs(c.z)));

describe("makePathAroundTheGrid", () => {
  it("produces an open path: no closing segment back to the first point", () => {
    const path = makePathAroundTheGrid();

    expect(path.segLengths.length).toBe(path.points.length - 1);
  });

  it("covers the TRACK_START_T..TRACK_END_T fraction of the checkpoint loop, minus what the rounded corners cut", () => {
    const fullPerimeter = corners.reduce(
      (sum, corner, i) =>
        sum + corner.distanceTo(corners[(i + 1) % corners.length]),
      0,
    );
    const sharpTotal = (TRACK_END_T - TRACK_START_T) * fullPerimeter;

    const path = makePathAroundTheGrid();

    // Cutting corners can only shorten the track, and only slightly.
    expect(path.total).toBeLessThanOrEqual(sharpTotal);
    expect(path.total).toBeGreaterThan(sharpTotal * 0.95);
  });

  it("starts and ends inside the checkpoint loop rather than at a corner", () => {
    const path = makePathAroundTheGrid();

    const start = path.points[0];
    const end = path.points[path.points.length - 1];
    for (const corner of corners) {
      expect(start.distanceTo(corner)).toBeGreaterThan(0);
      expect(end.distanceTo(corner)).toBeGreaterThan(0);
    }
  });

  it("never bulges outside the sharp corner it rounds", () => {
    const path = makePathAroundTheGrid();

    for (const point of path.points) {
      expect(Math.abs(point.x)).toBeLessThanOrEqual(halfWidth + 1e-9);
      expect(Math.abs(point.z)).toBeLessThanOrEqual(halfDepth + 1e-9);
    }
  });

  it("turns at every checkpoint the slice keeps, in authored order", () => {
    // The cut straddles the first checkpoint, so the track runs from just past
    // it to just before it; the other three survive as filleted turns, which a
    // fillet leaves within TRACK_CORNER_RADIUS of the sharp corner it replaced.
    const path = makePathAroundTheGrid();

    const closest = corners.slice(1).map((corner) => {
      let best = 0;
      for (let i = 1; i < path.points.length; i++) {
        if (
          path.points[i].distanceTo(corner) <
          path.points[best].distanceTo(corner)
        )
          best = i;
      }
      return { index: best, distance: path.points[best].distanceTo(corner) };
    });

    for (const { distance } of closest) {
      expect(distance).toBeLessThanOrEqual(TRACK_CORNER_RADIUS);
    }
    // Travel order: the track meets them in the order they are authored.
    expect(closest.map((c) => c.index)).toEqual(
      [...closest.map((c) => c.index)].sort((a, b) => a - b),
    );
  });
});

describe("makeTrack", () => {
  it("colours the static half and textures the moving one", () => {
    // Two materials is the whole reason the track is not instanced: a merged
    // instanced geometry could only carry one.
    const root = build(TRACK_STATIC_PART, TRACK_MOVING_PART);

    const staticMaterial = materialOf(root, TRACK_STATIC_PART);
    const movingMaterial = materialOf(root, TRACK_MOVING_PART);

    expect(staticMaterial).not.toBe(movingMaterial);
    expect(staticMaterial.color.getHex()).toBe(TRACK_STATIC_COLOR);
    expect(staticMaterial.map).toBeNull();
    expect(movingMaterial.map).not.toBeNull();
  });

  it("stretches the arrow tile onto the belt's uv band, tiling only along it", () => {
    // The belt occupies a thin slice of the export's shared uv layout. Left
    // untransformed, the tile would be sampled as a few stretched texel rows;
    // and a repeating T would stack a squashed arrow per repeat across the
    // belt's width instead of one across it.
    const map = materialOf(
      build(TRACK_STATIC_PART, TRACK_MOVING_PART),
      TRACK_MOVING_PART,
    ).map!;
    const height = BAND.max - BAND.min;

    expect(map.repeat.x).toBe(TRACK_ARROW_REPEAT);
    // Loose: the band is measured off a Float32 uv attribute.
    expect(map.repeat.y).toBeCloseTo(1 / height, 3);
    // uv * repeat + offset maps the band's ends onto the tile's.
    expect(BAND.min * map.repeat.y + map.offset.y).toBeCloseTo(0, 3);
    expect(BAND.max * map.repeat.y + map.offset.y).toBeCloseTo(1, 3);

    expect(map.wrapS).toBe(RepeatWrapping);
    expect(map.wrapT).toBe(ClampToEdgeWrapping);
  });

  it("animates the moving half off the shared clock, and only that half", () => {
    // Sync with the fish is the point: the hook must merge the module-level
    // uniforms rather than declare a uTime of its own.
    const root = build(TRACK_STATIC_PART, TRACK_MOVING_PART);

    expect(materialOf(root, TRACK_MOVING_PART).onBeforeCompile).not.toBe(
      materialOf(root, TRACK_STATIC_PART).onBeforeCompile,
    );

    const shader = compile(root);

    expect(shader.uniforms.uTime).toBe(uniforms.uTime);
    expect(shader.fragmentShader).toContain("uniform float uTime");
    // The chunk it replaced still has to run, or the base colour is lost.
    expect(shader.fragmentShader).toContain("#include <color_fragment>");
  });

  it("scrolls the arrows at pawn speed, measured off the belt's own length", () => {
    // The rate is in tiles per second, the space vMapUv is already in: a belt
    // BELT_LENGTH units long carries TRACK_ARROW_REPEAT tiles, so a pawn
    // crossing it at PAWN_SPEED passes this many arrows a second.
    const expected = (PAWN_SPEED / BELT_LENGTH) * TRACK_ARROW_REPEAT;

    const fragment = compile(
      build(TRACK_STATIC_PART, TRACK_MOVING_PART),
    ).fragmentShader;

    expect(fragment).toContain(`uTime * ${expected.toFixed(6)}`);
  });

  it("subtracts the scroll, so the arrows travel the way the pawns do", () => {
    // Sampling further along the texture pulls the image backwards; adding it
    // would run the arrows against the traffic.
    const fragment = compile(
      build(TRACK_STATIC_PART, TRACK_MOVING_PART),
    ).fragmentShader;

    expect(fragment).toMatch(/vMapUv - vec2\(uTime \* [\d.]+, 0\.0\)/);
    // ...and the chunk that used to sample it plainly is gone, or the arrows
    // would be drawn twice, once still.
    expect(fragment).not.toContain("#include <map_fragment>");
  });

  it("registers the result so it resolves by model id", () => {
    const root = build(TRACK_STATIC_PART, TRACK_MOVING_PART);

    expect(getMesh("track")).toBe(root);
  });

  it("throws when a half is missing rather than silently keeping grey", () => {
    expect(() => build(TRACK_STATIC_PART)).toThrow(TRACK_MOVING_PART);
    expect(() => build(TRACK_MOVING_PART)).toThrow(TRACK_STATIC_PART);
  });
});
