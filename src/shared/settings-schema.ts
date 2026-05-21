export type PetSize = 'small' | 'medium' | 'large';

export interface AppSettings {
  activeThemeId: string;
  autoLaunch: boolean;
  petPosition: { x: number; y: number } | null;
  idleTimeoutMs: number;
  petSize: PetSize;
}

export const DEFAULT_SETTINGS: AppSettings = {
  activeThemeId: 'theme-1',
  autoLaunch: false,
  petPosition: null,
  idleTimeoutMs: 600,
  petSize: 'medium'
};

export const PET_SIZE_SCALE: Record<PetSize, number> = {
  small: 0.4,
  medium: 0.55,
  large: 0.75
};
