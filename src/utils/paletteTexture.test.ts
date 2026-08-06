import { describe, expect, it } from "vitest";
import { NearestFilter } from "three";
import { PALETTES, PALETTES_IDX } from "../constants";
import { makePaletteDataTexture } from "./paletteTexture";

function pixel(
  data: ArrayLike<number> | null,
  width: number,
  row: number,
  col: number,
) {
  if (!data) throw new Error("texture has no pixel data");
  const i = (row * width + col) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

describe("makePaletteDataTexture", () => {
  it("encodes each palette as its PALETTES_IDX row", () => {
    const texture = makePaletteDataTexture();
    const { width, height, data } = texture.image;

    expect(width).toBe(4);
    expect(height).toBe(2);

    for (const [name, row] of Object.entries(PALETTES_IDX)) {
      const colors = PALETTES[name as keyof typeof PALETTES];
      colors.forEach((color, col) => {
        expect(pixel(data, width, row, col)).toEqual([
          (color >> 16) & 0xff,
          (color >> 8) & 0xff,
          color & 0xff,
          255,
        ]);
      });
    }

    // koi is row 0 — the bottom row, since DataTexture does not flip Y.
    expect(texture.flipY).toBe(false);
    expect(pixel(data, width, 0, 0)).toEqual([0xfa, 0x67, 0x81, 255]);
  });

  it("follows PALETTES_IDX rather than declaration order", () => {
    const texture = makePaletteDataTexture(
      { koi: [0x010203], tide: [0x040506] },
      { koi: 1, tide: 0 },
    );
    const { width, data } = texture.image;

    expect(pixel(data, width, 0, 0)).toEqual([0x04, 0x05, 0x06, 255]);
    expect(pixel(data, width, 1, 0)).toEqual([0x01, 0x02, 0x03, 255]);
  });

  it("sizes to the longest palette and pads short rows with opaque black", () => {
    const texture = makePaletteDataTexture(
      { koi: [0xff0000, 0x00ff00, 0x0000ff], tide: [0x123456] },
      { koi: 0, tide: 1 },
    );
    const { width, height, data } = texture.image;

    expect(width).toBe(3);
    expect(height).toBe(2);
    expect(pixel(data, width, 1, 0)).toEqual([0x12, 0x34, 0x56, 255]);
    expect(pixel(data, width, 1, 1)).toEqual([0, 0, 0, 255]);
    expect(pixel(data, width, 1, 2)).toEqual([0, 0, 0, 255]);
  });

  it("samples without blending between slots or palettes", () => {
    const texture = makePaletteDataTexture();
    expect(texture.magFilter).toBe(NearestFilter);
    expect(texture.minFilter).toBe(NearestFilter);
    expect(texture.generateMipmaps).toBe(false);
  });
});
