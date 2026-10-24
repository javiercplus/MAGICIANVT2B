'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import { loadVRMFromUrl, type LoadVRMResult } from '@/lib/vrm/loadVRM';
import {
  gazeToHeadEuler,
  gazeToEyeEuler,
  smoothDampGaze,
  computeAutoBlink,
  randomNextBlinkDelay,
  applyStandPose,
  resetAllBonesToDefault,
  isVRM0,
} from '@/lib/vrm/gazeMath';
import { GAZE, LIPSYNC, AUTO_BLINK, SCENE, PHYSICS_INTERVAL } from '@/lib/vrm/constants';
import type { GazeTarget, ShaderConfig, OptimizationConfig, MToonConfig, ModelRotation, WindConfig, CameraHome } from '@/lib/vrm/constants';
import { createVRMFXUniforms, applyVRMMaterialFX, updateVRMFX, updateVRMOutline } from '@/lib/vrm/materialFX';
import { applyLowPowerMaterials, updateVRMSelective } from '@/lib/vrm/optimization';
import { applyMToonLook, prepareSceneMaterials } from '@/lib/vrm/mtoon';
import { applyVRMWind } from '@/lib/vrm/wind';
import {
  vmcState,
  vmcReceivedState,
  isVmcReceivingActive,
  clearVmcReceivedState,
  ALL_VRM_BONES,
  BONE_CATEGORY,
  swapLeftRightBoneName,
  mapReceivedBlendShapeNames,
  type VmcConfig,
  type VmcBonePose,
} from '@/lib/vmc/vmc';

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
  mtoon: MToonConfig;
  wind: WindConfig;
  vmcConfig: VmcConfig;
  meshVisibility?: Record<string, boolean>;
  rotationRef: React.RefObject<ModelRotation>;
  cameraHomeRef: React.RefObject<CameraHome | null>;
  gazeDesiredRef: React.RefObject<GazeTarget>;
  gazeCurrentRef: React.RefObject<GazeTarget>;
  mouthValueRef: React.RefObject<number>;
  avatarOffsetRef: React.RefObject<THREE.Vector3>;
  faceWeights: Record<string, number>;
  onLoaded?: (result: LoadVRMResult) => void;
  onError?: (err: Error) => void;
}

const _tmpVec = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();

