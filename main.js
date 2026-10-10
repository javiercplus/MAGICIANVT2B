const path = require('path');
const fs = require('fs');
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

// Serve the statically exported Next.js build over a custom protocol.
// Using file:// directly breaks the UI because Next emits absolute asset
// paths (/_next/..., /models/..., /logo.svg) that would resolve to the
// filesystem root instead of the `out/` directory.
if (!relaunchedOnX11) {
  ({ app, BrowserWindow, session, protocol, net, ipcMain, screen } = require('electron'));

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
