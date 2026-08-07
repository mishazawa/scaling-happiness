import { describe, expect, it } from "vitest";
import {
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  ShaderLib,
  SRGBColorSpace,
  Texture,
  UniformsUtils,
  type WebGLProgramParametersWithUniforms,
} from "three";
import {
  paletteMaterial,
  setCausticTexture,
  uniforms,
  withCaustics,
} from "./materials";
import {
  SHADER_CAUSTIC_DRIFT_A,
  SHADER_CAUSTIC_DRIFT_B,
  SHADER_CAUSTIC_LAYER_RATIO,
} from "../constants";

/**
 * Runs a material's `onBeforeCompile` against three's *real* standard-material
 * shader source. Every injection here is a `String.replace` on an `#include`,
 * which fails silently if the token ever moves or is renamed — the assertions
 * below are what turn that into a test failure instead of an untextured mesh.
 */
function compileHook(material: MeshStandardMaterial) {
  const shader = {
    uniforms: UniformsUtils.clone(ShaderLib.physical.uniforms),
    vertexShader: ShaderLib.physical.vertexShader,
    fragmentShader: ShaderLib.physical.fragmentShader,
  } as WebGLProgramParametersWithUniforms;

  material.onBeforeCompile(shader, null as never);
  return shader;
}

describe("paletteMaterial", () => {
  it("binds the palette texture and its dimensions as uniforms", () => {
    const shader = compileHook(paletteMaterial());

    const texture = uniforms.uPalette.value;

    expect(shader.uniforms.uPalette.value).toBe(texture);
    // The size uniform has to track the texture that was actually built, or the
    // shader samples the wrong texel for every instance.
    expect(shader.uniforms.uPaletteSize.value.x).toBe(texture.image.width);
    expect(shader.uniforms.uPaletteSize.value.y).toBe(texture.image.height);
  });

  it("shares the uniform objects by reference across every compiled program", () => {
    // One material serves every model and compiles more than one program
    // variant, so runtime edits go to the module-scope object. If the uniforms
    // were cloned in, this would still read the value it was compiled with.
    const first = compileHook(paletteMaterial());
    const second = compileHook(paletteMaterial());

    uniforms.uTime.value = 12.5;

    expect(first.uniforms.uTime.value).toBe(12.5);
    expect(second.uniforms.uTime.value).toBe(12.5);

    uniforms.uTime.value = 0;
  });

  it("declares the per-vertex and per-instance attributes and passes them through", () => {
    const shader = compileHook(paletteMaterial());

    expect(shader.vertexShader).toContain("attribute float aID;");
    expect(shader.vertexShader).toContain("attribute float aRow;");
    expect(shader.vertexShader).toContain("attribute float aPhase;");
    // vID must not interpolate, or colour regions bleed into each other.
    expect(shader.vertexShader).toContain("flat varying float vID;");
    expect(shader.vertexShader).toContain("vID = aID;");
    expect(shader.vertexShader).toContain("vRow = aRow;");

    // The pass-through and the idle deformation have to land *after*
    // begin_vertex, not replace it, so instancing and projection pick them up.
    expect(shader.vertexShader).toContain("#include <begin_vertex>");
    expect(shader.vertexShader.indexOf("vID = aID;")).toBeGreaterThan(
      shader.vertexShader.indexOf("#include <begin_vertex>"),
    );
    expect(shader.vertexShader).toContain("aPhase");
  });

  it("replaces color_fragment with a palette lookup", () => {
    const shader = compileHook(paletteMaterial());

    expect(shader.fragmentShader).toContain("uniform sampler2D uPalette;");
    expect(shader.fragmentShader).toContain("flat varying float vID;");
    expect(shader.fragmentShader).toContain(
      "diffuseColor.rgb = texture2D(uPalette, puv).rgb;",
    );
    // The stock colour path must be gone, or it would overwrite the lookup.
    expect(shader.fragmentShader).not.toContain("#include <color_fragment>");
  });

  it("keeps the palette patch and the caustics on the one hook", () => {
    // `onBeforeCompile` is a single slot, so this is the assertion that a second
    // patch composed with the first rather than overwriting it.
    const shader = compileHook(paletteMaterial());

    expect(shader.fragmentShader).toContain(
      "diffuseColor.rgb = texture2D(uPalette, puv).rgb;",
    );
    expect(shader.fragmentShader).toContain("texture2D(uCaustics,");
    // The idle breathing deforms `transformed`; the world position the caustics
    // are sampled at has to be read after that, or a model would slide through
    // the bands as it inflates.
    expect(shader.vertexShader.indexOf("vCausticWorld =")).toBeGreaterThan(
      shader.vertexShader.indexOf("transformed *= 1.0 + breath"),
    );
  });
});

/** How many times `needle` occurs in `source`. */
function occurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

