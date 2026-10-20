'use client';

import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import type { ShaderConfig } from './constants';

export interface VRMFXUniforms {
  uTime: THREE.IUniform<number>;
  uHologramOn: THREE.IUniform<number>;
  uDissolveOn: THREE.IUniform<number>;
  uGlowOn: THREE.IUniform<number>;
  uScanlineOn: THREE.IUniform<number>;
  uIntensity: THREE.IUniform<number>;
  uColor: THREE.IUniform<THREE.Color>;
  uDissolve: THREE.IUniform<number>;
  uScanDensity: THREE.IUniform<number>;
}

type CompiledShader = {
  uniforms: Record<string, THREE.IUniform>;
  vertexShader: string;
  fragmentShader: string;
};

export function createVRMFXUniforms(): VRMFXUniforms {
  return {
    uTime: { value: 0 },
    uHologramOn: { value: 0 },
    uDissolveOn: { value: 0 },
    uGlowOn: { value: 0 },
    uScanlineOn: { value: 0 },
    uIntensity: { value: 0.5 },
    uColor: { value: new THREE.Color('#38f0ff') },
    uDissolve: { value: 0 },
    uScanDensity: { value: 0.35 },
  };
}

// Varying declared in both vertex and fragment (MToon has `#include <common>` in both).
const VARYING = /* glsl */ `varying vec3 vFXPosition;`;

const FRAGMENT_HEAD = /* glsl */ `
  uniform float uTime;
  uniform float uHologramOn;
  uniform float uDissolveOn;
  uniform float uGlowOn;
  uniform float uScanlineOn;
  uniform float uIntensity;
  uniform vec3  uColor;
  uniform float uDissolve;
  uniform float uScanDensity;
  ${VARYING}

  float vrmFXHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
`;

// Injected right before the final gl_FragColor write, in linear space (col
// already includes emissive, rim and outline). Available scope: col, normal,
// viewDir, vViewPosition, gl_FragCoord, vFXPosition and the uniforms above.
// Swap this block to author a different effect.
const FRAGMENT_EFFECT = /* glsl */ `
  {
    vec3 tint = uColor;
    float fres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);
    vec3 fx = fxCol;

    if (uHologramOn > 0.5) {
      // Hologram: animated scanlines + fresnel rim + flicker.
      float scan = 0.5 + 0.5 * sin((gl_FragCoord.y + uTime * 220.0) * uScanDensity);
      float flicker = 0.85 + 0.15 * sin(uTime * 42.0);
      vec3 holo = tint * (0.30 + 0.70 * scan) * flicker + tint * fres * 1.25;
      fx = mix(fx, holo, uIntensity);
    }

    if (uDissolveOn > 0.5) {
      // Dissolve: per-fragment noise threshold + glowing edge.
      float noise = vrmFXHash(floor(vFXPosition.xy * 90.0));
      if (noise < uDissolve) discard;
      float edge = smoothstep(uDissolve, uDissolve + 0.08, noise);
      fx = mix(fx, tint, uIntensity * 0.6);
      fx += tint * (1.0 - edge) * uIntensity * 1.6;
    }

    if (uGlowOn > 0.5) {
      // Glow: pulsing emissive on bright areas and rim.
      float pulse = 0.7 + 0.3 * sin(uTime * 3.0);
      float lum = dot(fxCol, vec3(0.2126, 0.7152, 0.0722));
      fx += tint * (lum + fres) * uIntensity * pulse;
    }

    if (uScanlineOn > 0.5) {
      // Scanline overlay across the whole model.
      float scan = 0.5 + 0.5 * sin(gl_FragCoord.y * uScanDensity * 6.2831);
      fx = mix(fx, fx * 0.4 + tint * scan * 0.6, uIntensity);
    }

    fxCol = fx;
  }
`;

const patched = new WeakSet<THREE.Material>();

export function applyVRMMaterialFX(vrm: VRM, uniforms: VRMFXUniforms): void {
  vrm.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!(mesh as THREE.Mesh).isMesh) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    for (const material of materials) {
      if (!material) continue;
      const mat = material as THREE.Material & { isMToonMaterial?: boolean };
      // Never replace MToon: only inject into its existing program.
      if (!mat.isMToonMaterial) continue;
      if (patched.has(mat)) continue;
      patched.add(mat);

      const originalCompile = mat.onBeforeCompile?.bind(mat) as
        | ((shader: CompiledShader) => void)
        | undefined;

      mat.onBeforeCompile = (shader: CompiledShader) => {
        // 1) Run MToon's own onBeforeCompile (prepends its #defines).
        originalCompile?.(shader);

        // 2) Share uniforms across every material of the avatar.
        Object.assign(shader.uniforms, uniforms);

        // 3) Vertex: forward local position as a varying.
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>\n${VARYING}`)
          .replace(
            '#include <skinning_vertex>',
            '#include <skinning_vertex>\n  vFXPosition = transformed;',
          );

        // 4) Fragment: declare uniforms/helpers and rewrite the final color.
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          `#include <common>\n${FRAGMENT_HEAD}`,
        );

        // NOTE: the final `gl_FragColor = vec4( col, ... )` also appears in a
        // DEBUG_LITSHADERATE branch, so target the LAST occurrence.
        const anchor = 'gl_FragColor = vec4( col, diffuseColor.a );';
        const idx = shader.fragmentShader.lastIndexOf(anchor);
        if (idx !== -1) {
          shader.fragmentShader =
            shader.fragmentShader.slice(0, idx) +
            `vec3 fxCol = col;\n${FRAGMENT_EFFECT}\n  gl_FragColor = vec4( fxCol, diffuseColor.a );` +
            shader.fragmentShader.slice(idx + anchor.length);
        } else {
          console.warn('[materialFX] MToon fragment anchor not found; FX skipped.');
        }

        // 5) Keep a reference to the compiled shader (three-vrm example pattern).
        (mat.userData as Record<string, unknown>).shader = shader;
        (mesh.userData as Record<string, unknown>).shader = shader;
      };

      // 6) Extend the program cache key so we never reuse the stock program.
      const originalKey = mat.customProgramCacheKey?.bind(mat);
      mat.customProgramCacheKey = () => `${originalKey ? originalKey() : ''}|vrmFX`;

      mat.needsUpdate = true;
    }
  });
}

