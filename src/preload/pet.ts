import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/ipc-channels';

contextBridge.exposeInMainWorld('petAPI', {
  onKeyTyped(handler: () => void): () => void {
    const listener = () => handler();
    ipcRenderer.on(IPC.KEY_TYPED, listener);
    return () => ipcRenderer.off(IPC.KEY_TYPED, listener);
  },
  moveBy(dx: number): Promise<{ hitEdge: 'left' | 'right' | null }> {
    return ipcRenderer.invoke(IPC.PET_MOVE_BY, { dx });
  }
});

declare global {
  interface Window {
    petAPI: {
      onKeyTyped(handler: () => void): () => void;
      moveBy(dx: number): Promise<{ hitEdge: 'left' | 'right' | null }>;
    };
  }
}
