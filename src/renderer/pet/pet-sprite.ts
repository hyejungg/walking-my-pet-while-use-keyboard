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
  private sequence: FrameIndex[] = [{ col: 0, row: 0 }];
  private intervalMs = 125;
  private timer: ReturnType<typeof setInterval> | null = null;
  private index = 0;
  private running = false;

  constructor(private readonly onFrame: FrameCallback) {}

  setRow(opts: SpriteRow): void {
    const frames: FrameIndex[] = [];
    const count = Math.max(1, opts.count);
    for (let c = 0; c < count; c++) frames.push({ col: c, row: opts.row });
    this.setSequence(frames, opts.fps);
  }

  /** Cycle an arbitrary list of sprite-sheet frames at the given fps. */
  setSequence(frames: FrameIndex[], fps: number): void {
    this.sequence = frames.length > 0 ? frames.slice() : [{ col: 0, row: 0 }];
    this.intervalMs = Math.max(1, Math.round(1000 / Math.max(1, fps)));
    this.index = 0;
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
    if (this.sequence.length <= 1) {
      this.timer = null;
      return;
    }
    this.timer = setInterval(() => {
      this.index = (this.index + 1) % this.sequence.length;
      this.emitCurrent();
    }, this.intervalMs);
  }

  private emitCurrent(): void {
    this.onFrame(this.sequence[this.index]);
  }
}
