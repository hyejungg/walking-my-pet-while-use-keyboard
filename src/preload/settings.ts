import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/ipc-channels';
import type { AppSettings } from '@shared/settings-schema';
import type { ThemeAssets } from '@shared/theme-types';

const api = {
  getSettings(): Promise<AppSettings> {
    return ipcRenderer.invoke(IPC.SETTINGS_GET);
  },
  setSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    return ipcRenderer.invoke(IPC.SETTINGS_SET, patch);
  },
  listThemes(): Promise<ThemeAssets[]> {
    return ipcRenderer.invoke(IPC.THEMES_LIST);
  },
  resetPosition(): Promise<void> {
    return ipcRenderer.invoke(IPC.PET_POSITION_RESET);
  }
};

contextBridge.exposeInMainWorld('settingsAPI', api);

declare global {
  interface Window { settingsAPI: typeof api; }
}
