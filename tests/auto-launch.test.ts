import { describe, expect, it, vi, beforeEach } from 'vitest';

const setLoginItemSettings = vi.fn();
const getLoginItemSettings = vi.fn(() => ({ openAtLogin: false }));

vi.mock('electron', () => ({
  app: {
    setLoginItemSettings: (...args: unknown[]) => setLoginItemSettings(...args),
    getLoginItemSettings: () => getLoginItemSettings(),
    getPath: () => '/tmp',
    isPackaged: false,
    getAppPath: () => '/tmp/app'
  }
}));

import { applyAutoLaunch, isAutoLaunchEnabled } from '../src/main/auto-launch';

describe('auto-launch', () => {
  beforeEach(() => {
    setLoginItemSettings.mockClear();
    getLoginItemSettings.mockReset();
  });

  it('enabling sets openAtLogin=true', () => {
    applyAutoLaunch(true);
    expect(setLoginItemSettings).toHaveBeenCalledWith(expect.objectContaining({ openAtLogin: true }));
  });

  it('disabling sets openAtLogin=false', () => {
    applyAutoLaunch(false);
    expect(setLoginItemSettings).toHaveBeenCalledWith(expect.objectContaining({ openAtLogin: false }));
  });

  it('isAutoLaunchEnabled reads from getLoginItemSettings', () => {
    getLoginItemSettings.mockReturnValueOnce({ openAtLogin: true });
    expect(isAutoLaunchEnabled()).toBe(true);
    getLoginItemSettings.mockReturnValueOnce({ openAtLogin: false });
    expect(isAutoLaunchEnabled()).toBe(false);
  });
});
