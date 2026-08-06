import { MeshStandardMaterial, Vector2, type DataTexture } from "three";
import type { BlockColor } from "../core/Block";

/**
 * Shared material cache, keyed by colour.
 *
 * Intentionally never cleared: the game's whole palette is the two checkerboard
 * colours, so this reaches two entries during the first game and never grows —
 * restarts reuse the same materials rather than accumulating new ones. Disposal
 * would also be unsafe here, since a restart tears the scene down while these
 * materials are still referenced by the objects being removed.
 */
const materialsByColor = new Map<BlockColor, MeshStandardMaterial>();

export function standardMaterial(color: BlockColor): MeshStandardMaterial {
  let material = materialsByColor.get(color);
  if (!material) {
    material = new MeshStandardMaterial({ color });
    materialsByColor.set(color, material);
  }
  return material;
}

/**
 * A `MeshStandardMaterial` that reads its base colour out of the palette LUT
 * built by `makePaletteDataTexture`, instead of a single fixed colour.
 *
 * Geometry drives the lookup through two float attributes:
 *   - `aID`  — the colour slot within a palette (the texture's column)
 *   - `aRow` — the palette variant, i.e. a `PALETTES_IDX` value (the row)
 *
 * Both are `flat` varyings, so the value is taken from the provoking vertex and
 * never interpolated across a triangle — a region-tagged mesh gets hard colour
 * boundaries rather than gradients between slots. Geometry that declares
 * neither attribute gets 0 for both, which is row 0 / slot 0 of the palette.
 *
 * Sampling matches the texture's documented convention, `(x + 0.5) / size`.
 * The LUT uploads as `SRGB8_ALPHA8`, so `texture2D` already returns linear-light
 * values, as does `diffuseColor` at this point — the plain multiply is correct
 * and no colour-space conversion belongs here.
 *
 * Note this replaces `<color_fragment>`, so per-vertex `color` attributes are
 * ignored by this material; the palette is the only colour source.
 */
export function paletteMaterial(tex: DataTexture): MeshStandardMaterial {
  const { width, height } = tex.image;

  const material = new MeshStandardMaterial();

  material.onBeforeCompile = (shader) => {
    shader.uniforms.paletteTex = { value: tex };
    shader.uniforms.paletteSize = { value: new Vector2(width, height) };

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      /* glsl */ `
      #include <common>
      attribute float aID;
      attribute float aRow;
      flat varying float vID;
      flat varying float vRow;
      `,
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      /* glsl */ `
      #include <begin_vertex>
      vID = aID;
      vRow = aRow;
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      /* glsl */ `
      #include <common>
      uniform sampler2D paletteTex;
      uniform vec2 paletteSize;
      flat varying float vID;
      flat varying float vRow;
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      /* glsl */ `
      vec2 puv = vec2(
        (vID + 0.5) / paletteSize.x,
        (vRow + 0.5) / paletteSize.y
      );
      diffuseColor.rgb *= texture2D(paletteTex, puv).rgb;
      `,
    );

    // Keep a handle so callers can edit the uniforms at runtime.
    material.userData.shader = shader;
  };

  return material;
}