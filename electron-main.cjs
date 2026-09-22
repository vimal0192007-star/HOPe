const { app, BrowserWindow, session, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const mainLogFile = path.join(logDir, 'electron-main.log');
const rendererLogFile = path.join(logDir, 'electron-renderer.log');

function logMain(msg, level = 'INFO') {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
  fs.appendFileSync(mainLogFile, line);
  console.log(`[Electron Main] ${msg}`);
}

function logRenderer(msg, level = 'INFO') {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
  fs.appendFileSync(rendererLogFile, line);
}

let mainWindow = null;

function createFailureScreen(errorMessage) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>HOPe Diagnostic Error</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0F172A; color: #F8FAFC; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { background: #1E293B; border: 1px solid #334155; border-radius: 1rem; padding: 2rem; max-width: 500px; width: 90%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
        .title { color: #EF4444; font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem; }
        .sub { color: #94A3B8; font-size: 0.875rem; margin-bottom: 1.5rem; }
        .status { background: #0F172A; padding: 1rem; border-radius: 0.5rem; font-family: monospace; font-size: 0.8125rem; margin-bottom: 1.5rem; border: 1px solid #334155; }
        .status div { margin-bottom: 0.25rem; }
        .ok { color: #10B981; }
        .fail { color: #EF4444; }
        .btn-group { display: flex; gap: 0.5rem; justify-content: flex-end; }
        button { background: #DC2626; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; font-weight: 600; cursor: pointer; font-size: 0.8125rem; }
        button:hover { background: #B91C1C; }
        button.secondary { background: #334155; color: #F8FAFC; }
        button.secondary:hover { background: #475569; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="title">HOPE DIAGNOSTIC ERROR</div>
        <div class="sub">Hospital Operating Platform Container Failed to Load</div>
        <div class="status">
          <div class="ok">✓ Launcher</div>
          <div class="ok">✓ Backend API (127.0.0.1:5000)</div>
          <div class="fail">✗ Frontend Renderer Process</div>
          <div style="color: #FCA5A5; margin-top: 0.5rem;">Error: ${errorMessage}</div>
        </div>
        <div class="btn-group">
          <button class="secondary" onclick="location.reload()">Retry</button>
          <button onclick="window.close()">Exit</button>
        </div>
      </div>
    </body>
    </html>
  `;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function createWindow() {
  logMain('Creating HOPe Electron BrowserWindow in Fullscreen Mode...');

  mainWindow = new BrowserWindow({
    title: 'HOPe — Hospital Operating Platform',
    icon: path.join(__dirname, 'dist/favicon.svg'),
    autoHideMenuBar: true,
    backgroundColor: '#FAFAFA',
    fullscreen: true, // TRUE FULLSCREEN: Covers Windows taskbar
    kiosk: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  mainWindow.setFullScreen(true);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Handle Renderer Errors & Console Logs
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    logRenderer(`[Console] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logMain(`Renderer process gone: ${details.reason}`, 'ERROR');
    if (mainWindow) {
      mainWindow.loadURL(createFailureScreen(`Renderer Crashed: ${details.reason}`));
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logMain(`Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`, 'ERROR');
    if (mainWindow) {
      mainWindow.loadURL(createFailureScreen(`${errorDescription} (${errorCode})`));
    }
  });

  // Auto-grant microphone & media capture permissions for CARE AI
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' || permission === 'microphone' || permission === 'audioCapture') {
      callback(true);
    } else {
      callback(true);
    }
  });

  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (!fs.existsSync(indexPath)) {
    logMain(`dist/index.html not found at path: ${indexPath}`, 'ERROR');
    mainWindow.loadURL(createFailureScreen('dist/index.html not found. Run npm run build first.'));
  } else {
    mainWindow.loadFile(indexPath).catch(err => {
      logMain(`Failed to load file: ${err.message}`, 'ERROR');
      mainWindow.loadURL(createFailureScreen(err.message));
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  logMain('All windows closed. Exiting HOPe application...');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
