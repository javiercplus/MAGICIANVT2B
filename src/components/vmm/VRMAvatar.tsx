'use client';

import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { loadVRMFromUrl, type LoadVRMResult } from '@/lib/vrm/loadVRM';
import {
  gazeToHeadEuler,
  gazeToEyeEuler,
  smoothDampGaze,
  computeAutoBlink,
  randomNextBlinkDelay,
  applyStandPose,
} from '@/lib/vrm/gazeMath';
import { GAZE, LIPSYNC, AUTO_BLINK, SCENE, PHYSICS_INTERVAL } from '@/lib/vrm/constants';
import type { GazeTarget, ShaderConfig, OptimizationConfig } from '@/lib/vrm/constants';
import { createVRMFXUniforms, applyVRMMaterialFX, updateVRMFX, updateVRMOutline } from '@/lib/vrm/materialFX';
import { applyLowPowerMaterials, updateVRMSelective } from '@/lib/vrm/optimization';

interface VRMAvatarProps {
  vrmUrl: string | null;
  gazeEnabled: boolean;
  autoBlinkEnabled: boolean;
  randomEyesEnabled: boolean;
  randomEyesIntensity: number;
  idleSwayEnabled: boolean;
  idleSwayIntensity: number;
  shaderConfig: ShaderConfig;
  optimization: OptimizationConfig;
  gazeDesiredRef: React.RefObject<GazeTarget>;
  gazeCurrentRef: React.RefObject<GazeTarget>;
  mouthValueRef: React.RefObject<number>;
  avatarOffsetRef: React.RefObject<THREE.Vector3>;
  onLoaded?: (result: LoadVRMResult) => void;
  onError?: (err: Error) => void;
}

