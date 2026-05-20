import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { IPC } from '@shared/ipc-channels';
import { moveWindowBy, resizePetWindow } from './pet-window.js';
import { loadThemes } from './theme-loader.js';
import type { SettingsStore } from './store.js';
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
