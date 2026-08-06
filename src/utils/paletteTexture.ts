import {
  DataTexture,
  NearestFilter,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from "three";
import { PALETTES, PALETTES_IDX } from "../constants";

type PaletteName = keyof typeof PALETTES;
type Palettes = Record<PaletteName, readonly number[]>;
type PaletteIndex = Record<PaletteName, number>;

/**
 * Packs the palettes into an RGBA lookup texture, one palette per row.
 *
 * Layout: `col` is the ID slot within a palette (left to right), `row` is the
 * palette variant taken from `PALETTES_IDX`. `DataTexture` sets `flipY = false`,
 * so data row 0 is the *bottom* row in UV space. Shaders should sample with
 *
 *   u = (slot + 0.5) / width
 *   v = (paletteIdx + 0.5) / height
 *
 * The bytes are the raw sRGB hex values (0xf2c14e -> 242, 193, 78), and
 * `colorSpace = SRGBColorSpace` makes three upload them with an `SRGB8_ALPHA8`
 * internal format. Sampling therefore already yields linear-light values, which
 * is what makes them match `standardMaterial({ color })` — the shader must
 * **not** apply its own sRGB -> linear conversion on top.
 *
 * Width is the longest palette; shorter rows are padded with opaque black.
 */
export function makePaletteDataTexture(
  palettes: Palettes = PALETTES,
  paletteIdx: PaletteIndex = PALETTES_IDX,
): DataTexture {
  const names = Object.keys(palettes) as PaletteName[];
  const width = Math.max(...names.map((name) => palettes[name].length));
  const height = Math.max(...names.map((name) => paletteIdx[name])) + 1;

  const data = new Uint8Array(width * height * 4);
  // Opaque black everywhere first, so padding slots and unused rows are valid.
  for (let i = 3; i < data.length; i += 4) data[i] = 255;

  for (const name of names) {
    const row = paletteIdx[name];
    const colors = palettes[name];
    for (let col = 0; col < colors.length; col++) {
      const color = colors[col];
      const i = (row * width + col) * 4;
      data[i + 0] = (color >> 16) & 0xff;
      data[i + 1] = (color >> 8) & 0xff;
      data[i + 2] = color & 0xff;
      data[i + 3] = 255;
    }
  }

  const texture = new DataTexture(
    data,
    width,
    height,
    RGBAFormat,
    UnsignedByteType,
  );
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