export function VRMAvatar(props: VRMAvatarProps) {
  const {
    vrmUrl, gazeEnabled, autoBlinkEnabled, randomEyesEnabled, randomEyesIntensity, idleSwayEnabled, idleSwayIntensity,
    shaderConfig, optimization,
    gazeDesiredRef, gazeCurrentRef, mouthValueRef, avatarOffsetRef,
    onLoaded, onError,
  } = props;

  const [scene, setScene] = useState<THREE.Group | null>(null);
  const fxUniforms = useRef(createVRMFXUniforms());
  const vrmRef = useRef<VRM | null>(null);
  const lastMouthRef = useRef(0);
  const lastBlinkRef = useRef(0);
  const physicsAccRef = useRef(0);
  const headBoneRef = useRef<THREE.Bone | null>(null);
  const neckBoneRef = useRef<THREE.Bone | null>(null);
  const leftEyeBoneRef = useRef<THREE.Bone | null>(null);
  const rightEyeBoneRef = useRef<THREE.Bone | null>(null);
  const hipsBoneRef = useRef<THREE.Bone | null>(null);
  const spineBoneRef = useRef<THREE.Bone | null>(null);
  const blinkStateRef = useRef({
    elapsed: 0,
    nextDelay: randomNextBlinkDelay(),
  });
  const randomEyesStateRef = useRef({
    elapsed: 0,
    nextDelay: 1.0 + Math.random() * 2.0,
    target: { x: 0, y: 0 } as GazeTarget,
  });

  const { camera } = useThree();

  useEffect(() => {
    if (!vrmUrl) {
      vrmRef.current = null;
      headBoneRef.current = null;
      neckBoneRef.current = null;
      leftEyeBoneRef.current = null;
      rightEyeBoneRef.current = null;
      hipsBoneRef.current = null;
      spineBoneRef.current = null;
      return;
    }

    let cancelled = false;
    loadVRMFromUrl(vrmUrl)
      .then((result: LoadVRMResult) => {
        if (cancelled) return;
        const { scene: vrmScene, vrm } = result;
        vrmRef.current = vrm;
        headBoneRef.current = vrm.humanoid?.getNormalizedBoneNode('head') ?? null;
        neckBoneRef.current = vrm.humanoid?.getNormalizedBoneNode('neck') ?? null;
        leftEyeBoneRef.current = vrm.humanoid?.getNormalizedBoneNode('leftEye') ?? null;
        rightEyeBoneRef.current = vrm.humanoid?.getNormalizedBoneNode('rightEye') ?? null;
        hipsBoneRef.current = vrm.humanoid?.getNormalizedBoneNode('hips') ?? null;
        spineBoneRef.current = vrm.humanoid?.getNormalizedBoneNode('spine') ?? null;
        applyStandPose(vrm);
        applyVRMMaterialFX(vrm, fxUniforms.current);

        vrmScene.updateMatrixWorld(true);
        const head = headBoneRef.current;
        if (head) {
          const headWorldPos = new THREE.Vector3();
          head.getWorldPosition(headWorldPos);
          camera.position.set(0, headWorldPos.y - 0.05, headWorldPos.z + SCENE.CAMERA_DISTANCE);
          camera.lookAt(0, headWorldPos.y - 0.15, headWorldPos.z);
          camera.updateProjectionMatrix();
        }
        setScene(vrmScene);
        onLoaded?.(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        onError?.(err instanceof Error ? err : new Error(String(err)));
      });

    return () => {
      cancelled = true;
      setScene(null);
      vrmRef.current = null;
      headBoneRef.current = null;
      neckBoneRef.current = null;
      leftEyeBoneRef.current = null;
      rightEyeBoneRef.current = null;
      hipsBoneRef.current = null;
      spineBoneRef.current = null;
    };
  }, [vrmUrl]);

  // VRM Boost: swap MToon <-> MeshLambertMaterial live, without reloading.
  useEffect(() => {
    const vrm = vrmRef.current;
    if (!vrm || !scene) return;
    applyLowPowerMaterials(vrm, optimization.mtoonLowPower);
  }, [scene, optimization.mtoonLowPower]);

  useFrame((state, delta) => {
    const vrm = vrmRef.current;
    if (!vrm) return;
    const dt = Math.min(delta, 1 / 30);

    const offset = avatarOffsetRef.current;
    if (offset && scene) {
      scene.position.set(offset.x, offset.y, offset.z);
    }

    let desired: GazeTarget;
    if (randomEyesEnabled) {
      const rs = randomEyesStateRef.current;
      rs.elapsed += dt;
      if (rs.elapsed >= rs.nextDelay) {
        rs.elapsed = 0;
        rs.nextDelay = 1.0 + Math.random() * 2.0;
        rs.target.x = (Math.random() * 2 - 1) * randomEyesIntensity;
        rs.target.y = (Math.random() * 2 - 1) * randomEyesIntensity;
      }
      desired = rs.target;
    } else if (gazeEnabled) {
      desired = gazeDesiredRef.current;
    } else {
      desired = { x: 0, y: 0 } as GazeTarget;
    }

    gazeCurrentRef.current = smoothDampGaze(
      gazeCurrentRef.current, desired, GAZE.LERP_SPEED, dt
    );

    const head = headBoneRef.current;
    if (head) head.quaternion.setFromEuler(gazeToHeadEuler(gazeCurrentRef.current));

    const neck = neckBoneRef.current;
    if (neck) {
      const neckLimit = GAZE.HEAD_ROT_LIMIT_DEG * (1 - GAZE.HEAD_RATE);
      neck.quaternion.setFromEuler(gazeToHeadEuler(gazeCurrentRef.current, neckLimit));
    }

    const leftEye = leftEyeBoneRef.current;
    const rightEye = rightEyeBoneRef.current;
    if (leftEye && rightEye) {
      const euler = gazeToEyeEuler(gazeCurrentRef.current);
      leftEye.quaternion.setFromEuler(euler);
      rightEye.quaternion.setFromEuler(euler);
    }

    const wantMouth = mouthValueRef.current ?? 0;
    try {
      vrm.expressionManager?.setValue(LIPSYNC.MOUTH_OPEN_PRESET, wantMouth);
    } catch {}

    let wantBlink = lastBlinkRef.current;
    if (autoBlinkEnabled) {
      const bs = blinkStateRef.current;
      bs.elapsed += dt;
      const result = computeAutoBlink(bs.elapsed, bs.nextDelay);
      if (result) {
        if (result.isComplete) {
          bs.elapsed = 0;
          bs.nextDelay = randomNextBlinkDelay();
        }
        wantBlink = result.value;
      } else {
        wantBlink = 0;
      }
      try { vrm.expressionManager?.setValue(AUTO_BLINK.BLINK_PRESET, wantBlink); } catch {}
    }

    // Blend-shape optimization: expressions are only re-solved (morphTarget
    // influences rewritten) when the target weights actually move.
    const expressionsDirty =
      Math.abs(wantMouth - lastMouthRef.current) > 0.004 ||
      Math.abs(wantBlink - lastBlinkRef.current) > 0.004;
    lastMouthRef.current = wantMouth;
    lastBlinkRef.current = wantBlink;

    const hips = hipsBoneRef.current;
    const spine = spineBoneRef.current;

    if (hips && spine) {
      if (idleSwayEnabled) {
        const time = performance.now() * 0.001;
        const speed = 1.0;
        const swayAmount = idleSwayIntensity;
        hips.rotation.z = Math.sin(time * speed) * swayAmount;
        spine.rotation.z = Math.sin(time * speed + Math.PI) * (swayAmount * 0.5);
      } else {
        hips.rotation.z = 0;
        spine.rotation.z = 0;
      }
    }

    // Physics quality: throttle the spring-bone solver. When idle, back off
    // further. springDelta passes the accumulated time so physics stays stable.
    const physicsInterval = PHYSICS_INTERVAL[optimization.physicsQuality];
    let skipSpringBones = false;
    let springDelta: number | undefined;
    if (physicsInterval > 0) {
      physicsAccRef.current += dt;
      const idle = Math.abs(wantMouth) < 0.02 && !idleSwayEnabled;
      const effective = idle ? physicsInterval * 3 : physicsInterval;
      if (physicsAccRef.current < effective) {
        skipSpringBones = true;
      } else {
        springDelta = physicsAccRef.current;
        physicsAccRef.current = 0;
      }
    }

    updateVRMSelective(vrm, dt, {
      skipExpressions: optimization.morphOptimization && !expressionsDirty,
      skipSpringBones,
      springDelta,
    });
    updateVRMFX(fxUniforms.current, shaderConfig, state.clock.elapsedTime);
    updateVRMOutline(vrm, shaderConfig);
  });

  return scene ? <primitive object={scene} /> : null;
}