export function VRMAvatar(props: VRMAvatarProps) {
  const {
    vrmUrl, gazeEnabled, autoBlinkEnabled, randomEyesEnabled, randomEyesIntensity, idleSwayEnabled, idleSwayIntensity,
    shaderConfig, optimization, mtoon, wind, vmcConfig, meshVisibility, rotationRef, cameraHomeRef,
    gazeDesiredRef, gazeCurrentRef, mouthValueRef, avatarOffsetRef, faceWeights,
    onLoaded, onError,
  } = props;

  const [scene, setScene] = useState<THREE.Group | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const fxUniforms = useRef(createVRMFXUniforms());
  const vrmRef = useRef<VRM | null>(null);
  const lastMouthRef = useRef(0);
  const lastBlinkRef = useRef(0);
  const lastFaceRef = useRef<Record<string, number>>(faceWeights);
  const vrm0Ref = useRef(false);
  const physicsAccRef = useRef(0);
  const wasReceivingRef = useRef(false);
  const prevReceiveEnabledRef = useRef(vmcConfig.receive.enabled);
  const initialHipsPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1, 0));
  const senderInitialHipsPosRef = useRef<THREE.Vector3 | null>(null);

  const boneMapRef = useRef<Partial<Record<VRMHumanBoneName, THREE.Object3D>>>({});
  const headBoneRef = useRef<THREE.Object3D | null>(null);
  const neckBoneRef = useRef<THREE.Object3D | null>(null);
  const leftEyeBoneRef = useRef<THREE.Object3D | null>(null);
  const rightEyeBoneRef = useRef<THREE.Object3D | null>(null);
  const hipsBoneRef = useRef<THREE.Object3D | null>(null);
  const spineBoneRef = useRef<THREE.Object3D | null>(null);

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
  const cameraRef = useRef(camera);
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  // Comprehensive reset: restores skeleton bones, hips position, group transform, gaze, eyes and morphs to pristine default
  const doResetAvatarToDefault = useCallback((vrm: VRM) => {
    resetAllBonesToDefault(vrm);
    if (hipsBoneRef.current) {
      hipsBoneRef.current.position.copy(initialHipsPosRef.current);
    }
    senderInitialHipsPosRef.current = null;

    const group = groupRef.current;
    if (group) {
      group.position.set(0, 0, 0);
      group.quaternion.set(0, 0, 0, 1);
      group.rotation.set(0, 0, 0);
    }
    if (avatarOffsetRef.current) {
      avatarOffsetRef.current.set(0, 0, 0);
    }
    if (rotationRef.current) {
      rotationRef.current.x = 0;
      rotationRef.current.y = 0;
    }
    if (gazeCurrentRef.current) {
      gazeCurrentRef.current.x = 0;
      gazeCurrentRef.current.y = 0;
    }
    if (gazeDesiredRef.current) {
      gazeDesiredRef.current.x = 0;
      gazeDesiredRef.current.y = 0;
    }
    if (leftEyeBoneRef.current) leftEyeBoneRef.current.quaternion.identity();
    if (rightEyeBoneRef.current) rightEyeBoneRef.current.quaternion.identity();
    if (headBoneRef.current) headBoneRef.current.quaternion.identity();
    if (neckBoneRef.current) neckBoneRef.current.quaternion.identity();

    vrm.expressionManager?.resetValues();
    for (const name in faceWeights) {
      try {
        vrm.expressionManager?.setValue(name, faceWeights[name]);
      } catch {}
    }
    clearVmcReceivedState();
  }, [faceWeights, avatarOffsetRef, rotationRef, gazeCurrentRef, gazeDesiredRef]);

  useEffect(() => {
    if (!vrmUrl) {
      vrmRef.current = null;
      vmcState.loaded = false;
      cameraHomeRef.current = null;
      vrm0Ref.current = false;
      boneMapRef.current = {};
      headBoneRef.current = null;
      neckBoneRef.current = null;
      leftEyeBoneRef.current = null;
      rightEyeBoneRef.current = null;
      hipsBoneRef.current = null;
      spineBoneRef.current = null;
      setScene(null);
      return;
    }

    let cancelled = false;

    loadVRMFromUrl(vrmUrl)
      .then((result) => {
        if (cancelled) return;
        const vrm = result.vrm;
        const vrmScene = result.scene;
        vrmRef.current = vrm;
        vmcState.loaded = true;

        // IMPORTANT: We MUST use getNormalizedBoneNode so that vrm.update(dt)
        // propagates normalized bone rotations to the raw skeleton mesh!
        // Writing to getRawBoneNode gets overwritten every frame by humanoid.update()!
        const humanoid = vrm.humanoid;
        const map: Partial<Record<VRMHumanBoneName, THREE.Object3D>> = {};
        if (humanoid) {
          for (const bone of ALL_VRM_BONES) {
            const norm = humanoid.getNormalizedBoneNode(bone);
            if (norm) map[bone] = norm;
          }
        }
        boneMapRef.current = map;

        headBoneRef.current = humanoid?.getNormalizedBoneNode('head') ?? null;
        neckBoneRef.current = humanoid?.getNormalizedBoneNode('neck') ?? null;
        leftEyeBoneRef.current = humanoid?.getNormalizedBoneNode('leftEye') ?? null;
        rightEyeBoneRef.current = humanoid?.getNormalizedBoneNode('rightEye') ?? null;
        hipsBoneRef.current = humanoid?.getNormalizedBoneNode('hips') ?? null;
        spineBoneRef.current = humanoid?.getNormalizedBoneNode('spine') ?? null;
        if (hipsBoneRef.current) {
          initialHipsPosRef.current.copy(hipsBoneRef.current.position);
        }
        senderInitialHipsPosRef.current = null;

        applyStandPose(vrm);
        vrm0Ref.current = isVRM0(vrm);
        blinkStateRef.current = { elapsed: 0, nextDelay: randomNextBlinkDelay() };
        lastMouthRef.current = 0;
        lastBlinkRef.current = 0;
        physicsAccRef.current = 0;
        wasReceivingRef.current = false;

        prepareSceneMaterials(vrm.scene);
        applyMToonLook(vrm, mtoon);
        applyVRMMaterialFX(vrm, fxUniforms.current);

        vrmScene.updateMatrixWorld(true);
        const head = headBoneRef.current;
        if (head) {
          const headWorldPos = new THREE.Vector3();
          head.getWorldPosition(headWorldPos);
          const activeCamera = cameraRef.current;
          const target = new THREE.Vector3(0, headWorldPos.y - 0.15, headWorldPos.z);
          activeCamera.position.set(0, headWorldPos.y - 0.05, headWorldPos.z + SCENE.CAMERA_DISTANCE);
          activeCamera.lookAt(target);
          activeCamera.updateProjectionMatrix();
          cameraHomeRef.current = { position: activeCamera.position.clone(), target };
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
      vmcState.loaded = false;
      vrm0Ref.current = false;
      boneMapRef.current = {};
      headBoneRef.current = null;
      neckBoneRef.current = null;
      leftEyeBoneRef.current = null;
      rightEyeBoneRef.current = null;
      hipsBoneRef.current = null;
      spineBoneRef.current = null;
    };
  }, [vrmUrl]);

  // Mesh Visibility: apply mesh toggles from the Meshes panel live
  useEffect(() => {
    const vrm = vrmRef.current;
    if (!vrm || !meshVisibility) return;
    vrm.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && meshVisibility[mesh.uuid] !== undefined) {
        mesh.visible = meshVisibility[mesh.uuid];
      }
    });
  }, [meshVisibility]);

  // VRM Boost: swap MToon <-> MeshLambertMaterial live, without reloading.
  useEffect(() => {
    const vrm = vrmRef.current;
    if (!vrm || !scene) return;
    applyLowPowerMaterials(vrm, optimization.mtoonLowPower);
  }, [scene, optimization.mtoonLowPower]);

  // MToon look overrides (toon steps, GI, rim, color boost) apply live.
  useEffect(() => {
    const vrm = vrmRef.current;
    if (!vrm || !scene) return;
    prepareSceneMaterials(vrm.scene);
    applyMToonLook(vrm, mtoon);
  }, [scene, mtoon]);

  // When receiveEnabled is explicitly turned off in UI, reset avatar immediately
  useEffect(() => {
    if (prevReceiveEnabledRef.current && !vmcConfig.receive.enabled) {
      const vrm = vrmRef.current;
      if (vrm) {
        doResetAvatarToDefault(vrm);
      }
    }
    prevReceiveEnabledRef.current = vmcConfig.receive.enabled;
  }, [vmcConfig.receive.enabled, doResetAvatarToDefault]);

  useFrame((state, delta) => {
    const vrm = vrmRef.current;
    if (!vrm) return;
    const dt = Math.min(delta, 1 / 30);
    const now = performance.now();

    const recvCfg = vmcConfig.receive;
    const isReceiving = recvCfg.enabled && isVmcReceivingActive(now);

    // When VMC receive is deactivated (toggled off or network traffic timeout),
    // fully restore the avatar to default stand pose and center position
    if (wasReceivingRef.current && !isReceiving) {
      doResetAvatarToDefault(vrm);
    }
    wasReceivingRef.current = isReceiving;

    const sx = recvCfg.invertX ? -1 : 1;
    const sy = recvCfg.invertY ? -1 : 1;
    const sz = recvCfg.invertZ ? -1 : 1;

    const group = groupRef.current;
    if (group) {
      if (isReceiving && recvCfg.applyRoot && vmcReceivedState.root) {
        const offset = avatarOffsetRef.current;
        const ox = offset ? offset.x : 0;
        const oy = offset ? offset.y : 0;
        const oz = offset ? offset.z : 0;

        group.position.set(
          ox + (recvCfg.invertY ? -vmcReceivedState.root.px : vmcReceivedState.root.px),
          oy + vmcReceivedState.root.py,
          oz + (recvCfg.invertX ? -vmcReceivedState.root.pz : vmcReceivedState.root.pz),
        );
        group.quaternion.set(
          sx * vmcReceivedState.root.qx,
          sy * vmcReceivedState.root.qy,
          sz * vmcReceivedState.root.qz,
          vmcReceivedState.root.qw,
        );
      } else {
        const offset = avatarOffsetRef.current;
        if (offset) group.position.set(offset.x, offset.y, offset.z);
        const rotation = rotationRef.current;
        if (rotation) group.rotation.set(rotation.x, rotation.y, 0);
      }
    }

    // Wind affects the spring bones; apply before vrm.update().
    applyVRMWind(vrm, wind, state.clock.elapsedTime);

    // While VMC receive is enabled, disable local tracking entirely (gaze,
    // random eyes, idle sway) so it can't fight the incoming motion.
    const localTracking = !recvCfg.enabled;

    let desired: GazeTarget = { x: 0, y: 0 } as GazeTarget;
    if (localTracking) {
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
      }
    }

    gazeCurrentRef.current = smoothDampGaze(
      gazeCurrentRef.current, desired, GAZE.LERP_SPEED, dt
    );

    // VRM 0.x normalized bones mirror X and Z relative to VRM 1.0 (+Z vs -Z local forward).
    const flipPitch = vrm0Ref.current;
    const isVrm0 = vrm0Ref.current;

    // 1. Local Gaze / Head / Neck / Eye tracking (only when VMC receive is off)
    if (localTracking) {
      const head = headBoneRef.current;
      if (head) head.quaternion.setFromEuler(gazeToHeadEuler(gazeCurrentRef.current, GAZE.HEAD_ROT_LIMIT_DEG, flipPitch));

      const neck = neckBoneRef.current;
      if (neck) {
        const neckLimit = GAZE.HEAD_ROT_LIMIT_DEG * (1 - GAZE.HEAD_RATE);
        neck.quaternion.setFromEuler(gazeToHeadEuler(gazeCurrentRef.current, neckLimit, flipPitch));
      }

      const leftEye = leftEyeBoneRef.current;
      const rightEye = rightEyeBoneRef.current;
      if (leftEye && rightEye) {
        const euler = gazeToEyeEuler(gazeCurrentRef.current, flipPitch);
        leftEye.quaternion.setFromEuler(euler);
        rightEye.quaternion.setFromEuler(euler);
      }
    }

    // 2. Apply received VMC bone poses (Upper Body, Hands/Fingers, Legs, Eyes)
    if (isReceiving) {
      const slerpFactor = recvCfg.smoothPose ? Math.min(1, 1 - Math.exp(-18 * dt)) : 1;
      const boneMap = boneMapRef.current;

      // Reset hips position when applyHipsPosition is off so avatar never teleports vertically
      if (!recvCfg.applyHipsPosition && hipsBoneRef.current) {
        hipsBoneRef.current.position.copy(initialHipsPosRef.current);
        senderInitialHipsPosRef.current = null;
      }

      for (const [rawBoneName, pose] of Object.entries(vmcReceivedState.bones)) {
        const category = BONE_CATEGORY[rawBoneName];
        if (!category) continue;
        if (category === 'upperBody' && !recvCfg.applyUpperBody) continue;
        if (category === 'hand' && !recvCfg.applyHand) continue;
        if (category === 'leg' && !recvCfg.applyLeg) continue;
        if (category === 'eye' && !recvCfg.applyEye) continue;

        const targetBoneName = recvCfg.mirrorLeftRight
          ? swapLeftRightBoneName(rawBoneName as VRMHumanBoneName)
          : (rawBoneName as VRMHumanBoneName);

        const node = boneMap[targetBoneName];
        if (!node) continue;

        const qx1 = sx * pose.qx;
        const qy1 = sy * pose.qy;
        const qz1 = sz * pose.qz;
        const qw1 = pose.qw;

        if (isVrm0) {
          _tmpQuat.set(-qx1, qy1, -qz1, qw1).normalize();
        } else {
          _tmpQuat.set(qx1, qy1, qz1, qw1).normalize();
        }

        // Clamp eye bone rotation within natural human range (±20°) without Z roll
        if (category === 'eye') {
          const eyeEuler = new THREE.Euler().setFromQuaternion(_tmpQuat, 'YXZ');
          const maxEyeRad = (20 * Math.PI) / 180;
          eyeEuler.x = THREE.MathUtils.clamp(eyeEuler.x, -maxEyeRad, maxEyeRad);
          eyeEuler.y = THREE.MathUtils.clamp(eyeEuler.y, -maxEyeRad, maxEyeRad);
          eyeEuler.z = 0;
          _tmpQuat.setFromEuler(eyeEuler);
        }

        if (slerpFactor >= 0.999) {
          node.quaternion.copy(_tmpQuat);
        } else {
          node.quaternion.slerp(_tmpQuat, slerpFactor);
        }

        // Optional Hips Position delta
        if (
          targetBoneName === 'hips' &&
          recvCfg.applyHipsPosition &&
          (Math.abs(pose.px) > 1e-4 || Math.abs(pose.py) > 1e-4 || Math.abs(pose.pz) > 1e-4)
        ) {
          if (!senderInitialHipsPosRef.current) {
            senderInitialHipsPosRef.current = new THREE.Vector3(pose.px, pose.py, pose.pz);
          }
          const base = senderInitialHipsPosRef.current;
          const dx = (recvCfg.invertY ? -1 : 1) * (pose.px - base.x);
          const dy = pose.py - base.y;
          const dz = (recvCfg.invertX ? -1 : 1) * (pose.pz - base.z);

          _tmpVec.set(
            initialHipsPosRef.current.x + (isVrm0 ? -dx : dx),
            initialHipsPosRef.current.y + dy,
            initialHipsPosRef.current.z + (isVrm0 ? -dz : dz),
          );
          if (slerpFactor >= 0.999) {
            node.position.copy(_tmpVec);
          } else {
            node.position.lerp(_tmpVec, slerpFactor);
          }
        }
      }
    }

    // 3. Spine / Hips Base Tracking & Idle Sway (idle sway only without VMC receive)
    const hips = hipsBoneRef.current;
    const spine = spineBoneRef.current;
    if (hips && spine && localTracking) {
      if (idleSwayEnabled) {
        const time = now * 0.001;
        const speed = 1.0;
        const swayAmount = idleSwayIntensity;
        hips.rotation.z = Math.sin(time * speed) * swayAmount;
        spine.rotation.z = Math.sin(time * speed + Math.PI) * (swayAmount * 0.5);
      } else {
        hips.rotation.z = 0;
        spine.rotation.z = 0;
      }
    }

    // 4. Facial Expressions (BlendShapes)
    let expressionsDirty = false;
    const receivingBlendShapes = isReceiving && recvCfg.applyBlendShape && Object.keys(vmcReceivedState.blendshapes).length > 0;

    if (receivingBlendShapes) {
      const em = vrm.expressionManager;
      if (em) {
        for (const [rawName, val] of Object.entries(vmcReceivedState.blendshapes)) {
          const candidates = mapReceivedBlendShapeNames(rawName);
          for (const candidate of candidates) {
            try {
              em.setValue(candidate, val);
            } catch {}
          }
        }
        if (mouthValueRef.current && mouthValueRef.current > 0.02) {
          try {
            em.setValue(LIPSYNC.MOUTH_OPEN_PRESET, mouthValueRef.current);
          } catch {}
        }
        expressionsDirty = true;
      }
    } else {
      const face = faceWeights;
      for (const name in face) {
        try { vrm.expressionManager?.setValue(name, face[name]); } catch {}
      }
      const faceChanged = lastFaceRef.current !== face;
      lastFaceRef.current = face;

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

      expressionsDirty =
        faceChanged ||
        Math.abs(wantMouth - lastMouthRef.current) > 0.004 ||
        Math.abs(wantBlink - lastBlinkRef.current) > 0.004;
      lastMouthRef.current = wantMouth;
      lastBlinkRef.current = wantBlink;
    }

    // Physics quality: throttle the spring-bone solver.
    const physicsInterval = PHYSICS_INTERVAL[optimization.physicsQuality];
    let skipSpringBones = false;
    let springDelta: number | undefined;
    if (physicsInterval > 0) {
      physicsAccRef.current += dt;
      const idle = Math.abs(lastMouthRef.current) < 0.02 && !idleSwayEnabled && !isReceiving;
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

    // 5. Publish full skeleton bone poses + root + head + expression weights for the VMC sender.
    vmcState.elapsedTime = state.clock.elapsedTime;
    if (group) {
      vmcState.root.px = group.position.x;
      vmcState.root.py = group.position.y;
      vmcState.root.pz = group.position.z;
      vmcState.root.qx = group.quaternion.x;
      vmcState.root.qy = group.quaternion.y;
      vmcState.root.qz = group.quaternion.z;
      vmcState.root.qw = group.quaternion.w;
    }

    const headNode = headBoneRef.current;
    if (headNode) {
      headNode.updateWorldMatrix(true, false);
      headNode.getWorldPosition(_tmpVec);
      headNode.getWorldQuaternion(_tmpQuat);
      vmcState.head.px = _tmpVec.x;
      vmcState.head.py = _tmpVec.y;
      vmcState.head.pz = _tmpVec.z;
      vmcState.head.qx = _tmpQuat.x;
      vmcState.head.qy = _tmpQuat.y;
      vmcState.head.qz = _tmpQuat.z;
      vmcState.head.qw = _tmpQuat.w;
    }

    if (vmcConfig.send.enabled) {
      const bonesOut: Record<string, VmcBonePose> = {};
      const boneMap = boneMapRef.current;
      for (const boneName of ALL_VRM_BONES) {
        const node = boneMap[boneName];
        if (!node) continue;
        const qx = isVrm0 ? -node.quaternion.x : node.quaternion.x;
        const qy = node.quaternion.y;
        const qz = isVrm0 ? -node.quaternion.z : node.quaternion.z;
        const qw = node.quaternion.w;
        bonesOut[boneName] = {
          px: isVrm0 ? -node.position.x : node.position.x,
          py: node.position.y,
          pz: isVrm0 ? -node.position.z : node.position.z,
          qx,
          qy,
          qz,
          qw,
        };
      }
      vmcState.bones = bonesOut;
    }

    const bs: Record<string, number> = {};
    const expressions = vrm.expressionManager?.expressions ?? [];
    for (const e of expressions) bs[e.expressionName] = e.weight;
    vmcState.blendshapes = bs;
  });

  return scene ? (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  ) : null;
}
