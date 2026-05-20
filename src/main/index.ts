import { app, BrowserWindow } from 'electron';
import { createPetWindow } from './pet-window.js';
import { createKeyHook } from './key-hook.js';
import { IPC } from '@shared/ipc-channels';

let petWindow: BrowserWindow | null = null;
const keyHook = createKeyHook();

app.whenReady().then(() => {
  petWindow = createPetWindow({ width: 160, height: 160 });

  keyHook.on('key', () => {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.webContents.send(IPC.KEY_TYPED);
    }
  });
  keyHook.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      petWindow = createPetWindow({ width: 160, height: 160 });
    }
  });
});

app.on('before-quit', () => keyHook.stop());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
