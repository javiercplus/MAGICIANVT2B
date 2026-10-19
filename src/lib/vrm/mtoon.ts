'use client';

import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import type { MToonConfig } from './constants';

type MToonMaterial = THREE.Material & {
  isMToonMaterial?: boolean;
  isOutline?: boolean;
  litFactor?: THREE.Color;
  shadeColorFactor?: THREE.Color;
  shadeMultiplyTexture?: THREE.Texture | null;
  rimMultiplyTexture?: THREE.Texture | null;
  matcapTexture?: THREE.Texture | null;
  emissiveMap?: THREE.Texture | null;
  map?: THREE.Texture | null;
  shadingToonyFactor?: number;
  shadingShiftFactor?: number;
  giEqualizationFactor?: number;
  parametricRimColorFactor?: THREE.Color;
  parametricRimFresnelPowerFactor?: number;
  rimLightingMixFactor?: number;
};

interface MToonOriginal {
  toony: number;
  shift: number;
  gi: number;
  rimColor: THREE.Color;
  rimPower: number;
  rimMix: number;
  lit: THREE.Color;
  shade: THREE.Color;
}

const originals = new WeakMap<MToonMaterial, MToonOriginal>();

function eachMaterial(root: THREE.Object3D, cb: (mat: MToonMaterial) => void) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!(mesh as THREE.Mesh).isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material) continue;
      const mat = material as MToonMaterial;
      if (!mat.isMToonMaterial) continue;
      cb(mat);
    }
  });
}

function colorTexture(texture: THREE.Texture | null | undefined) {
  if (!texture) return;
  if (texture.colorSpace !== THREE.SRGBColorSpace) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }
}

/**
 * Puts the scene in a post-processing friendly state:
 * - Scene materials must NOT tone map themselves. The EffectComposer's
 *   OutputPass tone maps once at the end; doing it twice (MToon fragment +
 *   OutputPass) is what made colors look washed-out / desaturated.
 * - Color textures are flagged as sRGB so MToon samples them correctly.
 */
export function prepareSceneMaterials(root: THREE.Object3D): void {
  eachMaterial(root, (mat) => {
    if (mat.toneMapped) {
      mat.toneMapped = false;
      mat.needsUpdate = true;
    }
    colorTexture(mat.map);
    colorTexture(mat.emissiveMap);
    colorTexture(mat.shadeMultiplyTexture);
    colorTexture(mat.rimMultiplyTexture);
    colorTexture(mat.matcapTexture);
  });
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function withSaturation(color: THREE.Color, base: THREE.Color, factor: number): void {
  color.copy(base);
  if (factor === 1) return;
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  color.setHSL(hsl.h, clamp(hsl.s * factor, 0, 1), hsl.l);
}

/**
 * Applies the global MToon look. Values are applied on top of the authored
 * material and fully restored when the feature is disabled or reset.
 */
export function applyMToonLook(vrm: VRM, config: MToonConfig): void {
  const rimColor = new THREE.Color(config.rimColor);

  eachMaterial(vrm.scene, (mat) => {
    let original = originals.get(mat);
    if (!original) {
      original = {
        toony: mat.shadingToonyFactor ?? 0.9,
        shift: mat.shadingShiftFactor ?? 0,
        gi: mat.giEqualizationFactor ?? 0.9,
        rimColor: mat.parametricRimColorFactor?.clone() ?? new THREE.Color(0, 0, 0),
        rimPower: mat.parametricRimFresnelPowerFactor ?? 4,
        rimMix: mat.rimLightingMixFactor ?? 0,
        lit: mat.litFactor?.clone() ?? new THREE.Color(1, 1, 1),
        shade: mat.shadeColorFactor?.clone() ?? new THREE.Color(0, 0, 0),
      };
      originals.set(mat, original);
    }

    if (!config.enabled) {
      if (mat.shadingToonyFactor !== undefined) mat.shadingToonyFactor = original.toony;
      if (mat.shadingShiftFactor !== undefined) mat.shadingShiftFactor = original.shift;
      if (mat.giEqualizationFactor !== undefined) mat.giEqualizationFactor = original.gi;
      if (mat.parametricRimColorFactor) mat.parametricRimColorFactor.copy(original.rimColor);
      if (mat.parametricRimFresnelPowerFactor !== undefined) {
        mat.parametricRimFresnelPowerFactor = original.rimPower;
      }
      if (mat.rimLightingMixFactor !== undefined) mat.rimLightingMixFactor = original.rimMix;
      if (mat.litFactor) mat.litFactor.copy(original.lit);
      if (mat.shadeColorFactor) mat.shadeColorFactor.copy(original.shade);
      return;
    }

    // Outlines should stay flat black/author-colored, never re-shaded.
    if (mat.isOutline) return;

    if (mat.shadingToonyFactor !== undefined) mat.shadingToonyFactor = clamp(config.toony, 0, 1);
    if (mat.shadingShiftFactor !== undefined) {
      mat.shadingShiftFactor = clamp(original.shift + config.shadingShift, -1, 1);
    }
    if (mat.giEqualizationFactor !== undefined) mat.giEqualizationFactor = clamp(config.gi, 0, 1);

    if (mat.parametricRimColorFactor) {
      if (config.rim > 0) {
        mat.parametricRimColorFactor.copy(rimColor).multiplyScalar(clamp(config.rim, 0, 1));
      } else {
        // Keep the author's rim lighting unless the user adds more.
        mat.parametricRimColorFactor.copy(original.rimColor);
      }
    }
    if (mat.parametricRimFresnelPowerFactor !== undefined) {
      mat.parametricRimFresnelPowerFactor = config.rim > 0
        ? clamp(config.rimPower, 1, 8)
        : original.rimPower;
    }
    if (mat.rimLightingMixFactor !== undefined) {
      // Keep the authored mix unless the user actually asks for rim light.
      mat.rimLightingMixFactor = config.rim > 0 ? 1 : original.rimMix;
    }

    if (mat.litFactor) withSaturation(mat.litFactor, original.lit, config.colorBoost);
    if (mat.shadeColorFactor) withSaturation(mat.shadeColorFactor, original.shade, config.colorBoost);
  });
}
