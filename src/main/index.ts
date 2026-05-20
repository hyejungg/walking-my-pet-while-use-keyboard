import { app, BrowserWindow } from 'electron';
import { createPetWindow } from './pet-window.js';

let petWindow: BrowserWindow | null = null;

app.whenReady().then(() => {
  petWindow = createPetWindow({ width: 160, height: 160 });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      petWindow = createPetWindow({ width: 160, height: 160 });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
