import { describe, expect, it } from "vitest";
import { LUTCubeLoader } from "three/examples/jsm/loaders/LUTCubeLoader.js";
import lutCube from "../assets/my.cube?raw";

describe("my.cube", () => {
  it("parses into a well-formed 3D LUT", () => {
    const { size, texture3D } = new LUTCubeLoader().parse(lutCube);
    const data = texture3D.image.data!;

    expect(size).toBeGreaterThan(1);
    expect(texture3D.image.width).toBe(size);
    expect(texture3D.image.height).toBe(size);
    expect(texture3D.image.depth).toBe(size);
    expect(data.length).toBe(size ** 3 * 4);
    for (const v of data) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
  });
});