export function updateVRMFX(
  uniforms: VRMFXUniforms,
  config: ShaderConfig,
  elapsed: number,
): void {
  uniforms.uTime.value = elapsed;
  uniforms.uIntensity.value = config.intensity;
  uniforms.uColor.value.set(config.color);
  uniforms.uDissolve.value = config.dissolve;
  uniforms.uScanDensity.value = config.scanline;

  // Multiple effects can be active at once.
  const effects = config.effects;
  uniforms.uHologramOn.value = effects.includes('hologram') ? 1 : 0;
  uniforms.uDissolveOn.value = effects.includes('dissolve') ? 1 : 0;
  uniforms.uGlowOn.value = effects.includes('glow') ? 1 : 0;
  uniforms.uScanlineOn.value = effects.includes('scanline') ? 1 : 0;
}

type OutlineMaterial = THREE.Material & {
  isOutline?: boolean;
  outlineWidthFactor?: number;
  outlineColorFactor?: THREE.Color;
};

// Face parts (mouth, eyes, brows, eyeline, highlight...) must never get a
// generated outline: the shell would sit on top of them and cover the mouth
// and eyes. VRM authors intentionally leave these without an outline.
const FACE_PART_RE = /face|mouth|eye|brow|eyeline|eyelash|lash|teeth|tongue|highlight/i;

function vrmHasNativeOutline(vrm: VRM): boolean {
  let found = false;
  vrm.scene.traverse((object) => {
    if (found) return;
    const mesh = object as THREE.Mesh;
    if (!(mesh as THREE.Mesh).isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (materials.some((m) => (m as OutlineMaterial)?.isOutline)) found = true;
  });
  return found;
}

// Fallback for models that ship no outline at all: replicate three-vrm's
// generation, but skip face parts and only when there is no native outline to
// preserve. Native MToon outline = cloned material with isOutline + BackSide.
function ensureVRMOutline(vrm: VRM): void {
  vrm.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!(mesh as THREE.Mesh).isMesh) return;

    const material = mesh.material;
    if (Array.isArray(material)) {
      // Already has (or shares) material slots; leave multi-material meshes alone.
      return;
    }
    if (!(material as THREE.Material & { isMToonMaterial?: boolean }).isMToonMaterial) return;
    if (FACE_PART_RE.test(material.name || '')) return;

    const outline = material.clone() as OutlineMaterial;
    outline.name = `${material.name} (Outline)`;
    outline.isOutline = true;
    outline.side = THREE.BackSide;

    mesh.material = [material, outline];

    const geometry = mesh.geometry as THREE.BufferGeometry;
    if (geometry.groups.length === 0) {
      const count = geometry.index ? geometry.index.count : geometry.attributes.position.count;
      geometry.addGroup(0, count, 0);
      geometry.addGroup(0, count, 1);
    }
  });
}

// Drives MToon's native outline uniforms from the ShaderConfig. When the
// Outline preset is inactive, the material's original values are restored.
export function updateVRMOutline(vrm: VRM, config: ShaderConfig): void {
  const active = config.effects.includes('outline');

  // Only synthesize outlines when the model has none at all, so we never add
  // outlines the author deliberately omitted (e.g. the mouth). Done once.
  const sceneData = vrm.scene.userData as Record<string, unknown>;
  if (active && !sceneData._fxOutlineChecked) {
    if (!vrmHasNativeOutline(vrm)) ensureVRMOutline(vrm);
    sceneData._fxOutlineChecked = true;
  }

  vrm.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!(mesh as THREE.Mesh).isMesh) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of materials) {
      const outline = mat as OutlineMaterial;
      if (!outline || !outline.isOutline) continue;

      const ud = outline.userData as Record<string, unknown>;
      if (ud._fxOrigWidth === undefined) {
        ud._fxOrigWidth = outline.outlineWidthFactor ?? 0;
        ud._fxOrigColor = outline.outlineColorFactor?.clone() ?? new THREE.Color(0, 0, 0);
      }

      if (active) {
        // Native width is ~0.0008; keep this in the same order of magnitude so
        // the shell stays subtle and never balloons over the face/mouth.
        outline.outlineWidthFactor = 0.0004 + config.intensity * 0.0026;
        (outline.outlineColorFactor as THREE.Color).set(config.color);
      } else {
        outline.outlineWidthFactor = ud._fxOrigWidth as number;
        (outline.outlineColorFactor as THREE.Color).copy(ud._fxOrigColor as THREE.Color);
      }
    }
  });
}
