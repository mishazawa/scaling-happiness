import {
  ClampToEdgeWrapping,
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
  type Texture,
} from "three";
import { makePaletteDataTexture } from "../utils/paletteTexture";
import {
  SHADER_BREATH_AMP,
  SHADER_BREATH_FREQ,
  SHADER_CAUSTIC_ANISOTROPY,
  SHADER_CAUSTIC_DRIFT_A,
  SHADER_CAUSTIC_DRIFT_B,
  SHADER_CAUSTIC_GAIN,
  SHADER_CAUSTIC_LAYER_RATIO,
  SHADER_CAUSTIC_SCALE,
  SHADER_CAUSTIC_SPEED,
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
  // Filled by `setCausticTexture` once the loader has it; null until then.
  uCaustics: { value: null as Texture | null },
};

/**
 * Hands the baked caustics tile to every material patched by `withCaustics`,
 * present and future.
 *
 * A setter rather than an argument because of the layering: `paletteMaterial` is
 * built from `render/modelRegistry.ts`, which may not reach `setup/assets.ts` to
 * ask the loader for a texture. `main.ts` can reach both, so it pushes the
 * texture down here instead — and since the uniform object is merged into every
 * compiled program *by reference*, materials built before this call pick it up
 * just the same.
 *
 * The texture is configured here rather than by the loader, per the convention
 * in `setup/assets.ts`: wrapping, filtering and colour space belong to whoever
 * draws with it. `RepeatWrapping` is what makes a tile a tile, and
 * `NoColorSpace` is set rather than left at whatever the loader gave — this is a
 * mask, not colour, and an sRGB decode would bend the values the light is
 * multiplied by.
 */
export function setCausticTexture(texture: Texture) {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = SHADER_CAUSTIC_ANISOTROPY;
  texture.colorSpace = NoColorSpace;
  uniforms.uCaustics.value = texture;
}

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

const CAUSTIC_VERT_DECL = /* glsl */ `
  varying vec3 vCausticWorld;
`;

/**
 * Injected after `<project_vertex>` rather than after `<begin_vertex>`, where a
 * vertex patch normally goes: `transformed` is finished by then — that chunk
 * only reads it to build `mvPosition` — so the world position picks up every
 * deformation another patch on the same material may have applied, whichever
 * order the two hooks happen to run in.
 *
 * Three's own `vWorldPosition` cannot be borrowed for this: `<worldpos_vertex>`
 * is compiled out unless the material has an env map, a shadow or a spot light,
 * none of which a caller is required to have. This is the same math, minus the
 * batching branch this project has no batched meshes for.
 */
const CAUSTIC_VERT_BODY = /* glsl */ `
  vec4 causticWorld = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    causticWorld = instanceMatrix * causticWorld;
  #endif
  vCausticWorld = (modelMatrix * causticWorld).xyz;
`;

const CAUSTIC_FRAG_DECL = /* glsl */ `
  uniform float uTime;
  uniform sampler2D uCaustics;
  varying vec3 vCausticWorld;
`;

/**
 * Appended *after* `<lights_fragment_end>`, and it has to be there rather than
 * after `<lights_fragment_begin>` where a patch like this is usually shown:
 * `directLight` is declared inside that chunk and every `RE_Direct` call that
 * consumes it also happens inside it, so scaling it afterwards changes a value
 * nothing will read again. By the end of `<lights_fragment_end>` the light has
 * been accumulated into `reflectedLight`, and `directDiffuse` is still read
 * after that (into `totalDiffuse`), so this is the last point where brightening
 * it still shows up on screen.
 *
 * Scaling `directDiffuse` alone — not the indirect terms — is also what makes
 * the caustics behave: shadowing and the N·L falloff are already folded into it,
 * so the bands stop at a shadow's edge and fade off surfaces turned away from
 * the light, instead of glowing on the underside of everything.
 *
 * Sampled in world x/z, which projects the pattern straight down as if cast from
 * a surface overhead. That means it is fixed to the world rather than to the
 * model: pawns swim through the bands, and a block keeps whichever band it sits
 * under.
 *
 * Two samples of the one tile, at scales in a deliberately awkward ratio and
 * drifting different ways — that is the whole defence against a tiling texture
 * reading as a tiled floor, and collapsing it to a single fetch brings the grid
 * straight back. See SHADER_CAUSTIC_LAYER_RATIO.
 *
 * Multiplied rather than added: both layers have to agree for a filament to be
 * bright, which keeps them thin and moving. Added, they fill in to an even wash.
 * The `2.0` is because the product of two mostly-dark fields is darker than
 * either — it brings the combined field back to roughly the brightness one layer
 * had, leaving GAIN to mean what it says.
 */
