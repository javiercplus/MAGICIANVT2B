'use client';

import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';

type AnyMaterial = THREE.Material & {
  isMToonMaterial?: boolean;
  isOutline?: boolean;
  color?: THREE.Color;
  map?: THREE.Texture | null;
  vertexColors?: boolean;
};

// === VRM Boost: cheap material swap =========================================
// Replaces expensive MToon materials (ramp/outline math, per-light MToon BRDF)
// with MeshLambertMaterial. Skinning + morph targets keep working because
// three r151+ handles them automatically. The original materials are stored on
// the mesh userData so the swap is fully reversible and hot-swappable.

function toMaterialArray(material: THREE.Material | THREE.Material[]): THREE.Material[] {
  return Array.isArray(material) ? material : [material];
}

function makeLowPowerMaterial(source: THREE.Material): THREE.MeshLambertMaterial {
  const src = source as AnyMaterial;
  return new THREE.MeshLambertMaterial({
    color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
    map: src.map ?? null,
    transparent: src.transparent,
    opacity: src.opacity,
    alphaTest: src.alphaTest,
    side: src.side,
    vertexColors: src.vertexColors ?? false,
    // Tone mapping is done once by PostFX's OutputPass.
    toneMapped: false,
  });
}

export function applyLowPowerMaterials(vrm: VRM, enabled: boolean): void {
  vrm.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!(mesh as THREE.Mesh).isMesh) return;

    const ud = mesh.userData as Record<string, unknown>;

    if (enabled) {
      if (ud._optLowPowerOriginal) return; // already swapped

      const original = mesh.material;
      const list = toMaterialArray(original);
      const created: THREE.Material[] = [];

      const replaced = list.map((mat) => {
        const anyMat = mat as AnyMaterial;
        // Outlines are pure overhead in low-power mode: just hide them.
        if (anyMat.isOutline) {
          anyMat.visible = false;
          return mat;
        }
        const cheap = makeLowPowerMaterial(mat);
        created.push(cheap);
        return cheap;
      });

      ud._optLowPowerOriginal = original;
      ud._optLowPowerCreated = created;
      mesh.material = Array.isArray(original) ? replaced : replaced[0];
    } else if (ud._optLowPowerOriginal) {
      const original = ud._optLowPowerOriginal as THREE.Material | THREE.Material[];
      const created = (ud._optLowPowerCreated as THREE.Material[]) ?? [];
      toMaterialArray(original).forEach((mat) => {
        (mat as AnyMaterial).visible = true; // restore hidden outlines
      });
      created.forEach((mat) => mat.dispose());
      mesh.material = original;
      delete ud._optLowPowerOriginal;
      delete ud._optLowPowerCreated;
    }
  });
}

// === VRM Boost: selective update ============================================
// three-vrm's vrm.update() always runs the expression solver (which rewrites
// every morphTargetInfluence) and the spring-bone solver. We temporarily stub
// those methods out for a single call so idle avatars don't burn CPU.

export interface VRMUpdateOptions {
  skipExpressions?: boolean;
  skipSpringBones?: boolean;
  springDelta?: number;
}

export function updateVRMSelective(vrm: VRM, dt: number, opts: VRMUpdateOptions): void {
  const em = vrm.expressionManager as unknown as { update: () => void } | null;
  const sbm = vrm.springBoneManager as unknown as { update: (delta: number) => void } | null;

  const emUpdate = em?.update;
  const sbmUpdate = sbm?.update;

  if (em && opts.skipExpressions) {
    em.update = () => {};
  }
  if (sbm && (opts.skipSpringBones || typeof opts.springDelta === 'number')) {
    if (opts.skipSpringBones) {
      sbm.update = () => {};
    } else {
      const delta = opts.springDelta as number;
      sbm.update = function (this: unknown) {
        return sbmUpdate!.call(this, delta);
      };
    }
  }

  try {
    vrm.update(dt);
  } finally {
    if (em && emUpdate) em.update = emUpdate;
    if (sbm && sbmUpdate) sbm.update = sbmUpdate;
  }
}
