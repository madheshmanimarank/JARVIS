import { ipcMain, dialog, shell, app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage } from 'electron';
import { AIRouter, createAIRouter, getAIRouter } from '@core/ai/AIRouter.js';
import { DatabaseManager } from '@main/services/database.js';
import { AIOrchestrator, createAIOrchestrator, getAIOrchestrator } from '@main/services/orchestrator.js';
import { ToolManager } from '@core/tools/ToolManager.js';
import { MemoryManager } from '@core/memory/MemoryManager.js';
import { AIProviderType, VoiceState } from '@shared/types';
import type { AppSettings, ToolResult, SystemMetrics } from '@shared/types';
import { IPC_CHANNELS, DEFAULT_SETTINGS } from '@shared/constants';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let orchestrator: AIOrchestrator | null = null;
let settings: AppSettings = DEFAULT_SETTINGS as AppSettings;

export function setupIPCHandlers(window: BrowserWindow): void {
  mainWindow = window;
  initializeServices();
  registerAIHandlers();
  registerVoiceHandlers();
  registerConversationHandlers();
  registerMemoryHandlers();
  registerToolHandlers();
  registerSystemHandlers();
  registerSettingsHandlers();
  registerWindowHandlers();
  setupGlobalShortcut();
  setupTray();
}

function initializeServices(): void {
  const db = DatabaseManager.getInstance();
  settings = db.getSettings();
  orchestrator = createAIOrchestrator(settings);
}

function registerAIHandlers(): void {
  ipcMain.handle(IPC_CHANNELS['ai:chat'], async (_event, request) => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    return orchestrator.chat(request);
  });

  ipcMain.handle(IPC_CHANNELS['ai:stream'], async (_event, request) => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    const generator = orchestrator.streamChat(request);
    const chunks: any[] = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }
    return chunks;
  });

  ipcMain.handle(IPC_CHANNELS['ai:models'], async (_event, providerType) => {
    const router = getAIRouter();
    if (!router) throw new Error('Router not initialized');
    return router.listModels(providerType);
  });

  ipcMain.handle(IPC_CHANNELS['ai:status'], async (_event, providerType) => {
    const router = getAIRouter();
    if (!router) throw new Error('Router not initialized');
    if (providerType) {
      return router.getProviderStatus(providerType);
    }
    return router.getAllProviderStatuses();
  });

  ipcMain.handle(IPC_CHANNELS['ai:pull-model'], async (_event, name) => {
    const router = getAIRouter();
    if (!router) throw new Error('Router not initialized');
    return router.pullOllamaModel(name);
  });

  ipcMain.handle(IPC_CHANNELS['ai:delete-model'], async (_event, name) => {
    const router = getAIRouter();
    if (!router) throw new Error('Router not initialized');
    return router.deleteOllamaModel(name);
  });
}

function registerVoiceHandlers(): void {
  ipcMain.handle(IPC_CHANNELS['voice:start'], async () => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
  });

  ipcMain.handle(IPC_CHANNELS['voice:stop'], async () => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
  });

  ipcMain.handle(IPC_CHANNELS['voice:tts'], async () => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
  });
}

function registerConversationHandlers(): void {
  ipcMain.handle(IPC_CHANNELS['conversations:list'], async () => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    return orchestrator.listConversations();
  });

  ipcMain.handle(IPC_CHANNELS['conversations:create'], async (_event, title) => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    return orchestrator.createConversation(title);
  });

  ipcMain.handle(IPC_CHANNELS['conversations:delete'], async (_event, id) => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    orchestrator.deleteConversation(id);
  });

  ipcMain.handle(IPC_CHANNELS['conversations:rename'], async (_event, id, title) => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    orchestrator.renameConversation(id, title);
  });

  ipcMain.handle(IPC_CHANNELS['messages:list'], async (_event, conversationId) => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    return orchestrator.getMessages(conversationId);
  });

  ipcMain.handle(IPC_CHANNELS['messages:send'], async (_event, conversationId, content) => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    return orchestrator.sendMessage(conversationId, content);
  });

  ipcMain.handle(IPC_CHANNELS['messages:delete'], async (_event, id) => {
    const db = DatabaseManager.getInstance();
    db.deleteMessage(id);
  });
}

