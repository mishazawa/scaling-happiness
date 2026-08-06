import { describe, expect, it } from "vitest";
import { BoxGeometry, BufferAttribute } from "three";
import { COLOR_ATTRIBUTE, PAWN_MODEL_RADIUS } from "../constants";
import { prepareGeometry } from "./geometry";

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
});
