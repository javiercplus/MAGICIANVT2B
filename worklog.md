# Project Worklog

This file tracks the work of multiple agents collaborating on the project.


---
Task ID: 1
Agent: general-purpose (VMagicMirror source researcher)
Task: Study VMagicMirror source code for gaze tracking + lipsync + VRM loading logic

Work Log:
- Created /home/z/my-project/worklog.md (no prior agent entries existed).
- Tried GitHub REST API to list repo tree but was rate-limited; switched to shallow `git clone --depth 1 --branch v5.0.0` to `/tmp/vmm_src`, then used `git ls-tree -r --name-only v5.0.0` to discover file paths.
- Discovered actual source root: `VMagicMirror/Assets/Baku/VMagicMirror/Scripts/`. Read README.md from raw.githubusercontent.com which confirmed Unity 6.3 + WPF, FinalIK, Oculus LipSync Unity Integration v29, VRMLoaderUI dependencies.
- Located and inspected key files for gaze tracking: `InputMonitoring/KeyAndMouseInput/MousePositionProvider.cs`, `AvatarControl/Motion/HeadIkIntegrator.cs`, `AvatarControl/Motion/HeadFKIntegrator.cs`, `AvatarControl/Motion/NonImageBasedMotion.cs`, `AvatarControl/Motion/IK/MouseMoveHandIKGenerator.cs`, `AvatarControl/Motion/IKTargetTransforms.cs`, `AvatarControl/Motion/LookAtStyleUtil.cs`, `AvatarControl/FaceContol/EyeLookAt.cs`, `EyeLookAtUpdater.cs`, `EyeBoneAngleSetter.cs`, `EyeBoneAngleMapApplier.cs`, `IEyeRotationRequestSource.cs`, `EyeJitter.cs`, `EyeDownMotionController.cs`, `AvatarControl/FaceContol/Blink/VRMAutoBlink.cs`, `Environment/DeviceTransforms/TouchPadProvider.cs`.
- Located and inspected key files for lipsync: `AvatarControl/FaceContol/LIpSync/AnimMorphEasedTarget.cs`, `AnimMorphEasedTargetV2.cs`, `IMouthLipSyncSource.cs`, `LipSyncIntegrator.cs`, `InputMonitoring/LipSync/VmmLipSyncContextBase.cs`, `DeviceSelectableLipSyncContext.cs`, `NAudioLipSyncContext.cs`.
- Located and inspected VRM loading files: `ModelLoad/VRMLoad/VRM10LoadController.cs`, `VRM10LoadControllerHelper.cs`, `VRM10InstanceUpdater.cs`, `VRMLoadedInfo.cs`, `IVRMLoadable.cs`, plus `ModelLoad/SettingAdjust/SettingAutoAdjuster.cs`.
- Inspected expression mapping helpers: `AvatarControl/FaceContol/Vrm10ExpressionUtils.cs`, `Vrm0BlendShapeKeyUtils.cs`, `ExpressionAccumulator.cs`, `LipSyncIntegrator.cs`.

Stage Summary:

### 1. GAZE TRACKING WITH MOUSE

**Architecture (two layers):**
1. **Head/neck rotation via FinalIK LookAtIK** (an external Unity asset; in TS/Three.js you can re-implement as a simple 2-bone aim constraint or just rotate the Head bone directly).
2. **Eye-bone rotation via direct quaternion writes** by `EyeBoneAngleSetter` using yaw/pitch derived from `EyeLookAt.Calculate()`.

**Mouse → world coordinate mapping** (in `HeadIkIntegrator.OnMouseMove(int x, int y)` where x,y are screen pixels):
```
xPos  = (x - Screen.width  * 0.5f) / 1000;        // ~world units, ~[-0.5,0.5]
yPos  = (y - Screen.height * 0.5f) / 1000;
yPos -= 0.3f;                                       // bias downward so eyes look slightly down by default
if (yPos > 0) yPos *= 0.7f;                          // suppress upward gaze
xClamped = Mathf.Clamp(xPos,  -1f, 1f);
yClamped = Mathf.Clamp(yPos,  -1f, 0.5f);            // note asymmetric Y: more down than up
baseLookAtPosition = camera.TransformPoint(xClamped, yClamped, 0) + 0.6f * Vector3.forward; // 0.6 = ZOffsetOnHeadIk
// + a depth-offset term depending on camera forward (handles back-view camera angle), see source.
```

**LookAt target smoothing:**
- `_lookAtTarget.localPosition = Vector3.Lerp(current, targetPos, lookAtSpeedFactor * Time.deltaTime)` with **`lookAtSpeedFactor = 6.0f`** (per-second lerp factor).
- A `mouseActionCount` is incremented on mouse move / click (clamped to `mouseActionCountMax = 8.0`) and decays at 1/sec; used for pen-tablet focus blending.

**Bones rotated for head LookAt** (FinalIK `LookAtIK` chain set in `VRM10LoadControllerHelper.AddLookAtIK`):
- Chain (spine links): `Spine → Chest → UpperChest → Neck → Head` (each skipped if null)
- `lookAtIk.solver.bodyWeight = 0.2f`
- `lookAtIk.solver.headWeight = 0.5f`
- `lookAtIk.solver.target = ikTargets.LookAt` (the same Transform that HeadIkIntegrator writes)
- VRM side: `instance.LookAtTargetType = SpecifiedTransform; instance.LookAtTarget = ikTargets.LookAt;` (so the VRM built-in eye LookAt is also driven from this Transform).

