export interface AppSettings {
  activeThemeId: string;
  autoLaunch: boolean;
  petPosition: { x: number; y: number } | null;
  idleTimeoutMs: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  activeThemeId: 'theme-1',
  autoLaunch: false,
  petPosition: null,
  idleTimeoutMs: 600
};
