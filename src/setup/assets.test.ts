import { describe, expect, it } from "vitest";
import { LUTCubeLoader } from "three/examples/jsm/loaders/LUTCubeLoader.js";
import tealOrangeCube from "../assets/teal-orange.cube?raw";

describe("teal-orange.cube", () => {
  it("parses into a well-formed 3D LUT", () => {
    const { size, texture3D } = new LUTCubeLoader().parse(tealOrangeCube);
    const data = texture3D.image.data!;

    expect(size).toBe(17);
    expect(texture3D.image.width).toBe(size);
    expect(texture3D.image.height).toBe(size);
    expect(texture3D.image.depth).toBe(size);
    expect(data.length).toBe(size ** 3 * 4);
    expect(Math.max(...data)).toBeLessThanOrEqual(255);
    expect(Math.min(...data)).toBeGreaterThanOrEqual(0);
  });
});
