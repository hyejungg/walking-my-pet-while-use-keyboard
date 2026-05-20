import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'node:path';
import { IPC } from '@shared/ipc-channels';
import { moveWindowBy, resizePetWindow } from './pet-window.js';
import { loadThemes } from './theme-loader.js';
import type { SettingsStore } from './store.js';
import type { AppSettings } from '@shared/settings-schema';
import type { ThemeAssets } from '@shared/theme-types';

export function getThemesDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'themes')
    : join(app.getAppPath(), 'themes');
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
  ipcMain.handle(IPC.SETTINGS_GET, (): AppSettings => store.getAll());

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
