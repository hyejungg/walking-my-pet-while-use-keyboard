export interface SpriteRow {
  row: number;
  count: number;
  fps: number;
}

export interface FrameIndex {
  col: number;
  row: number;
}

export type FrameCallback = (frame: FrameIndex) => void;

export class PetSprite {
  private row = 0;
  private count = 1;
  private intervalMs = 125;
  private timer: ReturnType<typeof setInterval> | null = null;
  private col = 0;
  private running = false;

  constructor(private readonly onFrame: FrameCallback) {}

  setRow(opts: SpriteRow): void {
    this.row = opts.row;
    this.count = Math.max(1, opts.count);
    this.intervalMs = Math.max(1, Math.round(1000 / Math.max(1, opts.fps)));
    this.col = 0;
    if (this.running) {
      this.emitCurrent();
      this.restartTimer();
    }
  }

  setFps(fps: number): void {
    const next = Math.max(1, Math.round(1000 / Math.max(1, fps)));
    if (next === this.intervalMs) return;
    this.intervalMs = next;
    if (this.running) this.restartTimer();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.emitCurrent();
    this.restartTimer();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private restartTimer(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.count <= 1) {
      this.timer = null;
      return;
    }
    this.timer = setInterval(() => {
      this.col = (this.col + 1) % this.count;
      this.emitCurrent();
    }, this.intervalMs);
  }

  private emitCurrent(): void {
    this.onFrame({ col: this.col, row: this.row });
  }
}
