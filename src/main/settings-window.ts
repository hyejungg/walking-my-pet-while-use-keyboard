import { BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

let settingsWindow: BrowserWindow | null = null;

export function openSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return settingsWindow;
  }

  const win = new BrowserWindow({
    width: 420,
    height: 480,
    resizable: false,
    title: 'Walking Pet — Settings',
    transparent: true,
    backgroundColor: '#00000000',
    vibrancy: 'sidebar',
    webPreferences: {
      preload: join(__dirname, '../preload/settings.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/settings/index.html`);
  } else {
    win.loadFile(join(__dirname, '../renderer/settings/index.html'));
  }

  win.on('closed', () => { settingsWindow = null; });
  settingsWindow = win;
  return win;
}