const CAUSTIC_FRAG_BODY = /* glsl */ `
  #include <lights_fragment_end>

  vec2 causticUv = vCausticWorld.xz * ${SHADER_CAUSTIC_SCALE.toFixed(6)};
  float causticDrift = uTime * ${SHADER_CAUSTIC_SPEED.toFixed(6)};
  float causticA = texture2D(uCaustics, causticUv + vec2(${SHADER_CAUSTIC_DRIFT_A[0].toFixed(6)}, ${SHADER_CAUSTIC_DRIFT_A[1].toFixed(6)}) * causticDrift).r;
  float causticB = texture2D(uCaustics, causticUv * ${SHADER_CAUSTIC_LAYER_RATIO.toFixed(6)} + vec2(${SHADER_CAUSTIC_DRIFT_B[0].toFixed(6)}, ${SHADER_CAUSTIC_DRIFT_B[1].toFixed(6)}) * causticDrift).r;
  float causticMask = causticA * causticB * 2.0;

  reflectedLight.directDiffuse *= 1.0 + causticMask * ${SHADER_CAUSTIC_GAIN.toFixed(6)};
`;

/**
 * Lays the fake caustics over any `MeshStandardMaterial` — the rippling bands a
 * water surface throws onto what is under it — and hands the same material back.
 *
 * Written as a patch rather than a material of its own because the surfaces that
 * want it have nothing else in common: the instanced models take their colour
 * from a palette LUT, the ground is a flat colour. Each keeps whatever it
 * already was and gains the bands on top.
 *
 * It **composes** with a hook the material already has, rather than replacing
 * it: `onBeforeCompile` is a single slot, so a second plain assignment would
 * silently drop the first patch (for `paletteMaterial`, the palette lookup and
 * the breathing both). The existing hook runs first, then these replacements are
 * applied to whatever it produced.
 *
 * Two consequences worth knowing before calling it:
 *
 *   - It declares `uTime`, `uCaustics` and `vCausticWorld` at global scope, so a
 *     material that already declares any of those, or that is patched twice,
 *     fails to compile. The tests count the declarations for exactly this.
 *   - The clock is the shared `uniforms.uTime`, merged by reference, so the
 *     bands stay in step with the fish's breathing and the track's arrows.
 *     Nothing here writes it; `renderSystem` remains the only writer. The tile
 *     comes the same way — `setCausticTexture` must have been called, which
 *     `main.ts` does once the loader returns.
 *
 * `customProgramCacheKey` is extended too, and that part is not optional: three
 * keys its compiled-program cache on the material's parameters and never on
 * `onBeforeCompile`, so a patched material would otherwise be handed the cached
 * program of an unpatched one that happened to be configured identically — the
 * ground and the track's static half are exactly that pair.
 */
export function withCaustics<T extends MeshStandardMaterial>(material: T): T {
  const decorated = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    decorated(shader, renderer);

    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uCaustics = uniforms.uCaustics;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${CAUSTIC_VERT_DECL}`)
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>\n${CAUSTIC_VERT_BODY}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${CAUSTIC_FRAG_DECL}`)
      .replace("#include <lights_fragment_end>", CAUSTIC_FRAG_BODY);
  };

  const cacheKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${cacheKey()}|caustics`;

  return material;
}

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
 *
 * The fake caustics go on top, off the same `uTime` — see `withCaustics`, which
 * composes with the hook set here rather than replacing it.
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

  return withCaustics(material);
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
