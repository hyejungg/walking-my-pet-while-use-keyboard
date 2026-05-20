import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/ipc-channels';

contextBridge.exposeInMainWorld('petAPI', {
  onKeyTyped(handler: () => void): () => void {
    const listener = () => handler();
    ipcRenderer.on(IPC.KEY_TYPED, listener);
    return () => ipcRenderer.off(IPC.KEY_TYPED, listener);
  }
});

declare global {
  interface Window {
    petAPI: {
      onKeyTyped(handler: () => void): () => void;
    };
  }
}
