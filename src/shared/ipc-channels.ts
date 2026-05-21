export const IPC = {
  KEY_TYPED: 'pet:key-typed',
  THEMES_LIST: 'pet:themes-list',
  THEME_GET_ACTIVE: 'pet:theme-get-active',
  THEME_SET_ACTIVE: 'pet:theme-set-active',
  SETTINGS_GET: 'pet:settings-get',
  SETTINGS_SET: 'pet:settings-set',
  PET_MOVE_BY: 'pet:move-by',
  PET_SET_SIZE: 'pet:set-size',
  PET_POSITION_RESET: 'pet:position-reset',
  OPEN_SETTINGS: 'pet:open-settings'
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
