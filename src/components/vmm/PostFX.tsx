'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { AdjustConfig, ShaderConfig } from '@/lib/vrm/constants';

export interface PostFXProps extends AdjustConfig {
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  shader: ShaderConfig;
}

const AdjustmentShader = {
  uniforms: {
    tDiffuse: { value: null },
    brightness: { value: 1 },
    saturation: { value: 1 },
    contrast: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float brightness;
    uniform float saturation;
    uniform float contrast;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);

      // Adjust in gamma (perceptual) space so the sliders feel natural.
      vec3 color = pow(max(texel.rgb, 0.0), vec3(1.0 / 2.2));

      color = (color - 0.5) * contrast + 0.5;
      color *= brightness;

      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luma), color, saturation);

      color = clamp(color, 0.0, 1.0);
      gl_FragColor = vec4(pow(color, vec3(2.2)), texel.a);
    }
  `,
};

// Fullscreen stylization: chromatic aberration (radial RGB split) and pixelation.
const StylizeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uChromatic: { value: 0 },
    uPixel: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uChromatic;
    uniform float uPixel;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;

      if (uPixel > 1.0) {
        vec2 block = vec2(uPixel) / uResolution;
        uv = (floor(uv / block) + 0.5) * block;
      }

      vec4 texel;
      if (uChromatic > 0.0) {
        vec2 dir = uv - 0.5;
        float dist = length(dir);
        vec2 offset = normalize(dir + 1e-6) * dist * uChromatic;
        vec4 center = texture2D(tDiffuse, uv);
        texel = vec4(
          texture2D(tDiffuse, uv + offset).r,
          center.g,
          texture2D(tDiffuse, uv - offset).b,
          center.a
        );
      } else {
        texel = texture2D(tDiffuse, uv);
      }

      gl_FragColor = texel;
    }
  `,
};

export function PostFX({
  brightness, saturation, contrast,
  bloomStrength = 0, bloomRadius = 0.4, bloomThreshold = 0.85,
  shader,
}: PostFXProps) {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);
  const passRef = useRef<ShaderPass | null>(null);
  const stylizeRef = useRef<ShaderPass | null>(null);
  const bloomRef = useRef<UnrealBloomPass | null>(null);

  useEffect(() => {
    const composer = new EffectComposer(gl);
    composer.addPass(new RenderPass(scene, camera));

    // HDR bloom: the scene renders to an offscreen target, so three skips
    // in-material tone mapping and bloom sees linear HDR values. OutputPass
    // applies tone mapping + color space at the very end.
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      bloomStrength, bloomRadius, bloomThreshold,
    );
    composer.addPass(bloom);

    const stylize = new ShaderPass(StylizeShader);
    composer.addPass(stylize);

    const pass = new ShaderPass(AdjustmentShader);
    composer.addPass(pass);
    composer.addPass(new OutputPass());

    composerRef.current = composer;
    passRef.current = pass;
    stylizeRef.current = stylize;
    bloomRef.current = bloom;
    return () => {
      composer.dispose();
      composerRef.current = null;
      passRef.current = null;
      stylizeRef.current = null;
      bloomRef.current = null;
    };
  }, [gl, scene, camera]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
    stylizeRef.current?.uniforms.uResolution.value.set(size.width, size.height);
  }, [gl, size.width, size.height]);

  useEffect(() => {
    const pass = passRef.current;
    if (pass) {
      pass.uniforms.brightness.value = brightness;
      pass.uniforms.saturation.value = saturation;
      pass.uniforms.contrast.value = contrast;
    }
  }, [brightness, saturation, contrast]);

  useEffect(() => {
    const bloom = bloomRef.current;
    if (!bloom) return;
    bloom.strength = bloomStrength;
    bloom.radius = bloomRadius;
    bloom.threshold = bloomThreshold;
  }, [bloomStrength, bloomRadius, bloomThreshold]);

  useEffect(() => {
    const stylize = stylizeRef.current;
    if (!stylize) return;
    stylize.uniforms.uChromatic.value =
      shader.preset === 'chromatic' ? shader.intensity * 0.03 : 0;
    stylize.uniforms.uPixel.value =
      shader.preset === 'pixel' ? Math.round(1 + shader.intensity * 23) : 1;
  }, [shader.preset, shader.intensity]);

  useFrame(() => {
    composerRef.current?.render();
  }, 1);

  return null;
}
