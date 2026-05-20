import { app, BrowserWindow } from 'electron';
import { createPetWindow } from './pet-window.js';
import { createKeyHook } from './key-hook.js';
import { createSettingsStore } from './store.js';
import { registerPetWindowIpc, registerSettingsIpc, getThemesDir } from './ipc.js';
import { loadThemes } from './theme-loader.js';
import { IPC } from '@shared/ipc-channels';

let petWindow: BrowserWindow | null = null;
const keyHook = createKeyHook();
const store = createSettingsStore();

app.whenReady().then(() => {
  const themes = loadThemes(getThemesDir());
  const activeId = store.get('activeThemeId');
  const active = themes.find(t => t.meta.id === activeId) ?? themes[0] ?? null;
  const width = active?.meta.renderWidth ?? 160;
  const height = active?.meta.renderHeight ?? 130;

  const savedPos = store.get('petPosition');
  petWindow = createPetWindow({ width, height, x: savedPos?.x, y: savedPos?.y });
  registerPetWindowIpc(() => petWindow, store);
  registerSettingsIpc(store, () => petWindow, (_enabled) => { /* TODO Task 12 */ });

  petWindow.on('moved', () => {
    if (!petWindow) return;
    const [x, y] = petWindow.getPosition();
    store.set('petPosition', { x, y });
  });

  keyHook.on('key', () => {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.webContents.send(IPC.KEY_TYPED);
    }
  });
  keyHook.start();
});

app.on('before-quit', () => keyHook.stop());
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
