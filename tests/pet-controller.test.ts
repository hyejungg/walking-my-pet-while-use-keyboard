import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { PetController } from '../src/renderer/pet/pet-controller';

const defaults = {
  idleTimeoutMs: 500,
  baseStepPx: 4,
  intervalMs: 100,
  rateWindowMs: 2000,
  minMultiplier: 1.0,
  maxMultiplier: 3.0
};

describe('PetController', () => {
  beforeEach(() => vi.useFakeTimers({ now: 0 }));
  afterEach(() => vi.useRealTimers());

  it('starts idle facing right', () => {
    const c = new PetController(defaults);
    expect(c.state).toBe('idle');
    expect(c.direction).toBe('right');
    expect(c.speedMultiplier).toBe(1.0);
  });

  it('switches to walk on key and back to idle after timeout', () => {
    const onChange = vi.fn();
    const c = new PetController(defaults);
    c.onStateChange(onChange);
    c.notifyKey();
    expect(c.state).toBe('walk');
    expect(onChange).toHaveBeenLastCalledWith('walk');

    vi.advanceTimersByTime(499);
    expect(c.state).toBe('walk');

    vi.advanceTimersByTime(2);
    expect(c.state).toBe('idle');
    expect(onChange).toHaveBeenLastCalledWith('idle');
  });

  it('continuous keys keep walking', () => {
    const c = new PetController(defaults);
    c.notifyKey();
    vi.advanceTimersByTime(300);
    c.notifyKey();
    vi.advanceTimersByTime(300);
    expect(c.state).toBe('walk');
  });

  it('slow typing yields multiplier ≈ 1 and dx = baseStepPx', () => {
    const onStep = vi.fn();
    const c = new PetController(defaults);
    c.onStep(onStep);
    c.notifyKey();

    vi.advanceTimersByTime(100);
    const ev = onStep.mock.lastCall![0];
    expect(ev.direction).toBe('right');
    expect(ev.speedMultiplier).toBeCloseTo(1.0, 5);
    expect(ev.dx).toBe(4);
  });

  it('fast typing pushes multiplier toward 3.0 and scales dx accordingly', () => {
    const onStep = vi.fn();
    const c = new PetController(defaults);
    c.onStep(onStep);
    // 20 keys within ~1s -> KPS ~= 20/2 = 10 over 2s window -> multiplier ≈ 3.0
    for (let i = 0; i < 20; i++) {
      c.notifyKey();
      vi.advanceTimersByTime(50);
    }
    const ev = onStep.mock.lastCall![0];
    expect(ev.speedMultiplier).toBeCloseTo(3.0, 1);
    expect(ev.dx).toBe(Math.round(4 * ev.speedMultiplier));
  });

  it('multiplier decays as old timestamps fall out of the window', () => {
    const c = new PetController(defaults);
    // burst of 20 keys
    for (let i = 0; i < 20; i++) {
      c.notifyKey();
      vi.advanceTimersByTime(20);
    }
    const fast = c.speedMultiplier;
    expect(fast).toBeGreaterThan(2.0);

    // wait until window expires fully
    vi.advanceTimersByTime(2500);
    c.notifyKey(); // single late key
    expect(c.speedMultiplier).toBeCloseTo(1.0, 1);
  });

  it('stops emitting steps when idle', () => {
    const onStep = vi.fn();
    const c = new PetController({ ...defaults, idleTimeoutMs: 200 });
    c.onStep(onStep);
    c.notifyKey();
    vi.advanceTimersByTime(100);
    onStep.mockClear();
    vi.advanceTimersByTime(500);
    expect(onStep).toHaveBeenCalledTimes(1);
    onStep.mockClear();
    vi.advanceTimersByTime(500);
    expect(onStep).not.toHaveBeenCalled();
  });

  it('flipDirection inverts current direction', () => {
    const c = new PetController(defaults);
    expect(c.direction).toBe('right');
    c.flipDirection();
    expect(c.direction).toBe('left');
  });
});
