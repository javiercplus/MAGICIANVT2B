# Developer Documentation (dev.md)

Architecture, rendering pipeline and module breakdown for **MAGICIANVT2B** (Electron + Next.js + React Three Fiber + `@pixiv/three-vrm`).

## General architecture

The UI is a **static Next.js export** (`output: "export"` in `next.config.ts`). Electron serves the exported `out/` directory through a custom privileged **`app://`** protocol (absolute asset paths like `/_next/...` would break with plain `file://`). All 3D rendering happens in the renderer; all OS-level work (UDP sockets, window management, global cursor) lives in the Electron main process.

```
main.js  ── BrowserWindow ──►  Next.js export (renderer / R3F / three-vrm)
   │  ▲
   │  └── ipcRenderer (preload.js → window.electronAPI)
   └── dgram UDP  ──►  VMC (OSC) sender / receiver (Bones + 52 ARKit Perfect Sync)
```

### Directory structure

- `main.js`, `preload.js` — Electron main process and context bridge.
- `src/app/` — Next.js entry (`page.tsx`), global styles.
- `src/components/vmm/` — avatar/3D/panel components.
- `src/components/ui/` — shadcn/ui primitives.
- `src/hooks/` — browser API logic (gaze, lipsync, drag, recording).
- `src/lib/vrm/` — VRM loading, gaze math, MToon, wind, material FX, optimization, constants.
- `src/lib/vmc/` — OSC encoder/decoder, VMC protocol helpers, and 52 ARKit Perfect Sync mapping.
- `.github/workflows/` — CI (`electron-build.yml`, `vmc-build.yml`).

## Electron main process (`main.js`)

- **Chromium switches** (before `app.whenReady()`): `disable-features=CalculateNativeWinOcclusion`, `disable-gpu-vsync`, `enable-accelerated-video-decode`, `js-flags` (heap + `--expose-gc`).
- **GPU backend**: `resolveGpuBackend()` picks `opengl` (default) or `vulkan` from `MAGICIAN_GPU` env or the packaged `package.json#magicianGpu` (set by `build:electron:vulkan` via `extraMetadata`). Vulkan adds `enable-features=Vulkan`, `use-angle=vulkan`, `enable-unsafe-webgpu`.
- **Wayland → X11 relaunch** so global cursor reads work (`MAGICIAN_NO_XWAYLAND=1` opts out).
- **`app://` protocol** serving `out/` (path-traversal guarded).
- **Frameless window** + custom resize borders and native title bar overlay.
- **Global cursor IPC** (`gaze:get-global-cursor`, `gaze:set-tracking`, `gaze:cursor`) for gaze tracking outside the window.
- **VMC UDP** (see below).

## Preload bridge (`preload.js`)

Exposes `window.electronAPI`:

- `getGlobalCursor`, `setGlobalTracking`, `onGlobalCursor`
- `vmcSend`, `vmcConfigureSend`, `vmcConfigureReceive`, `vmcSetEnabled`, `onVmcPacket`, `onVmcReceiveStatus`

## Renderer entry (`src/app/page.tsx`)

Orchestrates state and persistence:

- Avatar URL/name/status, meta.
- Tracking: `gazeEnabled`, `captureOutside`, `globalTracking`.
- Face: `autoBlink`, `randomEyes`, `idleSway`, `faceWeights` (per-expression & Perfect Sync clips), `perfectSyncNames` (detected 52 ARKit clips on loaded model).
- Scene: `greenScreen`, `chromaColor`, custom `backgroundImageUrl`.
- Look: `lighting`, `adjust` (color), `mtoon`, `shader` (effects), `wind`.
- Camera: `zoom`, `fov`, `orthographic`.
- `optimization` (FPS, render scale, AA, physics, etc.) and `telemetry`.
- `vmcConfig` (send/receive + Perfect Sync toggles) and panel visibility.
- Loads config/avatar from `localStorage`/`IndexedDB` and saves on demand.

## 3D scene (`src/components/vmm/`)

### `VRMScene.tsx`
- R3F `<Canvas>` (`dpr`, ACES tone mapping, exposure).
- Background: chroma color or custom image.
- `CameraRig` (zoom/FOV/ortho + wheel zoom + reset view).
- `RenderSettings` (pixel ratio via `setDpr`), `TelemetryProbe` (500 ms samples), `VmcBridge` (send/receive IPC), `VRMAvatar`, `PostFX`.

### `VRMAvatar.tsx`
Per frame (`useFrame`):
1. Applies avatar offset/rotation (or received VMC root).
2. Local tracking: gaze/random-eyes → head, neck and eye normalized bones (skipped while VMC receive is enabled).
3. Applies received VMC bone poses (upper body/hands/legs/eyes) with optional smoothing.
4. Idle sway (skipped while VMC receive is enabled).
5. Facial expressions: received VMC blendshapes & 52 ARKit Perfect Sync clips (case-insensitive matching + optional fallback to standard VRM expressions) when available, otherwise face weights + lipsync + auto-blink.
6. `vrm.update(dt)` via `updateVRMSelective` (can skip expressions / throttle spring bones).
7. Publishes head transform + all expression weights to `vmcState` for sending.

