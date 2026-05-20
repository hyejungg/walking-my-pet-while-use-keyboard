import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IPC } from '@shared/ipc-channels';
import { moveWindowBy, resizePetWindow } from './pet-window.js';
import { loadThemes } from './theme-loader.js';
import type { SettingsStore } from './store.js';
import type { AppSettings } from '@shared/settings-schema';
import type { ThemeAssets } from '@shared/theme-types';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getThemesDir(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'themes');
  // In dev, app.getAppPath() can resolve to the main-script directory rather
  // than the project root depending on how electron is launched. Derive from
  // this module's location instead: out/main/ipc.js → ../../themes.
  return join(__dirname, '..', '..', 'themes');
}

export function registerPetWindowIpc(
  getPetWindow: () => BrowserWindow | null,
  store: SettingsStore
) {
  ipcMain.handle(IPC.PET_MOVE_BY, (_e, payload: { dx: number }) => {
    const win = getPetWindow();
    if (!win || win.isDestroyed()) return { hitEdge: null };
    const { hitEdge } = moveWindowBy(win, payload.dx);
    return { hitEdge };
  });

  ipcMain.handle(IPC.PET_SET_SIZE, (_e, payload: { width: number; height: number }) => {
    const win = getPetWindow();
    if (!win || win.isDestroyed()) return;
    resizePetWindow(win, payload.width, payload.height);
  });

  ipcMain.handle(IPC.THEMES_LIST, (): ThemeAssets[] => loadThemes(getThemesDir()));

  ipcMain.handle(IPC.THEME_GET_ACTIVE, (): ThemeAssets | null => {
    const themes = loadThemes(getThemesDir());
    const id = store.get('activeThemeId');
    return themes.find(t => t.meta.id === id) ?? themes[0] ?? null;
  });
}

export function registerSettingsIpc(
  store: SettingsStore,
  getPetWindow: () => BrowserWindow | null,
  setAutoLaunch: (enabled: boolean) => void,
  suppressNextPositionPersist: () => void
) {
  ipcMain.handle(IPC.SETTINGS_GET, (): AppSettings => {
    const all = store.getAll();
    // Normalize: if the persisted activeThemeId isn't present in themes/, fall
    // back to the first available theme so settings UI can highlight it.
    const themes = loadThemes(getThemesDir());
    if (themes.length > 0 && !themes.find(t => t.meta.id === all.activeThemeId)) {
      all.activeThemeId = themes[0].meta.id;
    }
    return all;
  });

  ipcMain.handle(IPC.SETTINGS_SET, (_e, patch: Partial<AppSettings>): AppSettings => {
    store.update(patch);

    if (patch.activeThemeId) {
      const all = loadThemes(getThemesDir());
      const active = all.find(t => t.meta.id === patch.activeThemeId) ?? null;
      const win = getPetWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC.THEME_SET_ACTIVE, active);
      }
    }

    if (typeof patch.autoLaunch === 'boolean') {
      setAutoLaunch(patch.autoLaunch);
    }

    return store.getAll();
  });

  ipcMain.handle(IPC.PET_POSITION_RESET, () => {
    store.set('petPosition', null);
    const win = getPetWindow();
    if (!win || win.isDestroyed()) return;
    const display = screen.getPrimaryDisplay().workArea;
    const b = win.getBounds();
    // setBounds emits a 'moved' event whose listener would immediately
    // re-persist the new coords and undo the null reset above. Tell the
    // listener to skip exactly one event.
    suppressNextPositionPersist();
    win.setBounds({
      x: Math.round(display.x + display.width / 2 - b.width / 2),
      y: Math.round(display.y + display.height - b.height - 80),
      width: b.width,
      height: b.height
    });
  });
}
