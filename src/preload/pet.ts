import { contextBridge, ipcRenderer } from 'electron';
import type { ThemeAssets } from '@shared/theme-types';
import type { AppSettings } from '@shared/settings-schema';

// IPC channel strings are inlined here because sandboxed Electron preload
// cannot require local chunk files. Keep these in sync with @shared/ipc-channels.
const KEY_TYPED = 'pet:key-typed';
const PET_MOVE_BY = 'pet:move-by';
const PET_SET_SIZE = 'pet:set-size';
const PET_GET_BOUNDS = 'pet:get-bounds';
const PET_SET_POSITION = 'pet:set-position';
const SETTINGS_GET = 'pet:settings-get';
const THEME_GET_ACTIVE = 'pet:theme-get-active';
const THEME_SET_ACTIVE = 'pet:theme-set-active';
const OPEN_SETTINGS = 'pet:open-settings';
const PET_CONTEXT_MENU = 'pet:context-menu';

const api = {
  onKeyTyped(handler: () => void): () => void {
    const listener = () => handler();
    ipcRenderer.on(KEY_TYPED, listener);
    return () => ipcRenderer.off(KEY_TYPED, listener);
  },
  moveBy(dx: number): Promise<{ hitEdge: 'left' | 'right' | null }> {
    return ipcRenderer.invoke(PET_MOVE_BY, { dx });
  },
  setSize(width: number, height: number): Promise<void> {
    return ipcRenderer.invoke(PET_SET_SIZE, { width, height });
  },
  getBounds(): Promise<{ x: number; y: number; width: number; height: number } | null> {
    return ipcRenderer.invoke(PET_GET_BOUNDS);
  },
  setPosition(x: number, y: number): Promise<void> {
    return ipcRenderer.invoke(PET_SET_POSITION, { x, y });
  },
  getSettings(): Promise<AppSettings> {
    return ipcRenderer.invoke(SETTINGS_GET);
  },
  getActiveTheme(): Promise<ThemeAssets | null> {
    return ipcRenderer.invoke(THEME_GET_ACTIVE);
  },
  onActiveThemeChanged(handler: (t: ThemeAssets | null) => void): () => void {
    const listener = (_e: unknown, t: ThemeAssets | null) => handler(t);
    ipcRenderer.on(THEME_SET_ACTIVE, listener);
    return () => ipcRenderer.off(THEME_SET_ACTIVE, listener);
  },
  openSettings(): Promise<void> {
    return ipcRenderer.invoke(OPEN_SETTINGS);
  },
  showContextMenu(): Promise<void> {
    return ipcRenderer.invoke(PET_CONTEXT_MENU);
  }
};

contextBridge.exposeInMainWorld('petAPI', api);

declare global {
  interface Window { petAPI: typeof api; }
}
