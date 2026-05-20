import { BrowserWindow, screen } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface PetWindowOptions {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export function createPetWindow(opts: PetWindowOptions): BrowserWindow {
  const display = screen.getPrimaryDisplay().workArea;
  const x = opts.x ?? display.x + display.width / 2 - opts.width / 2;
  const y = opts.y ?? display.y + display.height - opts.height - 80;

  const win = new BrowserWindow({
    width: opts.width,
    height: opts.height,
    x: Math.round(x),
    y: Math.round(y),
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/pet.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/pet/index.html`);
  } else {
    win.loadFile(join(__dirname, '../renderer/pet/index.html'));
  }

  win.once('ready-to-show', () => win.show());
  return win;
}
