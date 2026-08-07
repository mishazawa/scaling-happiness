import type { Camera, Data3DTexture, Scene, WebGLRenderer } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { LUTPass } from "three/examples/jsm/postprocessing/LUTPass.js";
import { PixelatePass } from "./pixelatePass";

/** A parsed `.cube` LUT: the size of one edge of the 3D grid, plus the grid itself. */
export type LUT = {
  size: number;
  texture3D: Data3DTexture;
};

export type PostFXOptions = {
  /**
   * Mosaic block size in CSS pixels (device-pixel-ratio independent, so the
   * look is consistent across screens); 1 disables the pixelation look.
   */
  pixelSize?: number;
};

export type PostFX = {
  lutPass: LUTPass;
  pixelatePass: PixelatePass;
  setSize(width: number, height: number): void;
  /** Sets the mosaic block size in CSS pixels; converted to device pixels internally. */
  setPixelScale(cssPixels: number): void;
  render(): void;
};

/**
 * Builds the composer chain that applies color grading and a pixel-art look
 * to the whole view: render the scene, then OutputPass bakes in the tone
 * mapping / color space transform the renderer normally applies for free
 * (EffectComposer's raw shader passes skip that), then the LUT runs — a
 * `.cube` LUT is authored against display-referred sRGB values, not the
 * linear buffer RenderPass produces, so it has to sample *after* the output
 * transform — and finally PixelatePass mosaics the already-graded image.
 * `ShaderPass` writes `gl_FragColor` directly, so chaining raw shader passes
 * like this adds no further encoding on the way to the canvas.
 */
export function createPostFX(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  lut: LUT,
  options: PostFXOptions = {},
): PostFX {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());

  const lutPass = new LUTPass({ lut: lut.texture3D, intensity: 1 });
  composer.addPass(lutPass);

  const pixelatePass = new PixelatePass();
  composer.addPass(pixelatePass);

  let pixelScale = options.pixelSize ?? 1;

  function setPixelScale(cssPixels: number) {
    pixelScale = cssPixels;
    pixelatePass.pixelSize = pixelScale * renderer.getPixelRatio();
  }
  setPixelScale(pixelScale);

  return {
    lutPass,
    pixelatePass,
    setSize(width, height) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(width, height);
      // The pixel ratio may have changed (e.g. a window drag across
      // screens); reapply so the block size stays put in CSS pixels.
      setPixelScale(pixelScale);
    },
    setPixelScale,
    render() {
      composer.render();
    },
  };
}
