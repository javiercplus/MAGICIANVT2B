'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { AdjustConfig } from '@/lib/vrm/constants';

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

export function PostFX({ brightness, saturation, contrast }: AdjustConfig) {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);
  const passRef = useRef<ShaderPass | null>(null);

  useEffect(() => {
    const composer = new EffectComposer(gl);
    composer.addPass(new RenderPass(scene, camera));
    const pass = new ShaderPass(AdjustmentShader);
    composer.addPass(pass);
    composer.addPass(new OutputPass());
    composerRef.current = composer;
    passRef.current = pass;
    return () => {
      composer.dispose();
      composerRef.current = null;
      passRef.current = null;
    };
  }, [gl, scene, camera]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
  }, [gl, size.width, size.height]);

  useEffect(() => {
    const pass = passRef.current;
    if (!pass) return;
    pass.uniforms.brightness.value = brightness;
    pass.uniforms.saturation.value = saturation;
    pass.uniforms.contrast.value = contrast;
  }, [brightness, saturation, contrast]);

  useFrame(() => {
    composerRef.current?.render();
  }, 1);

  return null;
}
