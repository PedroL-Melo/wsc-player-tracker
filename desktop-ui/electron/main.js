const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow = null;
let backendProcess = null;

function startBackendServer() {
  if (!app.isPackaged) {
    // Em modo de desenvolvimento, o backend roda via terminal ou start-tracker.bat
    return;
  }

  const backendExePath = path.join(
    process.resourcesPath,
    'wsc-backend',
    'wsc-backend.exe'
  );

  if (fs.existsSync(backendExePath)) {
    backendProcess = spawn(backendExePath, [], {
      cwd: path.dirname(backendExePath),
      windowsHide: true,
      stdio: 'ignore',
    });

    backendProcess.on('error', (err) => {
      console.error('Erro ao iniciar o motor WSC:', err);
    });
  } else {
    console.error('Executável do backend não encontrado em:', backendExePath);
  }
}

function stopBackendServer() {
  if (backendProcess && !backendProcess.killed) {
    try {
      spawn('taskkill', ['/pid', String(backendProcess.pid), '/f', '/t'], {
        windowsHide: true,
      });
    } catch (e) {
      backendProcess.kill();
    }
    backendProcess = null;
  }
}

function createWindow() {
  // Remove a barra de menu padrão do Windows
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#020617', // slate-950
    autoHideMenuBar: true,
    title: 'WSC Player Career Tracker',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';

  if (!app.isPackaged) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackendServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  stopBackendServer();
});

app.on('window-all-closed', () => {
  stopBackendServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
