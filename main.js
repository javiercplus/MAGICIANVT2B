const path = require('path');
const fs = require('fs');
const dgram = require('dgram');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

let app, BrowserWindow, session, protocol, net, ipcMain, screen;

// Native Wayland forbids reading the global cursor, so screen.getCursorScreenPoint()
// returns (0,0) and gaze tracking cannot follow the pointer outside the window.
// The ozone platform can only be chosen before Chromium starts, so when XWayland
// is available we relaunch ourselves on the X11 backend. Opt out with
// MAGICIAN_NO_XWAYLAND=1; the child sets MAGICIAN_XWAYLAND=1 to avoid looping.
function relaunchOnWaylandForX11() {
  if (process.platform !== 'linux' || process.env.MAGICIAN_NO_XWAYLAND === '1') return false;
  if (process.env.MAGICIAN_XWAYLAND === '1') return false;
  const isWayland = !!process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === 'wayland';
  if (!isWayland) return false;

  let display = process.env.DISPLAY;
  if (!display || !/^:\d+/.test(display)) {
    try {
      const socket = fs.readdirSync('/tmp/.X11-unix').find((f) => /^X\d+$/.test(f));
      if (socket) display = ':' + socket.slice(1);
    } catch {}
  }
  if (!display || !/^:\d+/.test(display)) return false;

  const child = spawn(process.execPath, [...process.argv.slice(1), '--ozone-platform=x11'], {
    env: { ...process.env, DISPLAY: display, MAGICIAN_XWAYLAND: '1' },
    stdio: 'inherit',
  });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 0);
  });
  return true;
}

const relaunchedOnX11 = relaunchOnWaylandForX11();

// Which GPU backend this build should use. "opengl" (default) or "vulkan".
// Priority: MAGICIAN_GPU env var (dev / manual) > package.json `magicianGpu`
// field (baked in at package time via electron-builder extraMetadata).
function resolveGpuBackend() {
  const env = (process.env.MAGICIAN_GPU || '').toLowerCase();
  if (env === 'vulkan' || env === 'opengl') return env;
  try {
    const field = require('./package.json').magicianGpu;
    if (typeof field === 'string' && field.toLowerCase() === 'vulkan') return 'vulkan';
  } catch {}
  return 'opengl';
}

const GPU_BACKEND = resolveGpuBackend();

// Serve the statically exported Next.js build over a custom protocol.
// Using file:// directly breaks the UI because Next emits absolute asset
// paths (/_next/..., /models/..., /logo.svg) that would resolve to the
// filesystem root instead of the `out/` directory.
if (!relaunchedOnX11) {
  ({ app, BrowserWindow, session, protocol, net, ipcMain, screen } = require('electron'));

  // Chromium switches. MUST run before app.whenReady() (and before any
  // BrowserWindow is created) so Chromium picks them up at startup.
  //  - CalculateNativeWinOcclusion: on Windows Chromium throttles/pauses the
  //    renderer when the window is fully occluded; VTuber captures keep the
  //    window "hidden" behind OBS, so disable it to keep rendering.
  //  - disable-gpu-vsync: uncouples rAF from the display refresh. The app caps
  //    its own FPS in the Three.js loop, so we don't need the driver's vsync.
  //  - enable-accelerated-video-decode: hardware video decode (webcam/overlays).
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
  app.commandLine.appendSwitch('disable-gpu-vsync');
  app.commandLine.appendSwitch('enable-accelerated-video-decode');

  // NOTE: appendSwitch replaces any previous value for the same switch, so all
  // V8 flags must be passed in a single 'js-flags' call (joined by spaces).
  //  - --max-old-space-size=512: cap the heap so long sessions don't balloon.
  //  - --expose-gc: exposes global.gc() for manual collection (e.g. after
  //    unloading a VRM) to release textures/geometries promptly.
  app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512 --expose-gc');

  // GPU backend. When this build targets "vulkan" (see resolveGpuBackend),
  // route Chromium/ANGLE through Vulkan instead of the default OpenGL backend.
  // This is what makes the separate Vulkan AppImage behave differently from
  // the OpenGL one without needing runtime flags from the user.
  if (GPU_BACKEND === 'vulkan') {
    app.commandLine.appendSwitch('enable-features', 'Vulkan');
    app.commandLine.appendSwitch('use-angle', 'vulkan');
    app.commandLine.appendSwitch('enable-unsafe-webgpu');
  }

  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true,
      },
    },
  ]);
}

const OUT_DIR = path.join(__dirname, 'out');

function registerAppProtocol() {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    let decodedPath = decodeURIComponent(pathname);

    if (decodedPath === '/' || decodedPath === '') {
      decodedPath = '/index.html';
    }
    if (decodedPath.endsWith('/')) {
      decodedPath += 'index.html';
    }

    const filePath = path.normalize(path.join(OUT_DIR, decodedPath));

    // Prevent path traversal outside of the exported build directory.
    if (!filePath.startsWith(OUT_DIR)) {
      return new Response('Forbidden', { status: 403 });
    }

    return net.fetch(pathToFileURL(filePath).toString());
  });
}

