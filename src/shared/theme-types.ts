export interface ThemeMeta {
  id: string;
  displayName: string;
  description: string;
  spritesheetPath: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;

  idleRow: number;
  idleColumns: number;

  /** Rows to chain together when walking — frames play in order across them. */
  walkRows: number[];
  walkColumns: number;

  cryRow: number;
  cryColumns: number;
  cryDurationMs: number;

  hoverRows: number[];
  hoverColumns: number;

  sleepRow: number;
  sleepColumns: number;

  clickRow: number;
  clickColumns: number;
  clickDurationMs: number;

  questionRow: number;
  questionColumns: number;
  questionDurationMs: number;

  /** Raw uiohook keycodes for the pet's name (Korean dubeolsik mapping). */
  callKeycodes: number[];
  callRow: number;
  callColumns: number;
  callDurationMs: number;

  fps: number;
  stepPx: number;
  renderWidth: number;
  renderHeight: number;
}

export interface ThemeAssets {
  meta: ThemeMeta;
  spritesheetUrl: string;
}
