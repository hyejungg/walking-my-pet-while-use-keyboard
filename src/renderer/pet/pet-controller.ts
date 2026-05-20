export type PetState = 'idle' | 'walk';
export type Direction = 'left' | 'right';

export interface PetControllerOptions {
  idleTimeoutMs: number;
  baseStepPx: number;
  intervalMs: number;
  rateWindowMs: number;
  minMultiplier: number;
  maxMultiplier: number;
}

export interface StepEvent {
  dx: number;
  direction: Direction;
  speedMultiplier: number;
}

const KPS_FLOOR = 1;
const KPS_CEIL = 10;

export class PetController {
  state: PetState = 'idle';
  direction: Direction = 'right';
  speedMultiplier: number;

  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private stepTimer: ReturnType<typeof setInterval> | null = null;
  private stateListeners: Array<(s: PetState) => void> = [];
  private stepListeners: Array<(e: StepEvent) => void> = [];
  private keyTimestamps: number[] = [];

  constructor(private readonly opts: PetControllerOptions) {
    this.speedMultiplier = opts.minMultiplier;
  }

  onStateChange(fn: (s: PetState) => void): void {
    this.stateListeners.push(fn);
  }

  onStep(fn: (e: StepEvent) => void): void {
    this.stepListeners.push(fn);
  }

  notifyKey(): void {
    const now = Date.now();
    this.recordKey(now);
    if (this.state === 'idle') this.setState('walk');
    // Step interval is scheduled BEFORE the idle timeout so that, when both
    // are due on the same tick, fake/real timer queues fire the step first —
    // letting the final step land at the idle boundary instead of being
    // pre-empted by the idle transition clearing the interval.
    this.ensureStepTimer();
    this.resetIdleTimer();
  }

  flipDirection(): void {
    this.direction = this.direction === 'right' ? 'left' : 'right';
  }

  dispose(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.stepTimer) clearInterval(this.stepTimer);
    this.idleTimer = null;
    this.stepTimer = null;
  }

  private recordKey(now: number): void {
    this.keyTimestamps.push(now);
    this.pruneAndRecomputeMultiplier(now);
  }

  private pruneAndRecomputeMultiplier(now: number): void {
    const cutoff = now - this.opts.rateWindowMs;
    while (this.keyTimestamps.length > 0 && this.keyTimestamps[0] < cutoff) {
      this.keyTimestamps.shift();
    }
    const windowSec = this.opts.rateWindowMs / 1000;
    const kps = this.keyTimestamps.length / windowSec;
    const clamped = Math.max(KPS_FLOOR, Math.min(KPS_CEIL, kps));
    const t = (clamped - KPS_FLOOR) / (KPS_CEIL - KPS_FLOOR);
    this.speedMultiplier =
      this.opts.minMultiplier + t * (this.opts.maxMultiplier - this.opts.minMultiplier);
  }

  private setState(s: PetState): void {
    if (this.state === s) return;
    this.state = s;
    for (const l of this.stateListeners) l(s);
    if (s === 'idle' && this.stepTimer) {
      clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.setState('idle'), this.opts.idleTimeoutMs);
  }

  private ensureStepTimer(): void {
    if (this.stepTimer) return;
    this.stepTimer = setInterval(() => {
      if (this.state !== 'walk') return;
      this.pruneAndRecomputeMultiplier(Date.now());
      const magnitude = Math.max(1, Math.round(this.opts.baseStepPx * this.speedMultiplier));
      const dx = this.direction === 'right' ? magnitude : -magnitude;
      const event: StepEvent = {
        dx,
        direction: this.direction,
        speedMultiplier: this.speedMultiplier
      };
      for (const l of this.stepListeners) l(event);
    }, this.opts.intervalMs);
  }
}