// Frameless, transparent windows cannot rely on the window manager to
// provide resize borders on Linux. We implement edge resizing ourselves:
// the renderer sends a direction on pointer-down and the main process
// tracks the global cursor position until the drag ends.
const MIN_WIDTH = 320;
const MIN_HEIGHT = 180;
const resizeSessions = new Map();

function setupWindowResizing() {
  ipcMain.on('window-resize-start', (event, dir) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;

    const id = event.sender.id;
    if (resizeSessions.has(id)) clearInterval(resizeSessions.get(id).timer);

    const session = {
      dir,
      startCursor: screen.getCursorScreenPoint(),
      startBounds: win.getBounds(),
      timer: null,
    };

    session.timer = setInterval(() => {
      if (win.isDestroyed()) {
        clearInterval(session.timer);
        resizeSessions.delete(id);
        return;
      }

      const cursor = screen.getCursorScreenPoint();
      const dx = cursor.x - session.startCursor.x;
      const dy = cursor.y - session.startCursor.y;
      const { x, y, width, height } = session.startBounds;

      let nextX = x;
      let nextY = y;
      let nextWidth = width;
      let nextHeight = height;

      if (dir.includes('e')) nextWidth = Math.max(MIN_WIDTH, width + dx);
      if (dir.includes('s')) nextHeight = Math.max(MIN_HEIGHT, height + dy);
      if (dir.includes('w')) {
        nextWidth = Math.max(MIN_WIDTH, width - dx);
        nextX = x + (width - nextWidth);
      }
      if (dir.includes('n')) {
        nextHeight = Math.max(MIN_HEIGHT, height - dy);
        nextY = y + (height - nextHeight);
      }

      win.setBounds({
        x: Math.round(nextX),
        y: Math.round(nextY),
        width: Math.round(nextWidth),
        height: Math.round(nextHeight),
      });
    }, 16);

    resizeSessions.set(id, session);
  });

  ipcMain.on('window-resize-end', (event) => {
    const id = event.sender.id;
    const session = resizeSessions.get(id);
    if (session) {
      clearInterval(session.timer);
      resizeSessions.delete(id);
    }
  });
}

// DOM mousemove events only fire while the cursor is over the window. To let
// the avatar gaze follow the pointer anywhere on the screen, the renderer asks
// the main process for the global cursor position. We translate screen
// coordinates into window-local coordinates so the renderer can reuse the same
// gaze math it uses for in-window mouse events.
//
// If we are stuck on native Wayland (relaunch failed) the global cursor is
// unreadable and getCursorScreenPoint() returns (0,0). Returning that would pin
// the gaze to a bogus origin, so we return null and let the renderer fall back
// to in-window tracking.
function globalCursorBlocked() {
  return process.platform === 'linux'
    && process.env.MAGICIAN_XWAYLAND !== '1'
    && (!!process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === 'wayland');
}

function readGlobalCursor(sender) {
  const win = BrowserWindow.fromWebContents(sender);
  if (!win || win.isDestroyed() || globalCursorBlocked()) return null;
  const cursor = screen.getCursorScreenPoint();
  const bounds = win.getBounds();
  return {
    x: cursor.x - bounds.x,
    y: cursor.y - bounds.y,
    windowFocused: win.isFocused(),
  };
}

function setupGlobalCursor() {
  // The renderer cannot poll reliably on its own: requestAnimationFrame (and
  // timers) are throttled or paused when the window is unfocused or occluded,
  // which is exactly when the pointer is outside the window. So the main process
  // pushes cursor updates on a timer that is not tied to renderer visibility.
  const timers = new Map();

  const stop = (id) => {
    const timer = timers.get(id);
    if (timer) { clearInterval(timer); timers.delete(id); }
  };

  ipcMain.handle('gaze:get-global-cursor', (event) => readGlobalCursor(event.sender));

  ipcMain.on('gaze:set-tracking', (event, enabled) => {
    const sender = event.sender;
    stop(sender.id);
    if (!enabled) return;

    const timer = setInterval(() => {
      if (sender.isDestroyed()) { stop(sender.id); return; }
      const pos = readGlobalCursor(sender);
      if (pos) sender.send('gaze:cursor', pos);
    }, 16);
     timers.set(sender.id, timer);
  });
}

// === VMC Protocol (OSC over UDP) ============================================
// Supports both Sending (Performer -> Marionette) and Receiving (Marionette <- Performer)
// on independent UDP sockets and configurable ports/addresses.
function decodeOscAddress(buf) {
  let addr = '';
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (c === 0) break;
    addr += String.fromCharCode(c);
  }
  return addr;
}

