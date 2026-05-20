import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/ipc-channels';
import type { ThemeAssets } from '@shared/theme-types';

const api = {
  onKeyTyped(handler: () => void): () => void {
    const listener = () => handler();
    ipcRenderer.on(IPC.KEY_TYPED, listener);
    return () => ipcRenderer.off(IPC.KEY_TYPED, listener);
  },
  moveBy(dx: number): Promise<{ hitEdge: 'left' | 'right' | null }> {
    return ipcRenderer.invoke(IPC.PET_MOVE_BY, { dx });
  },
  setSize(width: number, height: number): Promise<void> {
    return ipcRenderer.invoke(IPC.PET_SET_SIZE, { width, height });
  },
  getActiveTheme(): Promise<ThemeAssets | null> {
    return ipcRenderer.invoke(IPC.THEME_GET_ACTIVE);
  },
  onActiveThemeChanged(handler: (t: ThemeAssets | null) => void): () => void {
    const listener = (_e: unknown, t: ThemeAssets | null) => handler(t);
    ipcRenderer.on(IPC.THEME_SET_ACTIVE, listener);
    return () => ipcRenderer.off(IPC.THEME_SET_ACTIVE, listener);
  }
};

contextBridge.exposeInMainWorld('petAPI', api);

declare global {
  interface Window { petAPI: typeof api; }
}
