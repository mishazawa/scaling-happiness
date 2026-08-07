import {
  ClampToEdgeWrapping,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
  type Texture,
} from "three";
import { makePaletteDataTexture } from "../utils/paletteTexture";
import {
  SHADER_BREATH_AMP,
  SHADER_BREATH_FREQ,
  TRACK_ARROW_ANISOTROPY,
  TRACK_ARROW_REPEAT,
  TRACK_SPEED,
} from "../constants";

/** Anything `MeshStandardMaterial` accepts as a colour, e.g. `"#FFF"`, `0xff3b77`. */
type ColorSpec = string | number;

/**
 * Shared material cache, keyed by colour.
 *
 * Intentionally never cleared: the non-instanced scene dressing draws with
 * these, so the cache reaches a handful of entries during the first game and
 * never grows — restarts reuse the same materials rather than accumulating new
 * ones. Disposal would also be unsafe here, since a restart tears the scene down
 * while these materials are still referenced by the objects being removed.
 *
 * Because entries are shared and keyed by colour alone, nothing may mutate a
 * material it got from here — a `side` or `roughness` tweak for one object would
 * follow the colour everywhere. Callers needing anything but the defaults build
 * their own material (see `trackStaticMaterial`).
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

/**
 * The track's static half: a flat colour, on its own material instance rather
 * than out of the colour-keyed cache above, so the two halves stay independently
 * tweakable without a change to one following its colour onto everything else
 * drawn in it.
 */
export function trackStaticMaterial(color: ColorSpec): MeshStandardMaterial {
  return new MeshStandardMaterial({ color });
}

/**
 * A plain PBR material for surfaces whose whole look *is* their reflectance —
 * the pearl's gold shell and its glossy bead.
 *
 * Its own instance every call, never out of the colour-keyed cache above: the
 * cache is keyed by colour alone and its entries are shared, so a `metalness` or
 * `roughness` set on one of them would follow that colour onto everything else
 * drawn in it.
 *
 * There is no environment map, here or on the scene: the light is one
 * directional plus an ambient fill, so these two numbers are judged against a
 * single specular highlight rather than a reflection. That is what keeps the
 * metalness below a full 1 — see PEARL_SHELL_METALNESS.
 */
export function reflectiveMaterial(
  color: ColorSpec,
  metalness: number,
  roughness: number,
): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, metalness, roughness });
}

const TRACK_FRAG_DECL = /* glsl */ `
  uniform float uTime;
`;

/**
 * Replaces `<map_fragment>` — the chunk that samples `map` into `diffuseColor` —
 * with the same sample taken from a uv that slides along `u` over time. That is
 * what makes the arrows crawl.
 *
 * It has to be this chunk rather than the `<color_fragment>` hook below, and the
 * shift has to happen at the sample: `vMapUv` is a varying, which GLSL ES 3.00
 * makes read-only in a fragment shader, so it cannot be nudged in place.
 *
 * `tiles` is a speed in *tiles per second*, matching `vMapUv`'s space — three
 * has already folded `repeat`/`offset` into that varying, so a shift of 1 here
 * is one whole arrow, not one belt.
 *
 * Subtracted, not added: sampling further along the texture pulls the image
 * *backwards*, and the arrows have to travel the way the pawns do. `toFixed`
 * because an interpolated whole number would emit `7`, an int literal, and fail
 * to compile against a float.
 *
 * The `#ifdef` mirrors the chunk being replaced. It is always true here — `map`
 * is set in the constructor — but a material with no map that lost its guard
 * would fail to compile rather than simply drawing untextured.
 */
const trackMapFragment = (tiles: number) => /* glsl */ `
  #ifdef USE_MAP
    vec2 trackUv = vMapUv - vec2(uTime * ${tiles.toFixed(6)}, 0.0);
    float wobble = sin(trackUv.x * 6.2831853 + uTime * 2.0) * 0.1
                 + sin(trackUv.x * 15.0 - uTime * 3.3) * 0.01;
    trackUv.y += wobble;
    diffuseColor *= texture2D(map, trackUv);
  #endif
`;

/**
 * `<color_fragment>` is re-included rather than dropped, unlike the palette
 * material's replacement, because it is still what applies the material colour.
 * Nothing else happens here: the animation lives in the map sample above, which
 * runs earlier in the shader.
 */
const TRACK_FRAG_BODY = /* glsl */ `
  #include <color_fragment>
`;

/**
 * The track's moving half: the arrow texture stretched onto the belt, crawling
 * along it at pawn speed off the *same* `uTime` as the palette material.
 *
 * Sharing the clock matters — the arrows and the fish's idle breathing must not
 * drift apart — and it comes from merging the module-level
 * `uniforms` object by reference, exactly as `paletteMaterial` does. This
 * material must never declare a `uTime` of its own, and nothing here may capture
 * the `shader` handle; see the note on `uniforms` for why. `renderSystem`
 * remains the only writer.
 *
 * The texture is *transformed onto* the belt rather than the belt's uvs being
 * rewritten. Three applies `uv * repeat + offset` in the shader, so `band`
 * (measured off the geometry by `uvBand`) becomes a `repeat.y` that expands the
 * belt's thin slice of the export's shared layout back to the texture's full
 * height, and an `offset.y` that slides that slice's start to zero.
 *
 * Along the belt (`u`, which does span 0..1) the tile simply repeats, hence
 * `RepeatWrapping` on S. Across it, `ClampToEdgeWrapping`: `repeat.y` is ~27, so
 * a repeating T would stack 27 squashed arrows across a belt 1.5 units wide.
 *
 * The scroll is baked into the shader as a literal rather than carried on a
 * uniform: it is fixed for the life of the material, and `lengthU` is only known
 * once the geometry has been measured, which is why the GLSL is a function.
 *
 * No `color`: the PNG is opaque and already the colour it wants to be, so a tint
 * could only muddy it. `map` is passed to the constructor, not assigned after —
 * an assignment would need `needsUpdate` to make three recompile with `USE_MAP`.
 */
export function trackMovingMaterial(
  map: Texture,
  band: { min: number; max: number },
  lengthU: number,
): MeshStandardMaterial {
  const height = band.max - band.min;
  // Pawn speed is in world units per second; `lengthU` is how many world units
  // one unit of `u` covers, and `repeat.x` how many tiles fit in that unit.
  const tilesPerSecond = (TRACK_SPEED / lengthU) * TRACK_ARROW_REPEAT;

  map.wrapS = RepeatWrapping;
  map.wrapT = ClampToEdgeWrapping;
  map.colorSpace = SRGBColorSpace;
  map.repeat.set(TRACK_ARROW_REPEAT, 1 / height);
  map.offset.set(0, -band.min / height);
  // The belt is seen at a grazing angle from a tilted camera, which is exactly
  // where an un-anisotropic mip turns rows of arrows into mush.
  map.anisotropy = TRACK_ARROW_ANISOTROPY;

  const material = new MeshStandardMaterial({ map });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${TRACK_FRAG_DECL}`)
      .replace("#include <map_fragment>", trackMapFragment(tilesPerSecond))
      .replace("#include <color_fragment>", TRACK_FRAG_BODY);
  };

  return material;
}
