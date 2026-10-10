const { app, BrowserWindow, session, protocol, net, ipcMain, screen } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

// Serve the statically exported Next.js build over a custom protocol.
// Using file:// directly breaks the UI because Next emits absolute asset
// paths (/_next/..., /models/..., /logo.svg) that would resolve to the
// filesystem root instead of the `out/` directory.
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

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    // NOTE: transparent frameless windows cannot be resized on Linux, so the
    // window is opaque here and the app draws its own visible border instead.
    backgroundColor: '#0b0b12',
    frame: false,
    hasShadow: true,
    resizable: true,
    webPreferences: {
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

app.whenReady().then(() => {
  registerAppProtocol();
  setupWindowResizing();
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
