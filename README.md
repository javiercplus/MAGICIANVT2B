# MAGICIANVT2B

**MAGICIANVT2B** is a desktop 3D avatar application for VTubers, built with **Electron + Next.js + React Three Fiber** and **`@pixiv/three-vrm`**. It loads `.vrm` models, tracks your gaze, does microphone lip-sync, and can stream motion and **52 ARKit Perfect Sync** blendshapes to/from other VMC-compatible apps such as **VMagicMirror, VTube Studio, VSeeFace, Luppet or Vear**.

It runs fully offline (static Next.js export served by Electron) and works on Linux, Windows and macOS.

<img width="1217" height="553" alt="image" src="https://github.com/user-attachments/assets/43e81b4b-6d38-4771-a368-e94e5be7eff9" />


## Features

- **VRM support** — load custom `.vrm` avatars (VRM 0.x and 1.0).
- **Perfect Sync (52 ARKit BlendShapeClips)** — full support for VMagicMirror / HANA_Tool / Vear / Luppet 52 ARKit facial expressions (`BrowInnerUp` … `TongueOut`) over VMC Protocol, with automatic morph target binding and optional fallback to standard VRM expressions.
- **Gaze tracking** — eyes and head follow the mouse; pointer-lock/global tracking to follow the cursor outside the window.
- **Lip sync** — microphone-driven mouth blendshapes.
- **Face** — auto-blink, random eyes, idle sway, manual emotion/blendshape controls (Happy, Relaxed, Surprised, Sad, Angry, All neutral, All fun), plus individual sliders for all detected Perfect Sync clips.
- **MToon look** — toon shading, GI equalization, shade shift, rim light and color boost.
- **Effects (multi-select, combinable)** — Hologram, Dissolve, Glow, Scanline, Outline (native MToon), Chromatic, Pixel, plus **FXAA / MSAA 4x** antialiasing.
- **Wind** — breeze on hair/skirt/ribbons driven by spring bones.
- **Lighting & camera** — front/top lights, zoom, FOV, orthographic, view reset.
- **Backgrounds** — chroma screen with configurable key color, or a custom image.
- **Optimization panel** — FPS cap, render-scale (internal render target only), FXAA/MSAA, pixel ratio, physics quality, morph optimization, MToon low-power, and live telemetry (FPS, GPU textures, draw calls).
- **VMC Protocol (send & receive)** — stream head/skeleton pose + standard & Perfect Sync blendshapes, or receive tracking from external trackers. Toggled with the 📻 button (top right).
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

## VMC Protocol & Perfect Sync

MAGICIANVT2B speaks VMC (OSC over UDP) and supports **VMagicMirror's Perfect Sync** specification (52 iOS ARKit FaceTracking BlendShapeClips). Open the VMC panel with the **📻 Radio** button.

- **Receiving (from VMagicMirror, VSeeFace, LuppetX, VRM Posing Desktop, …)**
  - Enable **Receiving** and set the listen port (default `39539`).
  - Turn on **Use Perfect Sync** under *Ex.Tracker · Perfect Sync (52 ARKit BlendShapes)* to map all 52 ARKit clips (`BrowInnerUp`, `JawOpen`, `MouthFunnel`, `TongueOut`, etc.) directly to the model's `BlendShapeClip`s or raw mesh shape keys.
  - Enable **Standard VRM Fallback** so models without Perfect Sync clips still respond with standard VRM expressions (`aa`, `oh`, `ou`, `ee`, `happy`, `sad`, `angry`, `surprised`, `blinkLeft`/`blinkRight`, `look*`).
  - The status badge shows how many of the 52 Perfect Sync clips your loaded VRM model has (`PS N/52`) and live received ARKit channel counts.
- **Sending (to VMagicMirror, VTube Studio, etc.)**
  - Enable **Sending** and set host/port (default `127.0.0.1:39539`).
  - Sends head/root/bone poses, standard VRM expressions, and all 52 ARKit Perfect Sync blendshapes (`/VMC/Ext/Blend/Val` + `/VMC/Ext/Blend/Apply`).

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
