import { app } from 'electron';

export function applyAutoLaunch(enabled: boolean): void {
  if (process.platform !== 'darwin' && process.platform !== 'win32') return;
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: enabled
    });
  } catch (err) {
    // Unsigned dev binaries on macOS can hit "Operation not permitted" when
    // touching LaunchServices. Don't let that kill the main process.
    console.warn('[auto-launch] setLoginItemSettings failed', err);
  }
}

export function isAutoLaunchEnabled(): boolean {
  try {
    return !!app.getLoginItemSettings().openAtLogin;
  } catch {
    return false;
  }
}
