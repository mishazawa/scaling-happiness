import { describe, expect, it } from "vitest";
import { PixelatePass } from "./pixelatePass";

describe("PixelatePass", () => {
  it("defaults to the given pixel size and exposes it as a live uniform", () => {
    const pass = new PixelatePass(6);

    expect(pass.pixelSize).toBe(6);
    expect(pass.uniforms.pixelSize.value).toBe(6);
  });

  it("updates the shared uniform when the pixel size is changed", () => {
    const pass = new PixelatePass();

    pass.pixelSize = 10;

    expect(pass.uniforms.pixelSize.value).toBe(10);
  });

  it("tracks the device-pixel resolution through setSize", () => {
    const pass = new PixelatePass();

    pass.setSize(1920, 1080);

    expect(pass.uniforms.resolution.value.x).toBe(1920);
    expect(pass.uniforms.resolution.value.y).toBe(1080);
  });
});
