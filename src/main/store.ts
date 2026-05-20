import Store from 'electron-store';
import { AppSettings, DEFAULT_SETTINGS } from '@shared/settings-schema';

export function createSettingsStore() {
  const store = new Store<AppSettings>({
    name: 'walking-pet-settings',
    defaults: DEFAULT_SETTINGS
  });

  return {
    get<K extends keyof AppSettings>(key: K): AppSettings[K] {
      return store.get(key);
    },
    set<K extends keyof AppSettings>(key: K, val: AppSettings[K]): void {
      store.set(key, val);
    },
    update(patch: Partial<AppSettings>): void {
      store.store = { ...store.store, ...patch };
    },
    getAll(): AppSettings {
      return store.store;
    }
  };
}

export type SettingsStore = ReturnType<typeof createSettingsStore>;
