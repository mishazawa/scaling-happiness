import { describe, expect, it } from "vitest";
import { ShaderLib, UniformsUtils, type WebGLProgramParametersWithUniforms } from "three";
import { makePaletteDataTexture } from "../utils/paletteTexture";
import { paletteMaterial } from "./materials";

/**
 * Runs a material's `onBeforeCompile` against three's *real* standard-material
 * shader source. Every injection here is a `String.replace` on an `#include`,
 * which fails silently if the token ever moves or is renamed — the assertions
 * below are what turn that into a test failure instead of an untextured mesh.
 */
function compileHook(material: ReturnType<typeof paletteMaterial>) {
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
    const texture = makePaletteDataTexture();
    const shader = compileHook(paletteMaterial(texture));

    expect(shader.uniforms.paletteTex.value).toBe(texture);
    expect(shader.uniforms.paletteSize.value.x).toBe(4);
    expect(shader.uniforms.paletteSize.value.y).toBe(2);
  });

  it("declares the slot attributes and passes them through as flat varyings", () => {
    const shader = compileHook(paletteMaterial(makePaletteDataTexture()));

    expect(shader.vertexShader).toContain("attribute float aID;");
    expect(shader.vertexShader).toContain("attribute float aRow;");
    expect(shader.vertexShader).toContain("flat varying float vID;");
    expect(shader.vertexShader).toContain("vID = aID;");
    expect(shader.vertexShader).toContain("vRow = aRow;");

    // The pass-through has to land after begin_vertex, not replace it.
    expect(shader.vertexShader).toContain("#include <begin_vertex>");
  });

  it("replaces color_fragment with a palette lookup", () => {
    const shader = compileHook(paletteMaterial(makePaletteDataTexture()));

    expect(shader.fragmentShader).toContain("uniform sampler2D paletteTex;");
    expect(shader.fragmentShader).toContain("flat varying float vRow;");
    expect(shader.fragmentShader).toContain(
      "diffuseColor.rgb *= texture2D(paletteTex, puv).rgb;",
    );
    // The stock colour path must be gone, or it would overwrite the lookup.
    expect(shader.fragmentShader).not.toContain("#include <color_fragment>");
  });

  it("keeps a handle on the shader for runtime uniform edits", () => {
    const material = paletteMaterial(makePaletteDataTexture());
    const shader = compileHook(material);

    expect(material.userData.shader).toBe(shader);
  });
});
