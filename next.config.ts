import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ['192.168.1.111', 'localhost', '127.0.0.1'],

  // Custom headers for offline-served binary assets. Critical for:
  //  - .wasm: must be Content-Type: application/wasm for streaming compile
  //  - .vrm: glTF binary MIME so loaders detect format correctly
  //  - .task / .bin: MediaPipe model files (future use)
  //  - .woff2: long-cache fonts
  async headers() {
    return [
      {
        source: "/models/(.*)\\.vrm",
        headers: [
          { key: "Content-Type", value: "model/gltf-binary" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/wasm/(.*)\\.wasm",
        headers: [
          { key: "Content-Type", value: "application/wasm" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          // Required for WebAssembly streaming compilation cross-origin
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/models/mediapipe/(.*)\\.task",
        headers: [
          { key: "Content-Type", value: "application/octet-stream" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/models/mediapipe/(.*)\\.bin",
        headers: [
          { key: "Content-Type", value: "application/octet-stream" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/fonts/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
