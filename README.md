# MAGICIANVT2B

**MAGICIANVT2B** is a lightweight, browser-based 3D avatar application for VTubers, built with Next.js, React Three Fiber, and `@pixiv/three-vrm`. 

It allows you to load `.vrm` models, manipulate lighting, and use your microphone and mouse to bring your avatar to life directly in your browser.

<img width="1278" height="595" alt="image" src="https://github.com/user-attachments/assets/e36a4aac-d652-4dda-ad42-566dbd604638" />


## Features

- **VRM Support**: Load your custom `.vrm` VTuber models directly into the browser.
- **Gaze Tracking**: Your avatar's eyes and head follow your mouse movements. Supports Pointer Lock to capture mouse movements outside the browser window.
- **Lip Sync**: Real-time mouth movements synchronized with your microphone's audio input.
- **Lighting Controls**: Fine-tune the 3D scene's Ambient, Key, Fill, Rim, and Back lights.
- **Backgrounds & Green Screen**: Use a built-in green screen for OBS chroma-keying, or upload custom image backgrounds.
- **Screen Recording**: Record your avatar directly from the browser.
- **Auto-Save**: Save your current workspace (avatar and settings) so they load automatically the next time you open the app.
- **100% Client-Side**: No backend required. Models and configurations are saved locally via IndexedDB and `localStorage`.

## Getting Started
You can use the webapp https://magicianvt-2-b.vercel.app/
or run offline :
1. **Install dependencies**:
   ```bash
   npm install
   # or
   bun install
   ```

2. **Run the development server**:
   ```bash
   npm run dev
   # or
   bun run dev
   ```

3. Open [http://localhost:4000](http://localhost:4000) with your browser to see the result.

## Usage

1. Open the app and drag & drop a `.vrm` file into the canvas, or click **Open .vrm** in the top-right control panel.
2. Toggle features like **Gaze Tracking**, **Auto Blink**, and **LipSync** as desired.
3. Once you're happy with your lighting setup and avatar, click **Save Config & Avatar** to remember your settings for the next session.

## Documentation

For an in-depth breakdown of the architecture, custom hooks, and inner workings, check out [dev.md](dev.md).
