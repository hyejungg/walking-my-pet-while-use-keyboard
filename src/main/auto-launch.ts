import { app } from 'electron';

export function applyAutoLaunch(enabled: boolean): void {
  if (process.platform === 'darwin' || process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: enabled
    });
  }
}

export function isAutoLaunchEnabled(): boolean {
  return !!app.getLoginItemSettings().openAtLogin;
}
