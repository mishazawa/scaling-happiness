import { describe, expect, it } from "vitest";
import { BoxGeometry, BufferAttribute, PlaneGeometry } from "three";
import { COLOR_ATTRIBUTE, PAWN_MODEL_RADIUS } from "../constants";
import { prepareGeometry, uvBand, uvLengthU } from "./geometry";

function taggedBox(size = 1) {
  const geometry = new BoxGeometry(size, size, size);
  const count = geometry.getAttribute("position").count;
  geometry.setAttribute(
    COLOR_ATTRIBUTE,
    new BufferAttribute(new Float32Array(count).fill(2), 1),
  );
  return geometry;
}

describe("prepareGeometry", () => {
  it("throws when the model has no colour-region attribute", () => {
    // The most common export mistake, and one that otherwise shows up only as
    // silently slot-0-coloured geometry.
    expect(() =>
      prepareGeometry(new BoxGeometry(1, 1, 1), PAWN_MODEL_RADIUS),
    ).toThrow(COLOR_ATTRIBUTE);
  });

  it("aliases the exported colour attribute to the name the shader declares", () => {
    const prepared = prepareGeometry(taggedBox(), PAWN_MODEL_RADIUS);

    expect(prepared.getAttribute("aID")).toBe(
      prepared.getAttribute(COLOR_ATTRIBUTE),
    );
    expect(prepared.getAttribute("aID").getX(0)).toBe(2);
  });

  it("normalizes every model to the shared target radius", () => {
    // Keeps the per-frame instance matrix a pure translation: no model scale
    // has to travel through the ECS.
    const small = prepareGeometry(taggedBox(1), PAWN_MODEL_RADIUS);
    const large = prepareGeometry(taggedBox(100), PAWN_MODEL_RADIUS);

    expect(small.boundingSphere!.radius).toBeCloseTo(PAWN_MODEL_RADIUS, 5);
    expect(large.boundingSphere!.radius).toBeCloseTo(PAWN_MODEL_RADIUS, 5);
  });

  it("keeps the authored scale when no target radius is given", () => {
    // What the track needs: it is modelled in world coordinates along the very
    // path pawns walk, so normalizing it would pull it off that line.
    const box = taggedBox(10);
    const before = box.boundingSphere?.radius ?? null;
    expect(before).toBeNull();

    const prepared = prepareGeometry(box, null);

    expect(prepared.boundingSphere!.radius).toBeCloseTo(
      Math.sqrt(3) * 5, // half-diagonal of a 10-unit cube
      5,
    );
  });
});

describe("uvBand", () => {
  it("measures the slice of v the geometry actually occupies", () => {
    // A model exported on one shared layout gives each part a band, not the
    // whole 0..1 — the number a texture has to be stretched onto.
    const geometry = new BoxGeometry(1, 1, 1);
    const uv = geometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) {
      uv.setY(i, 0.92 + uv.getY(i) * 0.04);
    }

    const band = uvBand(geometry);

    expect(band.min).toBeCloseTo(0.92, 5);
    expect(band.max).toBeCloseTo(0.96, 5);
  });

  it("throws on geometry with no texture coordinates at all", () => {
    const geometry = new BoxGeometry(1, 1, 1);
    geometry.deleteAttribute("uv");

    expect(() => uvBand(geometry)).toThrow("uv");
  });

  it("throws on a band with no height, rather than dividing by zero later", () => {
    // Every v equal is an unwrapped part; the caller would turn the height into
    // a texture repeat, and Infinity there is invisible until it renders.
    const geometry = new BoxGeometry(1, 1, 1);
    const uv = geometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setY(i, 0.5);

    expect(() => uvBand(geometry)).toThrow("no height");
  });
});

describe("uvLengthU", () => {
  it("reports the world length one unit of u covers", () => {
    // A strip 6 long whose u runs 0..1 across it: one unit of u is 6 units of
    // world, so anything moving at 6/s crosses it in a second.
    const strip = new PlaneGeometry(6, 1, 8, 1);

    expect(uvLengthU(strip)).toBeCloseTo(6, 4);
  });

  it("ignores the belt's width, however the triangles are cut", () => {
    // A diagonal spans u and v both, and most of its length is width. Averaging
    // per-edge ratios over a strip this wide would report far more than 6.
    const wide = new PlaneGeometry(6, 20, 8, 1);

    expect(uvLengthU(wide)).toBeCloseTo(6, 4);
  });

  it("measures a stretched parameterization by its total, not its worst part", () => {
    // Real exports don't parameterize uniformly — the track's corners take a
    // smaller share of u than their length. Here the middle two quarters are
    // squeezed into a tenth of u each, so their local rate is four times the
    // outer ones'. A median or mean of those rates lands near 9; the strip is
    // still 6 units long over a full turn of u.
    const strip = new PlaneGeometry(6, 1, 4, 1);
    const uv = strip.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      if (u > 0.2 && u < 0.3) uv.setX(i, 0.4);
      if (u > 0.7 && u < 0.8) uv.setX(i, 0.6);
    }

    expect(uvLengthU(strip)).toBeCloseTo(6, 4);
  });

  it("throws rather than measuring geometry it cannot", () => {
    const noUv = new PlaneGeometry(6, 1, 8, 1);
    noUv.deleteAttribute("uv");
    expect(() => uvLengthU(noUv)).toThrow("uv");

    // Every edge crosses most of u at once: a seam, not a step along the strip.
    expect(() => uvLengthU(new PlaneGeometry(6, 1, 1, 1))).toThrow("along u");
  });
});