describe("withCaustics", () => {
  it("patches a bare standard material, declaring each global exactly once", () => {
    const shader = compileHook(withCaustics(new MeshStandardMaterial()));

    // Duplicate declarations at global scope are a hard GLSL compile error, and
    // there is no browser here to catch one — a `toContain` would pass with two.
    expect(occurrences(shader.fragmentShader, "uniform float uTime;")).toBe(1);
    expect(
      occurrences(shader.fragmentShader, "uniform sampler2D uCaustics;"),
    ).toBe(1);
    expect(
      occurrences(shader.fragmentShader, "varying vec3 vCausticWorld;"),
    ).toBe(1);
    expect(
      occurrences(shader.vertexShader, "varying vec3 vCausticWorld;"),
    ).toBe(1);
  });

  it("samples the tile twice, at different scales and drifts", () => {
    const shader = compileHook(withCaustics(new MeshStandardMaterial()));

    // The texture tiles, so one sample would draw a visible grid on the ground.
    // Two layers beating against each other is the entire defence, and it only
    // works while they differ in *both* scale and direction — a careless edit
    // that collapses them into one fetch, or gives them the same scale, brings
    // the lattice straight back.
    expect(occurrences(shader.fragmentShader, "texture2D(uCaustics,")).toBe(2);
    expect(shader.fragmentShader).toContain(
      `causticUv * ${SHADER_CAUSTIC_LAYER_RATIO.toFixed(6)}`,
    );
    expect(SHADER_CAUSTIC_LAYER_RATIO).not.toBe(1);
    // Opposed in x, so the two layers shear past each other rather than sliding
    // together as one image.
    expect(Math.sign(SHADER_CAUSTIC_DRIFT_A[0])).not.toBe(
      Math.sign(SHADER_CAUSTIC_DRIFT_B[0]),
    );
  });

  it("takes the tile by reference, so it reaches shaders already compiled", () => {
    // The load order this leans on: `paletteMaterial` is built by
    // `modelRegistry`, which cannot reach the loader, so main.ts pushes the
    // texture in afterwards and every program built either side must see it.
    const shader = compileHook(withCaustics(new MeshStandardMaterial()));
    const previous = uniforms.uCaustics.value;

    const tile = new Texture();
    // Handed in already marked as colour, so the assertion below has something
    // to overwrite — `NoColorSpace` is a texture's default, and asserting it on
    // an untouched one would pass whatever the setter did.
    tile.colorSpace = SRGBColorSpace;
    setCausticTexture(tile);

    expect(shader.uniforms.uCaustics.value).toBe(tile);
    // Repeat wrapping is what makes a tile a tile; without it the texture is
    // clamped and the caustics smear into streaks past the first tile's edge.
    expect(tile.wrapS).toBe(RepeatWrapping);
    expect(tile.wrapT).toBe(RepeatWrapping);
    // A mask, not colour: an sRGB decode would bend the values the shader
    // multiplies the light by.
    expect(tile.colorSpace).toBe(NoColorSpace);

    uniforms.uCaustics.value = previous;
  });

  it("runs an existing hook rather than replacing it", () => {
    const material = new MeshStandardMaterial();
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        "#include <common>\n// prior patch",
      );
    };

    const shader = compileHook(withCaustics(material));

    expect(shader.fragmentShader).toContain("// prior patch");
    expect(shader.fragmentShader).toContain("texture2D(uCaustics,");
  });

  it("takes the shared clock by reference instead of a uniform of its own", () => {
    const shader = compileHook(withCaustics(new MeshStandardMaterial()));

    uniforms.uTime.value = 3.5;
    expect(shader.uniforms.uTime.value).toBe(3.5);
    uniforms.uTime.value = 0;
  });

  it("carries the world position through to the fragment stage itself", () => {
    const shader = compileHook(withCaustics(new MeshStandardMaterial()));

    // three's own vWorldPosition is compiled out unless the material has an env
    // map or a shadow, so the varying has to be filled here.
    expect(shader.vertexShader).toContain(
      "vCausticWorld = (modelMatrix * causticWorld).xyz;",
    );
    // Instanced models carry their placement on instanceMatrix alone, so a
    // world position that skipped it would put every pawn at the origin's band.
    expect(shader.vertexShader).toContain("causticWorld = instanceMatrix");
  });

  it("brightens the accumulated direct light rather than a spent directLight", () => {
    const shader = compileHook(withCaustics(new MeshStandardMaterial()));

    // Appended, not replaced: the chunk is what accumulates the indirect light
    // this then leaves alone.
    expect(shader.fragmentShader).toContain("#include <lights_fragment_end>");

    // The usual form of this patch scales `directLight` after
    // <lights_fragment_begin>, where every RE_Direct that reads it has already
    // run, so it changes a value nothing looks at again. Pinned as: the
    // modulation comes after the last light has been accumulated.
    expect(
      shader.fragmentShader.indexOf("reflectedLight.directDiffuse *="),
    ).toBeGreaterThan(shader.fragmentShader.lastIndexOf("RE_Direct("));
  });

  it("distinguishes itself in the program cache", () => {
    // three keys compiled programs on a material's parameters and never on its
    // onBeforeCompile, so without this a patched material and an identically
    // configured unpatched one — the ground and the track's static half — would
    // be handed the same program.
    const plain = new MeshStandardMaterial();
    const patched = withCaustics(new MeshStandardMaterial());

    expect(patched.customProgramCacheKey()).not.toBe(
      plain.customProgramCacheKey(),
    );
  });
});
