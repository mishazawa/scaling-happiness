import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { Vector2 } from "three";

const PixelateShader = {
  name: "PixelateShader",
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new Vector2() },
    pixelSize: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float pixelSize;

    varying vec2 vUv;

    void main() {
      vec2 blockSize = pixelSize / resolution;
      // Snap to each block's corner, then nudge in by half a *texel* (not
      // half a block) so the sample lands at a texel center instead of
      // straddling the boundary with the neighboring block — otherwise the
      // read buffer's bilinear filtering blends across blocks and the
      // mosaic comes out soft and offset instead of crisp.
      vec2 blockUv = blockSize * floor( vUv / blockSize ) + 0.5 / resolution;
      gl_FragColor = texture2D( tDiffuse, blockUv );
    }
  `,
};

/**
 * Mosaics the composited frame into square blocks of `pixelSize` device
 * pixels — a retro pixel-art look. Placed last in the chain so it downsamples
 * the final, already color-graded image rather than raw scene color.
 *
 * @three_import import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
 */
export class PixelatePass extends ShaderPass {
  constructor(pixelSize = 4) {
    super(PixelateShader);
    this.pixelSize = pixelSize;
  }

  /** Block size in device pixels; 1 disables the effect. */
  set pixelSize(v: number) {
    this.uniforms.pixelSize.value = v;
  }

  get pixelSize(): number {
    return this.uniforms.pixelSize.value;
  }

  override setSize(width: number, height: number) {
    this.uniforms.resolution.value.set(width, height);
  }
}
