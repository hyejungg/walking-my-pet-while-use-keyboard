import { BrowserWindow, screen } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_BOTTOM_MARGIN_PX = 80;
const ALWAYS_ON_TOP_LEVEL = 'screen-saver' as const;

export interface PetWindowOptions {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export function createPetWindow(opts: PetWindowOptions): BrowserWindow {
  const display = screen.getPrimaryDisplay().workArea;
  const x = opts.x ?? display.x + display.width / 2 - opts.width / 2;
  const y = opts.y ?? display.y + display.height - opts.height - DEFAULT_BOTTOM_MARGIN_PX;

  const win = new BrowserWindow({
    width: opts.width,
    height: opts.height,
    x: Math.round(x),
    y: Math.round(y),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: true,
    // Sonoma sometimes paints a rounded white backdrop behind transparent
    // frameless windows; opt out of rounded corners and force the native
    // vibrancy material so the backdrop is system-blurred instead of opaque
    // white.
    roundedCorners: false,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: join(__dirname, '../preload/pet.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  // Some Electron builds reset background to opaque after construction;
  // re-apply explicitly.
  win.setBackgroundColor('#00000000');
  win.setAlwaysOnTop(true, ALWAYS_ON_TOP_LEVEL);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/pet/index.html`);
  } else {
    win.loadFile(join(__dirname, '../renderer/pet/index.html'));
  }

  return win;
}

export function moveWindowBy(win: BrowserWindow, dx: number): {
  newX: number;
  hitEdge: 'left' | 'right' | null;
} {
  const display = screen.getDisplayMatching(win.getBounds()).workArea;
  const bounds = win.getBounds();
  const maxX = display.x + display.width - bounds.width;
  let nextX = bounds.x + dx;
  let hit: 'left' | 'right' | null = null;

  // Apply right-edge clamp first; if the window is wider than the display
  // (maxX < display.x), the left-edge clamp below overrides and wins.
  if (nextX > maxX) {
    nextX = maxX;
    hit = 'right';
  }
  if (nextX < display.x) {
    nextX = display.x;
    hit = 'left';
  }

  win.setBounds({ ...bounds, x: Math.round(nextX) });
  return { newX: nextX, hitEdge: hit };
}

export function resizePetWindow(win: BrowserWindow, width: number, height: number): void {
  const b = win.getBounds();
  win.setBounds({ x: b.x, y: b.y, width, height });
}