function registerMemoryHandlers(): void {
  ipcMain.handle(IPC_CHANNELS['memory:list'], async (_event, query, limit) => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    return orchestrator.getMemoryList(query, limit);
  });

  ipcMain.handle(IPC_CHANNELS['memory:search'], async (_event, query, limit) => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    return orchestrator.getMemorySearch(query, limit);
  });

  ipcMain.handle(IPC_CHANNELS['memory:create'], async (_event, entry) => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    return orchestrator.createMemory(entry);
  });

  ipcMain.handle(IPC_CHANNELS['memory:update'], async (_event, id, updates) => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    orchestrator.updateMemory(id, updates);
  });

  ipcMain.handle(IPC_CHANNELS['memory:delete'], async (_event, id) => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    orchestrator.deleteMemory(id);
  });
}

function registerToolHandlers(): void {
  ipcMain.handle(IPC_CHANNELS['tools:list'], async () => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    return orchestrator.getTools();
  });

  ipcMain.handle(IPC_CHANNELS['tools:execute'], async (_event, name, args) => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    return orchestrator.executeTool(name, args);
  });
}

function registerSystemHandlers(): void {
  ipcMain.handle(IPC_CHANNELS['system:metrics'], async () => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    return orchestrator.getSystemMetrics();
  });

  ipcMain.handle(IPC_CHANNELS['system:info'], async () => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    return orchestrator.getSystemMetrics();
  });
}

function registerSettingsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS['settings:get'], async () => {
    return settings;
  });

  ipcMain.handle(IPC_CHANNELS['settings:set'], async (_event, newSettings) => {
    updateSettings(newSettings);
    return settings;
  });

  ipcMain.handle(IPC_CHANNELS['settings:reset'], async () => {
    settings = DEFAULT_SETTINGS as AppSettings;
    const db = DatabaseManager.getInstance();
    db.saveSettings(settings);
    if (orchestrator) orchestrator.setSettings(settings);
    applySettings();
    return settings;
  });
}

function registerWindowHandlers(): void {
  ipcMain.handle(IPC_CHANNELS['window:minimize'], () => {
    mainWindow?.minimize();
  });

  ipcMain.handle(IPC_CHANNELS['window:maximize'], () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle(IPC_CHANNELS['window:close'], () => {
    mainWindow?.close();
  });

  ipcMain.handle(IPC_CHANNELS['window:toggle'], () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
    }
  });

  ipcMain.handle(IPC_CHANNELS['dialog:openFile'], async (_event, options) => {
    if (!mainWindow) return undefined;
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result.canceled ? undefined : result.filePaths;
  });

  ipcMain.handle(IPC_CHANNELS['dialog:saveFile'], async (_event, options) => {
    if (!mainWindow) return undefined;
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result.canceled ? undefined : result.filePath;
  });

  ipcMain.handle(IPC_CHANNELS['dialog:openDirectory'], async (_event, options) => {
    if (!mainWindow) return undefined;
    const result = await dialog.showOpenDialog(mainWindow, { ...options, properties: ['openDirectory'] });
    return result.canceled ? undefined : result.filePaths;
  });

  ipcMain.handle(IPC_CHANNELS['app:getPath'], (_event, name: string) => {
    return app.getPath(name as any);
  });

  ipcMain.handle(IPC_CHANNELS['app:getVersion'], () => {
    return app.getVersion();
  });

  ipcMain.handle(IPC_CHANNELS['app:quit'], () => {
    app.quit();
  });
}

function setupGlobalShortcut(): void {
  globalShortcut.unregisterAll();
  if (settings.hotkey.enabled) {
    const accelerator = [...settings.hotkey.modifier, settings.hotkey.key].join('+');
    const ret = globalShortcut.register(accelerator, () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
    if (!ret) {
      console.warn('Global shortcut registration failed:', accelerator);
    }
  }
}

function setupTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }

  if (!settings.tray.enabled) return;

  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.icns')
    : path.join(__dirname, '../../../assets/icon.icns');

  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      icon = nativeImage.createEmpty();
    }
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show JARVIS',
      click: () => mainWindow?.show(),
    },
    {
      label: 'Hide JARVIS',
      click: () => mainWindow?.hide(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ]);

  tray.setToolTip('J.A.R.V.I.S.');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow?.show();
  });
}

function saveSettings(): void {
  const db = DatabaseManager.getInstance();
  db.saveSettings(settings);
}

function applySettings(): void {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(settings.ui.alwaysOnTop);
  }
  setupGlobalShortcut();
  setupTray();
}

function updateSettings(newSettings: Partial<AppSettings>): void {
  settings = { ...settings, ...newSettings };
  saveSettings();
  if (orchestrator) orchestrator.setSettings(settings);
  applySettings();
}

export function getOrchestrator(): AIOrchestrator | null {
  return orchestrator;
}

export function getSettings(): AppSettings {
  return settings;
}

export function updateSettingsExported(newSettings: Partial<AppSettings>): void {
  updateSettings(newSettings);
}