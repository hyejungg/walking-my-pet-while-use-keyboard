import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings } from '@shared/settings-schema';
import type { ThemeAssets } from '@shared/theme-types';

// IPC channel strings are inlined here because sandboxed Electron preload
// cannot require local chunk files. Keep these in sync with @shared/ipc-channels.
const SETTINGS_GET = 'pet:settings-get';
const SETTINGS_SET = 'pet:settings-set';
const THEMES_LIST = 'pet:themes-list';
const PET_POSITION_RESET = 'pet:position-reset';

const api = {
  getSettings(): Promise<AppSettings> {
    return ipcRenderer.invoke(SETTINGS_GET);
  },
  setSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    return ipcRenderer.invoke(SETTINGS_SET, patch);
  },
  listThemes(): Promise<ThemeAssets[]> {
    return ipcRenderer.invoke(THEMES_LIST);
  },
  resetPosition(): Promise<void> {
    return ipcRenderer.invoke(PET_POSITION_RESET);
  }
};

contextBridge.exposeInMainWorld('settingsAPI', api);

declare global {
  interface Window { settingsAPI: typeof api; }
}
