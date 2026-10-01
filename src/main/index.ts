import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { setupIPCHandlers, getOrchestrator } from './ipc/handlers.js';
import { DatabaseManager } from './services/database.js';

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  const preloadPath = app.isPackaged
    ? path.join(process.resourcesPath, 'preload/preload/index.js')
    : path.join(__dirname, '../../../preload/preload/index.js');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    icon: path.join(__dirname, '../../renderer/assets/icon.png'),
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 15, y: 10 },
    show: false,
    backgroundColor: '#09141f',
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(process.resourcesPath, 'app.asar/dist/renderer/index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  setupIPCHandlers(mainWindow);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
};

app.on('ready', () => {
  DatabaseManager.getInstance();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow) mainWindow.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  // Orchestrator cleanup handled automatically
});

ipcMain.handle('dialog:openFile', async () => {
  if (!mainWindow) return undefined;
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'] });
  return result.canceled ? undefined : result.filePaths;
});

ipcMain.handle('dialog:saveFile', async () => {
  if (!mainWindow) return undefined;
  const result = await dialog.showSaveDialog(mainWindow);
  return result.canceled ? undefined : result.filePath;
});

ipcMain.handle('dialog:openDirectory', async () => {
  if (!mainWindow) return undefined;
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return result.canceled ? undefined : result.filePaths;
});

ipcMain.handle('app:getPath', (_event, name: string) => app.getPath(name as any));
ipcMain.handle('app:getVersion', () => app.getVersion());
ipcMain.handle('app:quit', () => app.quit());

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});