Loading uses `lib/vrm/loadVRM.ts` (VRMLoaderPlugin, VRM0 rotation, geometry cleanup, auto-registration of raw mesh morph targets for the 52 ARKit Perfect Sync shape keys, neutral expression reset).

### `PostFX.tsx` (post-processing pipeline)
Order: `RenderPass` → `UnrealBloomPass` → `OutputPass` → `Stylize` (chromatic/pixel) → `Adjustment` (brightness/saturation/contrast/hue/temperature) → `FXAA`.

- Internal render targets use `HalfFloatType` and **MSAA `samples: msaa ? 4 : 0`** (configurable in Effects / Optimization).
- `renderScale` shrinks only the composer's internal render targets, never the canvas CSS size (UI stays sharp).
- FPS cap skips `composer.render()` frames; `renderer.info.autoReset` is disabled to report full-frame draw calls.
- Bloom threshold defaults above 1 so white/background (LDR) does not glow; only HDR emissive blooms.

### `materialFX.ts`
Injects GLSL into MToon via `onBeforeCompile` (chaining MToon's own hook): independent flags `uHologramOn`, `uDissolveOn`, `uGlowOn`, `uScanlineOn`, applied in sequence so effects combine. Procedural scanlines use `fwidth()` for analytic anti-aliasing. Outline uses MToon's native outline (never generated on face/mouth parts).

### Other 3D libs
- `lib/vrm/mtoon.ts` — applies the MToon look (toony, GI, shade shift, rim, boost).
- `lib/vrm/wind.ts` — breeze applied to spring bones.
- `lib/vrm/optimization.ts` — low-power material swap (`MeshLambertMaterial`) and selective VRM update.
- `lib/vrm/gazeMath.ts` — gaze math, VRM0 pitch correction, stand pose.

## Panels

- **`AvatarPanel.tsx`** — "VRM model": Model, MToon, Effects (multi-select + FXAA/MSAA), Face (emotion blendshapes + collapsible 52 ARKit Perfect Sync sliders), Wind, and mesh visibility groups (collapsed by default).
- **`ControlPanel.tsx`** — Options: Track, Motion, Scene, Camera, Light, Color.
- **`OptimizationPanel.tsx`** — Render (FPS cap, render scale, FXAA/MSAA, pixel ratio), VRM Boost (physics, morphs, low-power), Telemetry.
- **`VmcPanel.tsx`** — Receive/Send tabs (ports, Ex.Tracker Perfect Sync toggles & clip counter badge, applied parts, calibration, live status).
- Panels are wrapped in `DraggablePanel` so they can be repositioned.

## VMC protocol & Perfect Sync (`src/lib/vmc/`)

- `osc.ts` — dependency-free OSC encoder/decoder (single messages and `#bundle`; `f/i/s/T/F` args; big-endian floats; 4-byte padding).
- `vmc.ts` — bone name maps (Unity ↔ VRM), RH→LH quaternion conversion, `PERFECT_SYNC_CLIP_NAMES` (all 52 ARKit BlendShapeClip names from VMagicMirror / Vear / Luppet / HANA_Tool spec), L/R mirroring for asymmetrical ARKit channels, fallback map to standard VRM expressions, shared `vmcState` / `vmcReceivedState`, packet builders, incoming packet processing.

**Send flow**: `VRMAvatar` fills `vmcState` → `VmcBridge` builds datagrams at ~30 Hz → `electronAPI.vmcSend(Uint8Array)` → main sends UDP to `host:port`.
**Receive flow**: main binds a UDP socket → `vmc:packet` IPC → `VmcBridge` decodes → `vmcReceivedState` → `VRMAvatar` applies poses/blendshapes. While receiving, local gaze/random-eyes/idle-sway are disabled.

## Build & CI

- `npm run build:electron` — Next build + electron-builder (OpenGL).
- `npm run build:electron:vulkan` — same, packaged with `magicianGpu=vulkan` (Linux AppImage under `dist-vulkan/`).
- `.github/workflows/electron-build.yml` — builds on push/PR to `electron`.
- `.github/workflows/vmc-build.yml` — builds on push/PR to `VMC-test`.

## Persistence

- `localStorage` (`magician_vrm_config`): toggles, lighting, adjust, shader, optimization, mtoon, wind, camera, VMC & Perfect Sync config, etc.
- `IndexedDB` (`MagicianVrmDB`): the last `.vrm` blob and name.
