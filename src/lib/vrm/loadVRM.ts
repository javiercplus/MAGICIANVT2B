'use client';

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  VRMLoaderPlugin,
  VRMUtils,
  VRMExpression,
  VRMExpressionMorphTargetBind,
  type VRM,
} from '@pixiv/three-vrm';
import { PERFECT_SYNC_CLIP_NAMES, normalizeExpressionKey } from '@/lib/vmc/vmc';

export interface VrmMeshItem {
  id: string;
  name: string;
  visible: boolean;
}

export interface LoadVRMResult {
  scene: THREE.Group;
  vrm: VRM;
  meshes: VrmMeshItem[];
  meta?: {
    name?: string;
    authors?: readonly string[];
    copyright?: string;
    version?: string;
  };
}

// Force every facial blend shape to its neutral (0) state. Some VRMs ship with
// non-zero morph weights baked in, and re-loading while a blink/mouth pose is
// active can leak that pose into the new model. Zeroing the expression weights
// and the raw morphTargetInfluences guarantees the base/neutral face on load.
function resetExpressionsToNeutral(vrm: VRM): void {
  const em = vrm.expressionManager;
  if (em) {
    em.resetValues();
    em.update();
  }

  vrm.scene.traverse((obj: THREE.Object3D) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const influences = (mesh as unknown as { morphTargetInfluences?: number[] }).morphTargetInfluences;
    if (!influences) return;
    for (let i = 0; i < influences.length; i++) influences[i] = 0;
  });
}

// Auto-register any of the 52 ARKit Perfect Sync blendshapes that exist as raw
// mesh morphTargets (shape keys) on the model even if the user didn't create
// explicit VRM BlendShapeClips on Unity (Step 1 of VMagicMirror Perfect Sync).
function registerPerfectSyncRawMorphBinds(vrm: VRM): void {
  const em = vrm.expressionManager;
  if (!em) return;

  const existingNormalized = new Set<string>();
  for (const expr of em.expressions) {
    existingNormalized.add(normalizeExpressionKey(expr.expressionName));
  }

  // Collect all meshes that have a morphTargetDictionary
  const morphMeshes: THREE.Mesh[] = [];
  vrm.scene.traverse((obj: THREE.Object3D) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.morphTargetDictionary && Array.isArray(mesh.morphTargetInfluences)) {
      morphMeshes.push(mesh);
    }
  });

  if (morphMeshes.length === 0) return;

  for (const clipName of PERFECT_SYNC_CLIP_NAMES) {
    const targetNorm = normalizeExpressionKey(clipName);
    if (existingNormalized.has(targetNorm)) continue;

    // Look for matching morph target name across all meshes (e.g. "BrowInnerUp", "browInnerUp", "Fcl_..._BrowInnerUp")
    const matchingBinds: { primitives: THREE.Mesh[]; index: number }[] = [];
    for (const mesh of morphMeshes) {
      const dict = mesh.morphTargetDictionary;
      if (!dict) continue;
      for (const [morphName, morphIndex] of Object.entries(dict)) {
        const morphNorm = normalizeExpressionKey(morphName);
        if (morphNorm === targetNorm || morphNorm.endsWith(targetNorm)) {
          matchingBinds.push({ primitives: [mesh], index: morphIndex });
          break;
        }
      }
    }

    if (matchingBinds.length > 0) {
      const expr = new VRMExpression(clipName);
      vrm.scene.add(expr);
      for (const b of matchingBinds) {
        expr.addBind(
          new VRMExpressionMorphTargetBind({
            primitives: b.primitives,
            index: b.index,
            weight: 1.0,
          }),
        );
      }
      em.registerExpression(expr);
      existingNormalized.add(targetNorm);
    }
  }
}

// Per-instance setup mirroring VMagicMirror's VRMLoadController:
// - rotateVRM0: VRM 0.x faces +Z after 180° rotation (no-op for VRM 1.0).
//   It reads vrm.meta.metaVersion, so it must receive the VRM (not vrm.scene).
// - removeUnnecessaryVertices + combineSkeletons: geometry optimization
// - frustumCulled=false: prevents SkinnedMesh pop-in/out
function applyVRMSetup(vrm: VRM): void {
  VRMUtils.rotateVRM0(vrm);
  VRMUtils.removeUnnecessaryVertices(vrm.scene);
  VRMUtils.combineSkeletons(vrm.scene);

  vrm.scene.traverse((obj: THREE.Object3D) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.frustumCulled = false;
      mesh.receiveShadow = false;
      mesh.castShadow = true;
    }
  });

  registerPerfectSyncRawMorphBinds(vrm);
  resetExpressionsToNeutral(vrm);
}

function extractResult(gltf: any): LoadVRMResult {
  const vrm = gltf.userData.vrm as VRM | undefined;
  if (!vrm) throw new Error('Loaded glTF has no VRM data. Is this a .vrm file?');
  applyVRMSetup(vrm);

  const meshes: VrmMeshItem[] = [];
  vrm.scene.traverse((obj: THREE.Object3D) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      meshes.push({
        id: mesh.uuid,
        name: mesh.name || `Mesh_${meshes.length + 1}`,
        visible: mesh.visible !== false,
      });
    }
  });

  const meta: LoadVRMResult['meta'] = {};
  try {
    const m = (vrm as any).meta;
    if (m) {
      // VRM 1.0 uses `name`; VRM 0.x uses `title`.
      meta.name = m.name ?? m.title ?? undefined;
      meta.authors = m.authors ?? (m.author ? [m.author] : undefined);
      meta.copyright = m.copyrightInformation ?? undefined;
      meta.version = m.version ?? m.exporterVersion ?? undefined;
    }
  } catch {}

  return { scene: vrm.scene, vrm, meshes, meta };
}

export async function loadVRMFromUrl(url: string): Promise<LoadVRMResult> {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => {
      try { resolve(extractResult(gltf)); } catch (err) { reject(err); }
    }, undefined, (err) => reject(err));
  });
}

export async function loadVRMFromArrayBuffer(buffer: ArrayBuffer): Promise<LoadVRMResult> {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  return new Promise((resolve, reject) => {
    loader.parse(buffer, '', (gltf) => {
      try { resolve(extractResult(gltf)); } catch (err) { reject(err); }
    }, (err) => reject(err));
  });
}

export async function loadVRMFromFile(file: File): Promise<LoadVRMResult> {
  return loadVRMFromArrayBuffer(await file.arrayBuffer());
}
