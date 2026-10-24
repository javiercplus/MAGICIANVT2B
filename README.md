# MAGICIANVT2B

**MAGICIANVT2B** is a desktop 3D avatar application for VTubers, built with **Electron + Next.js + React Three Fiber** and **`@pixiv/three-vrm`**. It loads `.vrm` models, tracks your gaze, does microphone lip-sync, and can stream motion to/from other VMC-compatible apps such as **VTube Studio, VSeeFace or VMagicMirror**.

It runs fully offline (static Next.js export served by Electron) and works on Linux, Windows and macOS.

<img width="1279" height="574" alt="MAGICIANVT2B" src="https://github.com/user-attachments/assets/e4f6b525-b8fb-4d01-b2ef-83657e47ffff" />

## Features

- **VRM support** — load custom `.vrm` avatars (VRM 0.x and 1.0).
- **Gaze tracking** — eyes and head follow the mouse; pointer-lock/global tracking to follow the cursor outside the window.
- **Lip sync** — microphone-driven mouth blendshapes.
- **Face** — auto-blink, random eyes, idle sway, plus manual emotion/blendshape controls (Happy, Relaxed, Surprised, Sad, Angry, All neutral, All fun).
- **MToon look** — toon shading, GI equalization, shade shift, rim light and color boost.
- **Effects (multi-select, combinable)** — Hologram, Dissolve, Glow, Scanline, Outline (native MToon), Chromatic, Pixel, plus **FXAA / MSAA 4x** antialiasing.
- **Wind** — breeze on hair/skirt/ribbons driven by spring bones.
- **Lighting & camera** — front/top lights, zoom, FOV, orthographic, view reset.
- **Backgrounds** — chroma screen with configurable key color, or a custom image.
- **Optimization panel** — FPS cap, render-scale (internal render target only), FXAA/MSAA, pixel ratio, physics quality, morph optimization, MToon low-power, and live telemetry (FPS, GPU textures, draw calls).
- **VMC Protocol (send & receive)** — stream head pose + blendshapes to VTube Studio, or receive tracking from other VMC senders. Toggled with the 📻 button (top right).
- **Screen recording** — export the avatar canvas to `.webm`.
- **Auto-save** — avatar and settings persist via IndexedDB + `localStorage`.

## Getting Started

### Web / dev

```bash
npm install        # or: bun install
npm run dev        # or: bun run dev   → http://localhost:4000
```

### Electron (dev)

```bash
npm run dev:electron
```

### Build desktop app

```bash
npm run build:electron          # AppImage / Windows installer in dist/
npm run build:electron:vulkan   # Vulkan build → dist-vulkan/ (Linux)
```

The Vulkan build runs Chromium/ANGLE through Vulkan (`enable-features=Vulkan`, `use-angle=vulkan`). The default build uses OpenGL.

## Usage

1. Drop a `.vrm` file on the canvas, or open **VRM model → Open .vrm**.
2. Tune **VRM model** (MToon, Effects, Face, Wind, meshes), **Options** (Track, Motion, Scene, Camera, Light, Color) and the **Optimization** panel (⚙).
3. Click **Save Config & Avatar** to remember everything for the next launch.

## VMC Protocol

MAGICIANVT2B speaks VMC (OSC over UDP). Open the VMC panel with the **📻 Radio** button.

- **Sending (to VTube Studio, etc.)**
  - Enable **Sending** and set host/port (default `127.0.0.1:39539`).
  - Sends head/root/bone poses and blendshapes every frame (or capped to 30 Hz).
  - In VTube Studio: enable *VMC Protocol* receiving on the same port.
  - Coordinate conversion is Three.js (RH) → VMC/Unity (LH); if the avatar is mirrored/lopsided, use the axis-inversion toggles in the Sending tab.
- **Receiving (from VSeeFace, VRM Posing Desktop, LuppetX, VMagicMirror, …)**
  - Enable **Receiving** and set the listen port (default `39539`).
  - The status line shows `Listening…` / `Live (N bones · M pkts)`.
  - While receiving, local tracking (**gaze, random eyes, idle sway**) is automatically disabled so incoming motion has full control.
  - Choose which parts to apply (upper body, hands/fingers, legs, eyes, root, hips position, blendshapes) and calibration (axis inversion, mirror L/R, smoothing).

Debug packets from the terminal:

```bash
DEBUG_VMC=1 npm run dev:electron
# logs: [VMC Receive] <bytes> <address>   and   [VMC] -> <host>:<port> <address>
```

## Tech stack

- Electron (main process: UDP sockets, custom `app://` protocol, window/global-cursor IPC)
- Next.js (static export) + React + React Three Fiber
- Three.js + `@pixiv/three-vrm` (MToon, spring bones, expressions)
- Custom OSC encoder/decoder (no external OSC dependency)
- Tailwind CSS + shadcn/ui

## Documentation

See [dev.md](dev.md) for the architecture, rendering pipeline and module breakdown.

## License

See [LICENSE](LICENSE).
