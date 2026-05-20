import { BrowserWindow, ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels';
import { moveWindowBy } from './pet-window.js';

export function registerPetWindowIpc(getPetWindow: () => BrowserWindow | null) {
  ipcMain.handle(IPC.PET_MOVE_BY, (_e, payload: { dx: number }) => {
    const win = getPetWindow();
    if (!win || win.isDestroyed()) return { hitEdge: null };
    return moveWindowBy(win, payload.dx);
  });
}