**Eye-bone rotation math** (`EyeLookAt.Calculate`):
```
diff = _lookAtTarget.position - _head.position;
localDirection = _head.InverseTransformDirection(diff.normalized);
Yaw   =  Weight * MathUtil.ClampedAtan2Deg(localDirection.x, localDirection.z);
Pitch = -Weight * Mathf.Asin(localDirection.y) * Mathf.Rad2Deg;
// Unity convention: yaw right is +, pitch DOWN is + (note the negative sign on Asin for Y up)
```
Both left and right eye share the same Yaw/Pitch (no divergence).

**Eye-bone rotation limits & smoothing** (`EyeBoneAngleSetter`):
- All `IEyeRotationRequestSource`s (NonImageBasedMotion, EyeJitter, EyeDownMotionController, CarHandleBasedFK, …) contribute a `Vector2 LeftEyeRotationRate`/`RightEyeRotationRate` in range [-1, 1] (x=yaw right-positive, y=pitch up-positive). Sum is clamped to magnitude 1.2 (`RateMagnitudeLimit`).
- Per-eye yaw  = sum.x * 35°  (`HorizontalRateToAngle`)
- Per-eye pitch = -sum.y * 35° (`VerticalRateToAngle`, down-positive Unity)
- Final angles passed through `ScaleAndClampAngle(angle, weightFactor)` with hard **`AngleAbsLimit = 80°`**.
- `factorWhenMapDisable = 0.2f` applies when avatar's own eye curve map is off.
- Eyes use `Quaternion.Euler(pitch, yaw, 0)` in **local space** applied to `leftEye`/`rightEye` bone's `ControlTarget` (initial local rotation stored and used as base).
- Bone names: `HumanBodyBones.LeftEye`, `HumanBodyBones.RightEye` (VRM/UniVRM humanoid). When avatar has no eye bones, falls back to BlendShape `LookUp/Down/Left/Right` mapping via `EyeBlendShapeAngleMapApplier`.
- Optional avatar-specific curve map: `VRM10ObjectLookAt.HorizontalInner/HorizontalOuter/VerticalUp/VerticalDown` (from the VRM's LookAt config) is applied via `EyeBoneAngleMapApplier` to remap raw yaw/pitch to bone-rotation-friendly values per eye.

**Head random motion (NonImageBasedMotion, when no face tracking)**:
- `_inactiveJitter`: angle range (4°, 4°, 4°), change every 6–15 s.
- `_activeJitter` (when talking): angle range (6°, 12°, 12°), change every 0.5–2 s.
- Eye jitter adds `eyeRotationRateFactor = 0.05` × head yaw/pitch (with 10% chance of opposite direction for "keep eye center").
- Final head rotation applied to Neck + Head bones with `HeadRate = 0.5` split (neck gets 50%, head 50%) and a **`HeadTotalRotationLimitDeg = 40°`** clamp on the combined axis-angle.
- Eye `_rawEyeRot` is lerped toward target with `eyeSpeedFactor = 4.0f * dt`.

**Mouse position normalization helper** (`MousePositionProvider`):
- `NormalizedCursorPosition`: screen-relative, range [-0.5, 0.5] (right = +X, up = +Y), clamped.
- Max mouse speed cap: `MaxMouseSpeedPerSec = 7` (≈5× screen diagonal / sec).
- FPS-mode differential decays at `diffValueDiminishRate = 2.0` / sec.

**Look-at style options** (`LookAtStyleUtil`): `Fixed`, `MousePointer` (default), `MainCamera`.

### 2. LIPSYNC

**Audio analysis approach:** Uses **Oculus LipSync (OVRLipSync) Unity Integration v29** — a closed-source phoneme-recognition library (HMM-based) that returns 15 visemes per frame, the first being `sil` (silence). VMagicMirror only uses the 5 vowel visemes: `aa, E, ih, oh, ou` (sil is index 0; vowels are indices 1–5).

**Mic input:**
- 48 kHz, mono-ish (16-bit PCM converted to float via `ShortToSingle = 1/32768`).
- `OVRLipSync.ProcessFrame(context, processBuffer, frame)` is called per 1024 or 2048-sample chunk.
- `smoothAmount = 65` (V2) or `100` (V1) → `context.Smoothing` (OVRLipSync's internal smoothing 0–100).
- Mic sensitivity is dB-based, applied as `pow(10, sensitivity * 0.05)` gain on each sample.
- Volume level computed as `mean square → dB → clamped [0, 50]` range with `BottomVolumeDb = -50`.

**Viseme → mouth shape mapping** (`AnimMorphEasedTarget[V2].Update`):
1. Find the viseme with max weight among `aa..ou`; consonants/sil are ignored.
2. Apply that viseme's weight through a Unity `AnimationCurve transitionCurves` = `{ Keyframe(0, 0), Keyframe(0.1, 1) }` (i.e., linear ramp 0→1 over 0.1 s, evaluated by `_transitionTimer` which resets on viseme change or when weight drops below `weightThreshold = 2.0`).
3. All other visemes decay toward 0 via `Mathf.Lerp(current, 0, Time.deltaTime * cancelSpeedFactor)` where **`cancelSpeedFactor = 8.0`**.
4. Take the max of (decay value, curve-evaluated value) so "あぁあぁぁあ" patterns don't break.
5. Multiply by `GetLipSyncFactorByVolume()`:
   - volume dB range `[10, 30]` (i.e., -40 dB to -20 dB) maps to 0→1.
   - If volume < 10 dB → factor = 0 (mouth stays closed).
   - Clamped to `[0.3, 1]` when above threshold.

**Blendshape / Expression names** — VMagicMirror uses **UniVRM10 ExpressionKey** presets:
| Viseme (OVRLipSync) | IMouthLipSyncSource field | VRM 1.0 ExpressionKey preset | VRM 0.x BlendShapePreset |
|---|---|---|---|
| aa | A | `Aa` | `A` |
| E  | E | `Ee` | `E` |
| ih | I | `Ih` | `I` |
| oh | O | `Oh` | `O` |
| ou | U | `Ou` | `U` |

Final accumulation (`LipSyncIntegrator.Accumulate`):
```
accumulator.Accumulate(ExpressionKey.Aa, src.A * weight);
accumulator.Accumulate(ExpressionKey.Ih, src.I * weight);
accumulator.Accumulate(ExpressionKey.Ou, src.U * weight);
accumulator.Accumulate(ExpressionKey.Ee, src.E * weight);
accumulator.Accumulate(ExpressionKey.Oh, src.O * weight);
```
The `ExpressionAccumulator` sums all sources and calls `Vrm10RuntimeExpression.SetWeightsNonAlloc(values)` once per LateUpdate (after all motion scripts).

### 3. VRM LOADING

**Library:** `UniVRM10` (UniVRM v3.x series, supports both VRM 0.x and VRM 1.0). Also uses `VRMLoaderUI` for the preview UI and FinalIK (`FullBodyBipedIK`, `LimbIK`, `LookAtIK`, `TwistRelaxer`, `FingerRig`) for skeletal control.

**Load entry point** (`VRM10LoadController`):
```
var instance = await Vrm10.LoadBytesAsync(
    bytes,
    true,                                   // createHierarchyAtRuntime
    ControlRigGenerationOption.Generate,   // generate a humanoid control rig
    true,                                   // showMeshes
    materialGenerator: new VmmUrpVrm10MaterialDescriptorGenerator(),
    vrmMetaInformationCallback: OnMetaDetectedForModelLoad,
    ct: cancellationToken
);
```

**Per-instance configuration (in `VRM10LoadControllerHelper.SetupVrm`):**
- `animator.applyRootMotion = false;`
- `instance.UpdateType = Vrm10Instance.UpdateTypes.None;` (VMagicMirror drives updates manually via `VRM10InstanceUpdater.LateUpdate` calling `_instance.Runtime.Process()`).
- All `SkinnedMeshRenderer.updateWhenOffscreen = true;`
- All `Renderer.receiveShadows = false;`
- Adds `FullBodyBipedIK` with references built from `controlRig.GetBoneTransform(HumanBodyBones.X)` for all standard humanoid bones.
- Adds `LookAtIK` with chain `[Spine, Chest, UpperChest, Neck] → Head` (filter nulls).
- Adds `LimbIK` for both legs, `TwistRelaxer` for both forearms (weight 0.4, parent-child crossfade 0.5), `FingerRig` on the right hand for the index finger.

**Bone names relied on** (Unity `HumanBodyBones` enum, mapped from VRM humanoid):
- Head/neck: `Hips, Spine, Chest, UpperChest, Neck, Head, LeftEye, RightEye`
- Arms: `LeftUpperArm/LeftLowerArm/LeftHand`, `RightUpperArm/RightLowerArm/RightHand`
- Legs: `LeftUpperLeg/LeftLowerLeg/LeftFoot`, `RightUpperLeg/RightLowerLeg/RightFoot`
- Fingers (right index): `RightIndexProximal/Intermediate/Distal`

**LookAt config**:
- `instance.LookAtTargetType = LookAtTargetTypes.SpecifiedTransform;`
- `instance.LookAtTarget = ikTargets.LookAt;` (a Transform that HeadIkIntegrator updates each frame).
- Honors the VRM's own `LookAtType` (bone vs blendShape) and `HorizontalInner/HorizontalOuter/VerticalUp/VerticalDown` curve maps when present.

**Scale / camera normalization** (`SettingAutoAdjuster.AdjustCameraPosition`):
- Main camera is positioned at `Vector3(0, neckBone.position.y, 1.3f)` looking at the avatar from the front (`rotation = Euler(0, 180, 0)`).
- Reference arm length = 0.378 m, hand length = 0.114 m, chest height = 0.89 m, spine height = 0.784 m (from "Megumi Baxter" base avatar).
- Auto-adjust computes height/arm-length factors relative to these references and applies them to keyboard/touchpad layout.

**Events other systems subscribe to** (in `IVRMLoadable`):
- `PreVrmLoaded(info)`, `VrmLoaded(info)`, `PostVrmLoaded(info)`, `VrmDisposing()`.
- `VrmLoadedInfo` carries: `modelVersion`, `vrmRoot` (Transform), `animator` (= controlRig), `instance` (Vrm10Instance), `fbbIk`, `leftLegIk`, `rightLegIk`, `leftArmTwistRelaxer`, `rightArmTwistRelaxer`, `renderers[]`.

### Key constants summary for re-implementation in TS/Three.js

| Feature | Constant | Value |
|---|---|---|
| Mouse→world scale | pixel divisor | 1000 px = 1 world unit (camera-space) |
| Mouse Y bias | downward offset | 0.3 (then *0.7 if positive) |
| Mouse Y clamp | asymmetrical | [-1, 0.5] |
| Mouse X clamp | symmetrical | [-1, 1] |
| LookAt Z offset | head IK | 0.6 forward |
| LookAt lerp speed | per second | 6.0 |
| Head IK weights | body / head | 0.2 / 0.5 |
| Eye yaw/pitch rate→deg | per axis | 35° |
| Eye angle abs limit | clamp | 80° |
| Eye rate magnitude clamp | vector | 1.2 |
| Eye jitter speed | lerp/s | 11.0 |
| NonImage eye speed | lerp/s | 4.0 |
| Head total rotation limit | deg | 40° |
| Head/Neck split | head rate | 0.5 (neck=0.5, head=0.5) |
| LipSync transition curve | keyframes | (0→0, 0.1→1) |
| LipSync cancel speed | per second | 8.0 |
| LipSync weight threshold | % | 2.0 |
| LipSync smooth amount (OVRLipSync) | 0–100 | 65 (V2) / 100 (V1) |
| LipSync volume dB min/max | mouth-open range | -40 dB / -20 dB |
| LipSync volume factor clamp | min | 0.3 |
| Auto-blink intervals | seconds | 3.0 – 12.0 |
| Auto-blink close/keep/open | seconds | 0.05 / 0.04 / 0.10 |

### Pseudocode for the Three.js re-implementation team

**Mouse → head yaw/pitch (simple version, no FinalIK):**
```
// mouse = {x, y} in pixels; screenW, screenH in pixels
let xPos = (mouse.x - screenW * 0.5) / 1000;
let yPos = (mouse.y - screenH * 0.5) / 1000;
yPos -= 0.3;
if (yPos > 0) yPos *= 0.7;
xPos = clamp(xPos, -1, 1);
yPos = clamp(yPos, -1, 0.5);
// treat as a target in front of camera at distance 0.6 + camera-relative offset
// rotate head bone so its forward (-Z in VRM) points at this target:
const yaw   = atan2(xPos, 0.6);  // rad
const pitch = atan2(yPos, 0.6);  // rad
// optional smoothing: lerp current head euler toward (pitch, yaw, 0) at 6*dt
```

**Mouse → eye yaw/pitch:**
```
// Same normalized target, compute yaw/pitch relative to HEAD bone (not camera)
const headWorldPos = headBone.getWorldPosition();
const targetWorld  = camera.localToWorld(xPos, yPos, 0).add(vec3(0,0,0.6));
const localDir     = headBone.worldToLocalDir((targetWorld - headWorldPos).normalize());
const eyeYaw   = clamp(atan2Deg(localDir.x, localDir.z), -80, 80);   // ±80° hard limit
const eyePitch = -asin(localDir.y) * RAD2DEG;                          // down-positive Unity conv
// Apply to leftEye & rightEye bone local Euler: (eyePitch, eyeYaw, 0) on top of base local rotation
// Scale factor: 35° per unit rate, then × motionScale (0.2–1.0) and × weight (0–1).
```

**LipSync → VRM blendshape weights:**
```
// OVRLipSync replacement: any 5-band vowel classifier (e.g., formant analysis or an ML model)
// producing visemeWeights[5] = {aa, E, ih, oh, ou} in [0,1].
let maxIdx = indexOfMax(visemeWeights);
let maxW   = visemeWeights[maxIdx];
if (maxW * 100 < 2.0) { transitionTimer = 0; }              // weightThreshold
if (maxIdx !== prevIdx) { transitionTimer = 0; prevIdx = maxIdx; }
transitionTimer += dt;
for (let i = 0; i < 5; i++) {
  shapeWeight[i] = lerp(shapeWeight[i], 0, dt * 8.0);       // cancelSpeedFactor
  if (i === maxIdx) {
    const ramp = Math.min(transitionTimer / 0.1, 1);          // AnimationCurve 0→1 over 0.1s
    shapeWeight[i] = Math.max(shapeWeight[i], ramp);
  }
}
// Volume scaling: compute RMS dB; if > -40dB, factor = clamp((dB+40)/20, 0.3, 1); else 0
const factor = adjustByVolume ? volumeFactor : 1;
const out = {
  A: shapeWeight[0] * factor,   // aa
  E: shapeWeight[1] * factor,   // E
  I: shapeWeight[2] * factor,   // ih
  O: shapeWeight[3] * factor,   // oh
  U: shapeWeight[4] * factor,   // ou
};
// Map to three-vrm:
vrm.expressionManager.setValue('aa', out.A);  // or 'A' for VRM0
vrm.expressionManager.setValue('ee', out.E);
vrm.expressionManager.setValue('ih', out.I);
vrm.expressionManager.setValue('oh', out.O);
vrm.expressionManager.setValue('ou', out.U);
```

### Links to specific source files (commit v5.0.0)

Gaze tracking:
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/InputMonitoring/KeyAndMouseInput/MousePositionProvider.cs
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/AvatarControl/Motion/HeadIkIntegrator.cs
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/AvatarControl/Motion/NonImageBasedMotion.cs
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/AvatarControl/FaceContol/EyeLookAt.cs
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/AvatarControl/FaceContol/EyeBoneAngleSetter.cs
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/AvatarControl/FaceContol/EyeBoneAngleMapApplier.cs
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/AvatarControl/Motion/IK/MouseMoveHandIKGenerator.cs
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/Environment/DeviceTransforms/TouchPadProvider.cs

LipSync:
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/AvatarControl/FaceContol/LIpSync/AnimMorphEasedTargetV2.cs
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/AvatarControl/FaceContol/LIpSync/AnimMorphEasedTarget.cs
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/AvatarControl/FaceContol/LIpSync/LipSyncIntegrator.cs
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/AvatarControl/FaceContol/LIpSync/IMouthLipSyncSource.cs
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/InputMonitoring/LipSync/VmmLipSyncContextBase.cs
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/InputMonitoring/LipSync/NAudioLipSyncContext.cs
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/InputMonitoring/LipSync/DeviceSelectableLipSyncContext.cs

VRM loading:
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/ModelLoad/VRMLoad/VRM10LoadController.cs
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/ModelLoad/VRMLoad/VRM10LoadControllerHelper.cs
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/ModelLoad/VRMLoad/VRM10InstanceUpdater.cs
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/ModelLoad/VRMLoad/VRMLoadedInfo.cs
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/ModelLoad/VRMLoad/IVRMLoadable.cs
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/ModelLoad/SettingAdjust/SettingAutoAdjuster.cs
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/AvatarControl/FaceContol/Vrm10ExpressionUtils.cs
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/AvatarControl/FaceContol/Vrm0BlendShapeKeyUtils.cs
- https://github.com/malaybaku/VMagicMirror/blob/v5.0.0/VMagicMirror/Assets/Baku/VMagicMirror/Scripts/AvatarControl/FaceContol/ExpressionAccumulator.cs


---
Task ID: 2
Agent: Z.ai Code (main agent)
Task: Build web reimplementation of VMagicMirror with VRM avatar + mouse gaze tracking + lipsync, in Next.js 16 + TypeScript + Three.js

Work Log:
- Installed three@0.186.1, @react-three/fiber@9.8.1, @react-three/drei@10.7.9, @pixiv/three-vrm@3.5.5, @types/three@0.186.0
- Downloaded Pixiv sample VRM (VRM1_Constraint_Twist_Sample, 11MB) to public/models/default.vrm
- Wrote src/lib/vrm/constants.ts (all VMagicMirror constants: GAZE, LIPSYNC, AUTO_BLINK, SCENE)
- Wrote src/lib/vrm/gazeMath.ts (port of HeadIkIntegrator.OnMouseMove, gazeToHeadEuler, gazeToEyeEuler, smoothDampGaze, auto-blink envelope)
- Wrote src/lib/vrm/loadVRM.ts (GLTFLoader + VRMLoaderPlugin, VRMUtils.rotateVRM0 + combineSkeletons, frustumCulled=false)
- Wrote src/hooks/useGazeTracking.ts (mouse -> desiredRef/currentRef, no React state for perf)
- Wrote src/hooks/useLipSync.ts (Web Audio API + AnalyserNode -> RMS -> dB -> 0..1 mouth value, throttled UI state)
- Wrote src/components/vmm/VRMAvatar.tsx (loads VRM, applies gaze + lipsync + auto-blink in useFrame, positions camera relative to head bone)
- Wrote src/components/vmm/VRMScene.tsx (R3F Canvas + 3-light setup: ambient/key/fill/rim)
- Wrote src/components/vmm/ControlPanel.tsx (Card with status pill, toggles for Gaze/LipSync/AutoBlink, mic level Progress)
- Wrote src/components/vmm/DropZone.tsx (drag-drop + file picker for .vrm files)
- Wrote src/components/vmm/Header.tsx and Footer.tsx (sticky footer at bottom of viewport)
- Wrote src/app/page.tsx (combines everything: full-screen canvas + floating UI + sticky footer + drop overlay)
- Updated src/app/layout.tsx (title: "WebMirror · VMagicMirror web reimplementation")
- Fixed lint errors: react-hooks/set-state-in-effect rule (moved setState to effect cleanup)
- Fixed critical gaze bug: original VMagicMirror uses Unity's screen Y (origin bottom-left); web uses Y from top. Inverted the Y_BIAS direction, Y_UP_DAMPING condition, and Y_CLAMP asymmetry for the web convention. Also fixed yaw/pitch signs in gazeToHeadEuler after empirical VLM verification showed head was turning AWAY from the mouse.

Stage Summary:
- ✅ Lint passes cleanly with no errors or warnings
- ✅ Page compiles and serves at http://localhost:3000 (HTTP 200)
- ✅ 3D VRM avatar renders (verified via VLM screenshot analysis)
- ✅ Mouse gaze tracking works (VLM confirmed: mouse top-right -> head yawed to viewer's right + pitched UP; mouse bottom-right -> pitched DOWN)
- ✅ LipSync toggle works (when mic unavailable in headless browser, shows "Requested device not found" gracefully without crashing)
- ✅ Auto-blink works (blink expression driven by computeAutoBlink envelope every 3-12s)
- ✅ Footer is sticky at bottom of viewport (visible on both desktop and mobile)
- ✅ Mobile responsive (tested at 400x800 viewport, layout still functional)
- ✅ No runtime errors in console (only Three.js Clock/ShadowMap deprecation warnings)
- ✅ File drop overlay appears when dragging .vrm files over the page

Architecture:
- src/lib/vrm/ : constants (VMagicMirror ports), gazeMath (mouse->gaze), loadVRM (GLTF+VRM loader)
- src/hooks/ : useGazeTracking (mouse listener), useLipSync (mic amplitude)
- src/components/vmm/ : VRMAvatar (R3F avatar with useFrame logic), VRMScene (Canvas+lights), ControlPanel, DropZone, Header, Footer
- src/app/page.tsx : single route that ties everything together

All key VMagicMirror constants preserved: MOUSE_DIVISOR=1000, Y_BIAS=0.3, Y_UP_DAMPING=0.7, X_CLAMP=[-1,1], HEAD_ROT_LIMIT_DEG=40, EYE_YAW_PITCH_PER_RATE_DEG=35, EYE_ANGLE_LIMIT_DEG=80, LERP_SPEED=6.0, LIPSYNC.DB_MIN/MAX=-40/-20, LIPSYNC.VOLUME_FACTOR_CLAMP_MIN=0.3, AUTO_BLINK interval 3-12s with 0.05/0.04/0.10s close/keep/open durations.

---
Task ID: 3
Agent: Z.ai Code (main agent)
Task: Add user-requested features to WebMirror: lower eye limit, stand pose, green screen, mouse-outside-window capture, screen recording button

Work Log:
- Lowered eye rotation constants: EYE_YAW_PITCH_PER_RATE_DEG 35 → 20, EYE_ANGLE_LIMIT_DEG 80 → 25
- Added STAND_POSE constants (upper arm Z rotations, lower arm X bend)
- Added GREEN_SCREEN constant (#00b140 chroma key green)
- Wrote applyStandPose(vrm) function that rotates rightUpperArm/leftUpperArm and lower arms
- Fixed stand pose sign bug: initial -Z/+Z sent arms UP; VLM check showed -85° made arms go vertical-up. Flipped to +Z/-Z which correctly brings right arm (-X in world) DOWN and left arm (+X) DOWN
- Added useScreenRecording hook (MediaRecorder + canvas.captureStream(30fps), auto-downloads .webm on stop, supports vp9/vp8/mp4 fallback)
- Refactored useGazeTracking to take options object {enabled, captureOutside}
  - Added mouseleave/blur listeners that reset gaze to (0,0) forward when mouse leaves window
  - Added pointer lock support: when captureOutside is ON, click on canvas engages pointer lock; movementX/Y accumulate into virtual mouse position
  - Added pointerlockchange listener to reset virtual mouse on Esc exit
- Updated VRMAvatar to call applyStandPose after VRM load
- Updated VRMAvatar: gaze OFF now lerps to (0, 0) forward instead of (0, 0.3) down
- Rewrote VRMScene to use declarative <color attach="background"> for reactive green screen switching (avoids React 19 immutability rule on scene.background)
- Rewrote ControlPanel with: Open .vrm / Sample / Record buttons, Gaze / Capture Outside / LipSync / Auto Blink / Green Screen toggles (Capture Outside is nested under Gaze, only visible when Gaze is ON)
- Added pointer-lock hint banner at bottom of viewport when captureOutside is ON and not yet locked
- Wired everything up in page.tsx with new state: captureOutside, greenScreen, recording
- Fixed lint errors: react-hooks/set-state-in-effect (moved setState to effect cleanup), react-hooks/immutability (used <color> element instead of mutating scene.background), react-hooks/refs (removed optsRef, used closure values directly)

Stage Summary:
- ✅ Lint passes cleanly
- ✅ Stand pose works (VLM confirmed: arms relaxed at sides, 10-15° from vertical)
- ✅ Green screen toggle works (VLM confirmed: chroma key green background, avatar visible)
- ✅ Screen recording works: button shows "Stop recording · MM:SS" timer, no console errors, downloads .webm on stop
- ✅ Gaze OFF = static forward gaze (VLM confirmed head facing straight forward)
- ✅ Gaze ON = head + eyes follow mouse with reduced eye rotation (VLM confirmed)
- ✅ Capture Outside Window toggle shows pointer-lock hint banner
- ✅ Footer still sticky at bottom
- ✅ Mobile responsive (tested at 400x800)
- ✅ No runtime errors

Verified via Agent Browser + VLM (glm-5v-turbo):
- Stand pose: "arms relaxed at her sides, angled slightly outward, 10-15° from vertical"
- Green screen: "background is chroma key green, avatar clearly visible"
- Recording: "red Stop recording button, timer 00:11, avatar visible"
- Gaze OFF: "head facing straight forward (neutral)"
- Gaze ON + mouse top-right: "head yawed toward viewer's right + pitched up, eyes also turned toward mouse (less extreme than before)"

---
Task ID: 4
Agent: Z.ai Code (main agent)
Task: Add arm opening 20°, background image import, middle-click avatar drag, rename to MagicianVT2b, clean up comments

Work Log:
- Changed STAND_POSE arm angle from 85° to 70° (gives 20° outward opening from vertical)
- Added DRAG.SENSITIVITY constant for middle-click drag
- Wrote useAvatarDrag hook (middle-mouse-button drag → avatar offset Vector3 ref)
  - mousedown button===1 starts drag, tracks delta from start
  - Prevents middle-click auto-scroll via contextmenu + auxclick suppression
  - Sets canvas cursor to 'move' while dragging
- Updated VRMAvatar to apply avatarOffsetRef to scene.position in useFrame
- Added BackgroundImage component in VRMScene (loads image URL via TextureLoader, sets scene.background)
- Added priority logic in VRMScene: green screen > background image > default dark color
- Added "Custom Background" toggle in ControlPanel (ImageIcon from lucide-react, aliased to avoid jsx-a11y conflict)
  - Toggle ON → opens file picker (image/*)
  - Toggle OFF → clears background
- Renamed project to MagicianVT2b:
  - layout.tsx metadata (title, description, keywords, OG, Twitter)
  - Header.tsx (h1 title)
  - Footer.tsx (brand text)
  - useScreenRecording download filename prefix
  - package.json name field
- Cleaned up excessive comments across all files:
  - constants.ts: trimmed multi-line docstrings to single-line summaries
  - gazeMath.ts: removed redundant per-line comments, kept only essential "why" comments
  - loadVRM.ts: consolidated setup comments
  - useGazeTracking.ts, useLipSync.ts, useScreenRecording.ts: trimmed docstrings
  - VRMAvatar.tsx, VRMScene.tsx, ControlPanel.tsx: removed redundant inline comments

Stage Summary:
- ✅ Lint passes cleanly (no errors, no warnings)
- ✅ Arms at 20° outward from vertical (VLM confirmed: "approximately 15-20° outward from vertical")
- ✅ Header shows "MagicianVT2b" (VLM confirmed)
- ✅ Middle-click drag works (VLM confirmed: "She is positioned on the right side of the screen" after drag)
- ✅ Custom Background image loads and displays (VLM confirmed: "background is a soft pastel purple-pink gradient, avatar clearly visible")
- ✅ All 6 toggles visible in ControlPanel: Gaze, Capture Outside, LipSync, Auto Blink, Green Screen, Custom Background
- ✅ Record screen button visible
- ✅ Footer sticky at bottom
- ✅ No runtime errors in console (only Three.js deprecation warnings)
- ✅ No more "WebMirror" references anywhere in src/ (verified via grep)

Files modified:
- src/lib/vrm/constants.ts (arm angle, DRAG constant, comment cleanup)
- src/lib/vrm/gazeMath.ts (comment cleanup)
- src/lib/vrm/loadVRM.ts (comment cleanup)
- src/hooks/useGazeTracking.ts (comment cleanup)
- src/hooks/useLipSync.ts (comment cleanup)
- src/hooks/useScreenRecording.ts (rename download prefix, comment cleanup)
- src/hooks/useAvatarDrag.ts (NEW - middle-click drag)
- src/components/vmm/VRMAvatar.tsx (apply avatar offset, comment cleanup)
- src/components/vmm/VRMScene.tsx (BackgroundImage component, priority logic)
- src/components/vmm/ControlPanel.tsx (Custom Background toggle, ImageIcon alias)
- src/components/vmm/Header.tsx (rename to MagicianVT2b)
- src/components/vmm/Footer.tsx (rename to MagicianVT2b)
- src/app/page.tsx (background state, bg file input, drag hook wiring)
- src/app/layout.tsx (metadata rename)
- package.json (name field)

---
Task ID: 5
Agent: Z.ai Code (main agent)
Task: Remove VMagicMirror references, add hide-controls button, make project 100% offline

Work Log:
- Searched entire src/ for external URLs: found only 3 references
  1. layout.tsx: https://z-cdn.chatglm.cn/z-ai/static/logo.svg (favicon)
  2. Header.tsx + Footer.tsx: https://github.com/malaybaku/VMagicMirror (GitHub link)
  3. layout.tsx: next/font/google (Geist + Geist_Mono from Google Fonts CDN at build time)
- Removed ALL VMagicMirror references:
  - Header.tsx: deleted GitHub button entirely
  - Footer.tsx: deleted "Ported from VMagicMirror v5.0.0 by malaybaku" link and text
  - layout.tsx: removed "VMagicMirror" from keywords and description
- Installed geist@1.7.2 npm package (provides Geist + Geist Mono font files locally)
- Replaced next/font/google in layout.tsx with geist package imports
  - Fonts now served from /__nextjs_font/ (Next.js self-hosts from node_modules)
  - Zero network calls to Google Fonts at build or runtime
- Created public/logo.svg (local SVG with violet-fuchsia gradient sparkles)
- Replaced favicon URL in layout.tsx: z-cdn.chatglm.cn → /logo.svg
- Created HideControlsButton component (floating eye/eye-off button, top-right)
- Updated page.tsx: added controlsHidden state, transitions on header/panel/footer
  - When hidden: opacity-0 + pointer-events-none + translate off-screen
  - Toggle button always visible at top-4 right-4 z-50
  - Control panel offset to right-16 to make room for the toggle
- Created scripts/download-assets.sh (idempotent bash script):
  - Downloads default VRM from three-vrm GitHub repo (sparse clone)
  - Writes local logo.svg (no network)
  - Placeholder section for future MediaPipe .task / .wasm models
  - --force flag to re-download
- Updated next.config.ts with async headers() for offline binary assets:
  - /models/*.vrm → Content-Type: model/gltf-binary
  - /wasm/*.wasm → Content-Type: application/wasm + CORP same-origin
  - /models/mediapipe/*.task → Content-Type: application/octet-stream
  - /models/mediapipe/*.bin → Content-Type: application/octet-stream
  - /fonts/* → long-cache headers
- Verified 100% offline via agent-browser network capture:
  - ALL requests go to http://localhost:3000 (zero external)
  - Fonts: /__nextjs_font/geist-latin.woff2 (local via geist package)
  - Logo: /logo.svg (local)
  - VRM: /models/default.vrm (local)
  - JS chunks: /_next/static/chunks/* (bundled by Next.js)
  - Blob: URLs are in-memory (Three.js texture blobs), not network calls

Stage Summary:
- ✅ Zero references to VMagicMirror anywhere in src/ (verified via grep)
- ✅ Header shows "MagicianVT2b" only, no GitHub button (VLM confirmed)
- ✅ Footer shows "MagicianVT2b" only, no VMagicMirror link (VLM confirmed)
- ✅ Hide controls button works (VLM confirmed: hidden = only avatar + eye button; shown = all UI back)
- ✅ 100% offline verified: ALL network requests go to localhost:3000, zero external
- ✅ Fonts served from /__nextjs_font/ (geist npm package, no Google Fonts CDN)
- ✅ Logo served from /logo.svg (local SVG, no z-cdn.chatglm.cn)
- ✅ next.config.ts has proper headers for .wasm/.vrm/.task/.bin (future-proof)
- ✅ scripts/download-assets.sh re-creates public/ assets on fresh clone
- ✅ Lint passes cleanly
- ✅ No runtime errors

Files modified:
- src/app/layout.tsx (geist package, local logo, removed VMagicMirror references)
- src/components/vmm/Header.tsx (removed GitHub button)
- src/components/vmm/Footer.tsx (removed VMagicMirror link and text)
- src/components/vmm/HideControlsButton.tsx (NEW - floating toggle)
- src/app/page.tsx (controlsHidden state, cn import, layout adjustments)
- next.config.ts (async headers for wasm/vrm/task/bin)
- public/logo.svg (NEW - local SVG logo)

Files created:
- scripts/download-assets.sh (idempotent asset downloader)
- public/logo.svg (local SVG)

Dependencies added:
- geist@1.7.2 (provides Geist + Geist Mono font files locally via next/font/local)

---
Task ID: 6
Agent: Z.ai Code (main agent)
Task: Add lighting controls (4 angles + intensity), audit all modules for 100% offline

Work Log:
- Audited all src/ for external URLs: zero fetch(), zero new URL(), zero dynamic import()
- Confirmed @react-three/drei was installed but NEVER imported in src/ → removed it (bun remove)
- Added LightingConfig type + DEFAULT_LIGHTING + LIGHTING constants to constants.ts
  - 4 lights: key, fill, rim, back (each with angle 0-360° + intensity 0-3)
  - Ambient (intensity 0-2, no angle)
  - LIGHTING.RADIUS = 2.5, per-light heights
- Added lightPosition() helper in VRMScene (azimuth → x/z position)
- Updated VRMScene to use lighting config: ambientLight + 3 directionalLight + 1 pointLight
- Rewrote ControlPanel with Tabs: "Avatar" tab (existing controls) + "Lighting" tab (new)
- Lighting tab has 9 sliders:
  - Ambient Intensity
  - Key: Angle + Intensity
  - Fill: Angle + Intensity
  - Rim: Angle + Intensity
  - Back: Angle + Intensity
- Created LightSlider reusable component (label + value + Slider)
- Created LightSection wrapper (name + icon + 2 LightSliders)
- Updated page.tsx: lighting state (DEFAULT_LIGHTING), passed to VRMScene + ControlPanel
- Fixed runtime bug: forgot to pass lighting prop to ControlPanel (only passed onLightingChange)

Stage Summary:
- ✅ Lint passes cleanly (0 errors, 0 warnings)
- ✅ Avatar renders with default lighting (VLM confirmed)
- ✅ Lighting tab visible with all 9 sliders (VLM confirmed)
- ✅ Dragging Key Intensity slider from 1.5 to ~3.0 makes avatar brighter (VLM confirmed: "significantly brighter with more pronounced highlights")
- ✅ 100% offline verified: fresh browser session = ZERO external requests
  - ALL requests go to http://localhost:3000/*
  - Fonts from /_next/static/media/Geist_*.woff2 (geist npm package, local)
  - Logo from /logo.svg (local SVG)
  - VRM from /models/default.vrm (local)
  - JS chunks from /_next/static/chunks/ (bundled by Next.js)
- ✅ Removed unused @react-three/drei (was never imported, reduces footprint)
- ✅ No runtime errors

Module audit (all 100% offline at runtime):
- three: pure JS, no network ✓
- @pixiv/three-vrm: loads VRM from user files, no CDN ✓
- @react-three/fiber: React renderer, no network ✓
- geist: font files bundled via next/font/local ✓
- lucide-react: SVG icons bundled ✓
- framer-motion: animation, no network ✓
- All @radix-ui/* (shadcn): pure React, no network ✓
- next, react, react-dom: framework, no runtime external calls ✓
- next-themes, class-variance-authority, clsx, tailwind-merge: no network ✓

Packages installed but NOT used in app runtime (only in dev/CLI tools):
- z-ai-web-dev-sdk: only used in CLI scripts (web_search, image gen), NOT imported in src/
- next-auth, @tanstack/react-query: installed but not used for external APIs
- prisma/@prisma/client: local SQLite, no external DB

Files modified:
- src/lib/vrm/constants.ts (+ LightingConfig, DEFAULT_LIGHTING, LIGHTING, LIGHT_BACK)
- src/components/vmm/VRMScene.tsx (lighting prop, lightPosition helper, 4 lights reactive)
- src/components/vmm/ControlPanel.tsx (Tabs: Avatar/Lighting, LightSlider, LightSection)
- src/app/page.tsx (lighting state, passed to VRMScene + ControlPanel)
- package.json (removed @react-three/drei)
