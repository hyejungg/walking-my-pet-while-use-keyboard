import { describe, expect, it, beforeEach, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@shared/settings-schema';

vi.mock('electron-store', () => {
  return {
    default: class MockStore<T> {
      private data: T;
      constructor(opts: { defaults: T }) {
        this.data = { ...opts.defaults };
      }
      get<K extends keyof T>(key: K): T[K] { return this.data[key]; }
      set<K extends keyof T>(key: K, val: T[K]): void { this.data[key] = val; }
      get store(): T { return this.data; }
      set store(v: T) { this.data = v; }
    }
  };
});

import { createSettingsStore } from '../src/main/store';

describe('settings store', () => {
  let store: ReturnType<typeof createSettingsStore>;
  beforeEach(() => { store = createSettingsStore(); });

  it('returns defaults when nothing is set', () => {
    expect(store.getAll()).toEqual(DEFAULT_SETTINGS);
  });

  it('persists individual fields', () => {
    store.set('activeThemeId', 'theme-2');
    expect(store.get('activeThemeId')).toBe('theme-2');
  });

  it('merges patches via update', () => {
    store.update({ autoLaunch: true, idleTimeoutMs: 800 });
    expect(store.get('autoLaunch')).toBe(true);
    expect(store.get('idleTimeoutMs')).toBe(800);
    expect(store.get('activeThemeId')).toBe(DEFAULT_SETTINGS.activeThemeId);
  });

  it('round-trips petPosition between null and an object', () => {
    expect(store.get('petPosition')).toBeNull();
    store.set('petPosition', { x: 100, y: 200 });
    expect(store.get('petPosition')).toEqual({ x: 100, y: 200 });
    store.set('petPosition', null);
    expect(store.get('petPosition')).toBeNull();
  });
});
