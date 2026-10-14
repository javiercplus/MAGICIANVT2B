// Shared counter so telemetry can report the real *render* FPS (frames that
// actually reached the screen), which differs from the engine loop FPS when
// the FPS limiter skips frames. Single-renderer app, so a module singleton
// is safe.
export const renderStats = {
  frames: 0,
};
