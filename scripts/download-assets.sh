#!/usr/bin/env bash
#
# download-assets.sh
#
# Downloads all external assets required by MagicianVT2b so the project
# runs 100% offline. Idempotent: skips files that already exist.
#
# Usage:
#   bash scripts/download-assets.sh          # download everything
#   bash scripts/download-assets.sh --force  # re-download even if present

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_DIR="${SCRIPT_DIR}/../public"
FORCE=0

if [[ "${1:-}" == "--force" || "${1:-}" == "-f" ]]; then
  FORCE=1
fi

echo "MagicianVT2b — offline asset downloader"
echo "Public dir: ${PUBLIC_DIR}"
echo

ensure_dir() { mkdir -p "$1"; }

write_file() {
  local path="$1" content="$2"
  if [[ -f "${path}" && ${FORCE} -eq 0 ]]; then
    echo "  ✓ exists, skipping: ${path#${PUBLIC_DIR}/}"
    return 0
  fi
  mkdir -p "$(dirname "${path}")"
  printf '%s' "${content}" > "${path}"
  echo "  ✓ written: ${path#${PUBLIC_DIR}/}"
}

# --- 1. Default VRM model (Pixiv three-vrm repo) --------------------------
echo "[1/3] VRM sample model"
VRM_DIR="${PUBLIC_DIR}/models"
ensure_dir "${VRM_DIR}"
VRM_PATH="${VRM_DIR}/default.vrm"

if [[ ! -f "${VRM_PATH}" || ${FORCE} -eq 1 ]]; then
  TMP_CLONE="$(mktemp -d)"
  if git clone --depth 1 --filter=blob:none --sparse https://github.com/pixiv/three-vrm.git "${TMP_CLONE}" 2>/dev/null; then
    (cd "${TMP_CLONE}" && git sparse-checkout set packages/three-vrm/examples/models 2>/dev/null)
    if [[ -f "${TMP_CLONE}/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm" ]]; then
      cp "${TMP_CLONE}/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm" "${VRM_PATH}"
      echo "  ✓ cloned: models/default.vrm"
    else
      echo "  ✗ VRM sample not found in clone" >&2
      rm -rf "${TMP_CLONE}"
      exit 1
    fi
    rm -rf "${TMP_CLONE}"
  else
    echo "  ✗ git clone failed (no network or git missing)" >&2
    exit 1
  fi
else
  echo "  ✓ exists, skipping: models/default.vrm"
fi

# --- 2. App logo (local SVG, no network) ----------------------------------
echo
echo "[2/3] App logo (local SVG)"
LOGO_PATH="${PUBLIC_DIR}/logo.svg"
LOGO_CONTENT='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#d946ef"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="#0b0b12"/>
  <path d="M32 8 L35.5 24.5 L52 28 L35.5 31.5 L32 48 L28.5 31.5 L12 28 L28.5 24.5 Z" fill="url(#g)"/>
  <circle cx="48" cy="48" r="3.5" fill="url(#g)"/>
  <circle cx="16" cy="16" r="2.5" fill="url(#g)"/>
  <circle cx="50" cy="16" r="2" fill="url(#g)"/>
</svg>
'
write_file "${LOGO_PATH}" "${LOGO_CONTENT}"

# --- 3. MediaPipe / WASM (placeholder for future) -------------------------
echo
echo "[3/3] MediaPipe / WASM models (not used yet)"
ensure_dir "${PUBLIC_DIR}/models/mediapipe"
ensure_dir "${PUBLIC_DIR}/wasm"

# When MediaPipe face/hand tracking is added, uncomment these:
# download "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker.task" \
#   "${PUBLIC_DIR}/models/mediapipe/face_landmarker.task" 100000

echo "  (skipped — no MediaPipe/WASM assets in use)"

# --- Summary ---------------------------------------------------------------
echo
echo "=== Summary ==="
echo "VRM model:  $([[ -f ${VRM_PATH} ]] && echo '✓ present' || echo '✗ MISSING')"
echo "Logo:       $([[ -f ${LOGO_PATH} ]] && echo '✓ present' || echo '✗ MISSING')"
echo
echo "All assets are local under public/. Ready for offline use."
