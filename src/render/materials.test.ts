import { describe, expect, it } from "vitest";
import {
  ShaderLib,
  UniformsUtils,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { paletteMaterial, uniforms } from "./materials";

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
    const shader = compileHook(paletteMaterial());

    expect(shader.uniforms.uPalette.value).toBe(uniforms.uPalette.value);
    expect(shader.uniforms.uPaletteSize.value.x).toBe(4);
    expect(shader.uniforms.uPaletteSize.value.y).toBe(2);
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
});