function setupVmc() {
  const sendSocket = dgram.createSocket('udp4');
  let sendEnabled = false;
  let sendHost = '127.0.0.1';
  let sendPort = 39539;

  let receiveSocket = null;
  let receiveEnabled = false;
  let receivePort = 39539;

  const debug = process.env.DEBUG_VMC === '1';

  const broadcastReceiveStatus = (status) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('vmc:receive-status', status);
      }
    }
  };

  const stopReceiveSocket = () => {
    if (receiveSocket) {
      try {
        receiveSocket.removeAllListeners();
        receiveSocket.close();
      } catch {}
      receiveSocket = null;
    }
  };

  const startReceiveSocket = (port) => {
    stopReceiveSocket();
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    receiveSocket = sock;

    sock.on('error', (err) => {
      if (debug) console.error('[VMC Receive Error]', err.message);
      broadcastReceiveStatus({
        listening: false,
        port,
        error: err.message || 'UDP bind error',
      });
    });

    sock.on('listening', () => {
      const addr = sock.address();
      if (debug) console.log(`[VMC Receive] Listening on ${addr.address}:${addr.port}`);
      broadcastReceiveStatus({
        listening: true,
        port: addr.port,
        error: null,
      });
    });

    sock.on('message', (msg) => {
      // Copy the bytes: `msg` is a view over a pooled Node Buffer, and sending
      // a pooled view through IPC can carry the wrong byte range. Uint8Array.from
      // produces a standalone copy that structured-clone sends reliably.
      const data = Uint8Array.from(msg);
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('vmc:packet', data);
        }
      }
      if (debug) {
        console.log(`[VMC Receive] ${data.length} bytes ${decodeOscAddress(data)}`);
      }
    });

    try {
      sock.bind(port, '0.0.0.0');
    } catch (err) {
      broadcastReceiveStatus({
        listening: false,
        port,
        error: err.message || 'Failed to bind UDP port',
      });
    }
  };

  // Legacy channel support
  ipcMain.on('vmc:set-enabled', (_event, value) => {
    sendEnabled = !!value;
    if (debug) console.log(`[VMC Send] ${sendEnabled ? 'enabled' : 'disabled'}`);
  });

  ipcMain.on('vmc:configure-send', (_event, cfg) => {
    if (!cfg || typeof cfg !== 'object') return;
    sendEnabled = !!cfg.enabled;
    if (typeof cfg.host === 'string' && cfg.host.trim()) {
      sendHost = cfg.host.trim();
    }
    const p = Number(cfg.port);
    if (Number.isInteger(p) && p > 0 && p <= 65535) {
      sendPort = p;
    }
    if (debug) {
      console.log(`[VMC Send] enabled=${sendEnabled} target=${sendHost}:${sendPort}`);
    }
  });

  ipcMain.on('vmc:configure-receive', (_event, cfg) => {
    if (!cfg || typeof cfg !== 'object') return;
    const nextEnabled = !!cfg.enabled;
    const p = Number(cfg.port);
    const nextPort = Number.isInteger(p) && p > 0 && p <= 65535 ? p : receivePort;

    if (!nextEnabled) {
      receiveEnabled = false;
      receivePort = nextPort;
      stopReceiveSocket();
      broadcastReceiveStatus({ listening: false, port: receivePort, error: null });
      return;
    }

    if (receiveEnabled && receiveSocket && receivePort === nextPort) {
      return;
    }

    receiveEnabled = true;
    receivePort = nextPort;
    startReceiveSocket(receivePort);
  });

  ipcMain.on('vmc:send', (_event, buffer) => {
    if (!sendEnabled || !buffer) return;
    const buf = Buffer.from(buffer);
    sendSocket.send(buf, 0, buf.length, sendPort, sendHost, (err) => {
      if (err && debug) console.error('[VMC Send Error]', err.message);
    });
    if (debug) console.log(`[VMC] -> ${sendHost}:${sendPort} ${decodeOscAddress(buf)} (${buf.length} bytes)`);
  });
}

function createWindow() {
  const isMac = process.platform === 'darwin';

  // Keep the frameless look while delegating the close/minimize/maximize
  // buttons to the OS. On Windows and Linux `titleBarOverlay` draws the native
  // caption buttons over the custom UI; on macOS `hiddenInset` keeps the
  // traffic lights. The custom resize border is retained for Linux, where
  // frameless windows cannot rely on the window manager for resizing.
  const titleBarOptions = isMac
    ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 14 } }
    : {
        titleBarStyle: 'hidden',
        titleBarOverlay: {
          color: '#0b0b12',
          symbolColor: '#e4e4e7',
          height: 36,
        },
      };

  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    // NOTE: transparent frameless windows cannot be resized on Linux, so the
    // window is opaque here and the app draws its own visible border instead.
    backgroundColor: '#0b0b12',
    ...titleBarOptions,
    hasShadow: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      webgl: true
    }
  });

  // Otorgar todos los permisos de hardware necesarios
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'camera', 'microphone', 'display-capture'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    return true;
  });

  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

  if (isDev) {
    win.loadURL('http://localhost:4000');
  } else {
    // Load the exported build through the custom protocol so that the
    // root-absolute asset paths emitted by Next.js resolve correctly.
    win.loadURL('app://bundle/index.html');
  }
}

if (!relaunchedOnX11) {
  app.whenReady().then(() => {
    registerAppProtocol();
    setupWindowResizing();
    setupGlobalCursor();
    setupVmc();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
