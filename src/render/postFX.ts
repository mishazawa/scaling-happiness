import type { Camera, Data3DTexture, Scene, WebGLRenderer } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { LUTPass } from "three/examples/jsm/postprocessing/LUTPass.js";

/** A parsed `.cube` LUT: the size of one edge of the 3D grid, plus the grid itself. */
export type LUT = {
  size: number;
  texture3D: Data3DTexture;
};

export type PostFX = {
  lutPass: LUTPass;
  setSize(width: number, height: number): void;
  render(): void;
};

/**
 * Builds the composer chain that applies color grading to the whole view:
 * render the scene, then OutputPass bakes in the tone mapping / color space
 * transform the renderer normally applies for free (EffectComposer's raw
 * shader passes skip that), and only then does the LUT run — a `.cube` LUT
 * is authored against display-referred sRGB values, not the linear buffer
 * RenderPass produces, so it has to sample *after* the output transform.
 * `ShaderPass` writes `gl_FragColor` directly, so putting LUTPass last adds
 * no further encoding on the way to the canvas.
 */
export function createPostFX(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  lut: LUT,
): PostFX {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());

  const lutPass = new LUTPass({ lut: lut.texture3D, intensity: 1 });
  composer.addPass(lutPass);

  return {
    lutPass,
    setSize(width, height) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(width, height);
    },
    render() {
      composer.render();
    },
  };
}
