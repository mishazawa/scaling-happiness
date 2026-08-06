import { MeshStandardMaterial, Vector2 } from "three";
import { makePaletteDataTexture } from "../utils/paletteTexture";
import { SHADER_BREATH_AMP, SHADER_BREATH_FREQ } from "../constants";

/** Anything `MeshStandardMaterial` accepts as a colour, e.g. `"#FFF"`. */
type ColorSpec = string;

/**
 * Shared material cache, keyed by colour.
 *
 * Intentionally never cleared: only the non-instanced scene dressing draws with
 * these, so the cache reaches a handful of entries during the first game and
 * never grows — restarts reuse the same materials rather than accumulating new
 * ones. Disposal would also be unsafe here, since a restart tears the scene down
 * while these materials are still referenced by the objects being removed.
 */
const materialsByColor = new Map<ColorSpec, MeshStandardMaterial>();

export function standardMaterial(color: ColorSpec): MeshStandardMaterial {
  let material = materialsByColor.get(color);
  if (!material) {
    material = new MeshStandardMaterial({ color });
    materialsByColor.set(color, material);
  }
  return material;
}

const paletteTexture = makePaletteDataTexture();

/**
 * The palette shader's uniforms, held at module scope and merged **by
 * reference** into every compiled program (see `paletteMaterial`).
 *
 * Runtime edits (`uniforms.uTime.value = ...`) must go through this object, not
 * through a material's cached shader handle: one material is shared by every
 * model using the scheme, and three compiles a separate program per render-state
 * variant, so a captured `shader` reference points only at the most recently
 * compiled one.
 */
export const uniforms = {
  uPalette: { value: paletteTexture },
  uPaletteSize: {
    value: new Vector2(paletteTexture.image.width, paletteTexture.image.height),
  },
  uTime: { value: 0 },
};

const VERT_DECL = /* glsl */ `
  attribute float aID;
  attribute float aRow;
  attribute float aPhase;
  uniform float uTime;
  flat varying float vID;
  varying float vRow;
`;

const VERT_BODY = /* glsl */ `
  vID = aID;
  vRow = aRow;
  // Scaling is about the geometry origin, so it pushes the model's underside
  // down by (radius * amount) as well as up. The lift cancels that out, keeping
  // the model from sinking below its base — at MODEL_TARGET_RADIUS 0.75 and 3%,
  // the underside drops ~0.0225, so lift by a shade more.
  float breath = sin(uTime * ${SHADER_BREATH_FREQ} + aPhase) * 0.5 + 0.5;
  transformed *= 1.0 + breath * ${SHADER_BREATH_AMP};
  transformed.y += breath * 0.025;
`;

const FRAG_DECL = /* glsl */ `
  uniform sampler2D uPalette;
  uniform vec2 uPaletteSize;
  flat varying float vID;
  varying float vRow;
`;

const FRAG_BODY = /* glsl */ `
  vec2 puv = vec2((vID + 0.5) / uPaletteSize.x, (vRow + 0.5) / uPaletteSize.y);
  diffuseColor.rgb = texture2D(uPalette, puv).rgb;
`;

/**
 * A `MeshStandardMaterial` that reads its base colour out of the palette LUT
 * built by `makePaletteDataTexture`, instead of a single fixed colour.
 *
 * Two float attributes drive the lookup, at different frequencies:
 *   - `aID` — the colour slot within a palette (the texture's column). Per
 *     *vertex*, aliased from the model's exported `_color_id` by
 *     `prepareGeometry`, so one mesh can carry several colour regions.
 *   - `aRow` — the palette variant, i.e. a `PALETTES_IDX` value (the row). Per
 *     *instance*, written each frame by `renderSystem`, so instances of the
 *     same geometry can be different colours without a second material.
 *
 * `vID` is a `flat` varying: the value is taken from the provoking vertex and
 * never interpolated across a triangle, so region boundaries are hard edges
 * rather than gradients between slots. `vRow` is constant across an instance,
 * so ordinary interpolation is a no-op and it needs no qualifier. Geometry that
 * declares neither attribute gets 0 for both — row 0 / slot 0 of the palette.
 *
 * `aPhase` is the third per-instance attribute, offsetting the idle breathing
 * so instances don't animate in lockstep. The deformation is applied after
 * `<begin_vertex>`, which is what makes instancing and projection pick it up for
 * free. It is vertex-shader only, so the shadow pass (`MeshDepthMaterial`) sees
 * the undeformed mesh.
 *
 * Sampling matches the texture's documented convention, `(x + 0.5) / size`.
 * The LUT uploads as `SRGB8_ALPHA8`, so `texture2D` already returns linear-light
 * values, which is the space `diffuseColor` is in at this point — the plain
 * assignment is correct and no colour-space conversion belongs here.
 *
 * Note this replaces `<color_fragment>`, so per-vertex `color` attributes are
 * ignored by this material; the palette is the only colour source.
 */
export function paletteMaterial(): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    roughness: 0,
  });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERT_DECL}`)
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>\n${VERT_BODY}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAG_DECL}`)
      .replace("#include <color_fragment>", FRAG_BODY);
  };

  return material;
}
