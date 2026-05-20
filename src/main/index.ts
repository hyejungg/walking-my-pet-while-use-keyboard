import { app, BrowserWindow } from 'electron';
import { createPetWindow } from './pet-window.js';
import { createKeyHook } from './key-hook.js';
import { createSettingsStore } from './store.js';
import { registerPetWindowIpc, registerSettingsIpc, getThemesDir } from './ipc.js';
import { loadThemes } from './theme-loader.js';
import { applyAutoLaunch } from './auto-launch.js';
import { createTray } from './tray.js';
import { openSettingsWindow } from './settings-window.js';
import { IPC } from '@shared/ipc-channels';

let petWindow: BrowserWindow | null = null;
const keyHook = createKeyHook();
const store = createSettingsStore();
let suppressNextPositionPersist = false;
const isE2E = process.env.WALKING_PET_E2E === '1';

app.whenReady().then(() => {
  if (process.platform === 'darwin' && !isE2E) {
    app.dock?.hide();
  }

  // Sync the OS login-item state with the persisted preference on boot.
  applyAutoLaunch(store.get('autoLaunch'));

  const themes = loadThemes(getThemesDir());
  const activeId = store.get('activeThemeId');
  const active = themes.find(t => t.meta.id === activeId) ?? themes[0] ?? null;
  const width = active?.meta.renderWidth ?? 160;
  const height = active?.meta.renderHeight ?? 130;

  const savedPos = store.get('petPosition');
  petWindow = createPetWindow({ width, height, x: savedPos?.x, y: savedPos?.y });
  registerPetWindowIpc(() => petWindow, store);
  registerSettingsIpc(
    store,
    () => petWindow,
    applyAutoLaunch,
    () => { suppressNextPositionPersist = true; }
  );

  petWindow.on('moved', () => {
    if (suppressNextPositionPersist) {
      suppressNextPositionPersist = false;
      return;
    }
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

  if (!isE2E) {
    createTray(() => openSettingsWindow());
  } else {
    // Expose a synchronous entry point for e2e tests to open the settings window
    // without going through the system tray or a dynamic import (which can't
    // execute inside Playwright's main-process evaluate context).
    (globalThis as unknown as { __openSettings?: () => void }).__openSettings = () => {
      openSettingsWindow();
    };
  }
});

app.on('before-quit', () => keyHook.stop());
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
