'use client';

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';

export interface LoadVRMResult {
  scene: THREE.Group;
  vrm: VRM;
  meta?: {
    name?: string;
    authors?: readonly string[];
    copyright?: string;
    version?: string;
  };
}

// Per-instance setup mirroring VMagicMirror's VRMLoadController:
// - rotateVRM0: VRM 0.x faces +Z after 180° rotation (no-op for VRM 1.0)
// - removeUnnecessaryVertices + combineSkeletons: geometry optimization
// - frustumCulled=false: prevents SkinnedMesh pop-in/out
function applyVRMSetup(vrm: VRM): void {
  VRMUtils.rotateVRM0(vrm.scene);
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
}

function extractResult(gltf: any): LoadVRMResult {
  const vrm = gltf.userData.vrm as VRM | undefined;
  if (!vrm) throw new Error('Loaded glTF has no VRM data. Is this a .vrm file?');
  applyVRMSetup(vrm);

  const meta: LoadVRMResult['meta'] = {};
  try {
    const m = (vrm as any).meta;
    if (m) {
      meta.name = m.name ?? undefined;
      meta.authors = m.authors ?? (m.author ? [m.author] : undefined);
      meta.copyright = m.copyrightInformation ?? undefined;
      meta.version = m.version ?? undefined;
    }
  } catch {}

  return { scene: vrm.scene, vrm, meta };
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
