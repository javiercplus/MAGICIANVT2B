'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import type { AdjustConfig, ShaderConfig } from '@/lib/vrm/constants';
import { renderStats } from '@/lib/vrm/renderStats';

export interface PostFXProps extends AdjustConfig {
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  shader: ShaderConfig;
  // Optimization
  fpsLimit: number;
  renderScale: number;
  pixelRatio: number;
  antiAlias: boolean;
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
  fpsLimit, renderScale, pixelRatio, antiAlias,
}: PostFXProps) {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);
  const passRef = useRef<ShaderPass | null>(null);
  const stylizeRef = useRef<ShaderPass | null>(null);
  const bloomRef = useRef<UnrealBloomPass | null>(null);
  const fxaaRef = useRef<ShaderPass | null>(null);
  const accumRef = useRef(0);

  useEffect(() => {
    const composer = new EffectComposer(gl);
    composer.addPass(new RenderPass(scene, camera));

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

    const fxaa = new ShaderPass(FXAAShader);
    fxaa.enabled = false;
    composer.addPass(fxaa);

    composerRef.current = composer;
    passRef.current = pass;
    stylizeRef.current = stylize;
    bloomRef.current = bloom;
    fxaaRef.current = fxaa;

    return () => {
      composer.dispose();
      composerRef.current = null;
      passRef.current = null;
      stylizeRef.current = null;
      bloomRef.current = null;
      fxaaRef.current = null;
    };
  }, [gl, scene, camera]);

  // Resize / render-scale / pixel-ratio. NOTE: renderScale only shrinks the
  // composer's internal WebGLRenderTargets; the canvas CSS size is untouched,
  // so the Electron UI stays sharp while the 3D pass costs less.
  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    const dpr = gl.getPixelRatio();
    composer.setPixelRatio(dpr);
    composer.setSize(size.width * renderScale, size.height * renderScale);

    const internalW = Math.max(1, size.width * renderScale * dpr);
    const internalH = Math.max(1, size.height * renderScale * dpr);
    fxaaRef.current?.uniforms.resolution.value.set(1 / internalW, 1 / internalH);
    stylizeRef.current?.uniforms.uResolution.value.set(internalW, internalH);
  }, [gl, size.width, size.height, renderScale, pixelRatio]);

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

  useEffect(() => {
    if (fxaaRef.current) fxaaRef.current.enabled = antiAlias;
  }, [antiAlias]);

  useFrame((_, delta) => {
    const composer = composerRef.current;
    if (!composer) return;

    // Draw-call telemetry: keep renderer.info accumulating across all composer
    // passes (three would otherwise reset it on every pass), then reset once
    // per rendered frame. Accessed via the composer's renderer rather than the
    // hook-returned gl to keep it a private mutation.
    const renderer = composer.renderer;
    renderer.info.autoReset = false;

    // FPS limiter: only render when the accumulated time reaches the target
    // frame budget. Skipped frames reuse the previous framebuffer.
    if (fpsLimit > 0) {
      accumRef.current += delta;
      const budget = 1 / fpsLimit;
      if (accumRef.current < budget) return;
      accumRef.current = accumRef.current % budget;
    }

    renderer.info.reset();
    composer.render();
    renderStats.frames++;
  }, 1);

  return null;
}
