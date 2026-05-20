import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { PetSprite } from '../src/renderer/pet/pet-sprite';

describe('PetSprite', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('emits frame indices at the specified fps cycling within a row', () => {
    const onFrame = vi.fn();
    const sprite = new PetSprite(onFrame);
    sprite.setRow({ row: 2, count: 3, fps: 10 }); // 100ms/frame
    sprite.start();

    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(onFrame).toHaveBeenLastCalledWith({ col: 0, row: 2 });

    vi.advanceTimersByTime(100);
    expect(onFrame).toHaveBeenLastCalledWith({ col: 1, row: 2 });

    vi.advanceTimersByTime(100);
    expect(onFrame).toHaveBeenLastCalledWith({ col: 2, row: 2 });

    vi.advanceTimersByTime(100);
    expect(onFrame).toHaveBeenLastCalledWith({ col: 0, row: 2 }); // wrap

    sprite.stop();
  });

  it('count=1 emits a single static frame and never advances', () => {
    const onFrame = vi.fn();
    const sprite = new PetSprite(onFrame);
    sprite.setRow({ row: 0, count: 1, fps: 8 });
    sprite.start();
    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(onFrame).toHaveBeenLastCalledWith({ col: 0, row: 0 });
    vi.advanceTimersByTime(1000);
    expect(onFrame).toHaveBeenCalledTimes(1);
    sprite.stop();
  });

  it('stop halts further emissions', () => {
    const onFrame = vi.fn();
    const sprite = new PetSprite(onFrame);
    sprite.setRow({ row: 1, count: 3, fps: 10 });
    sprite.start();
    onFrame.mockClear();
    sprite.stop();
    vi.advanceTimersByTime(1000);
    expect(onFrame).not.toHaveBeenCalled();
  });

  it('setRow while running switches sequence and resets col to 0', () => {
    const onFrame = vi.fn();
    const sprite = new PetSprite(onFrame);
    sprite.setRow({ row: 1, count: 3, fps: 10 });
    sprite.start();
    vi.advanceTimersByTime(100);
    onFrame.mockClear();

    sprite.setRow({ row: 4, count: 2, fps: 10 });
    expect(onFrame).toHaveBeenLastCalledWith({ col: 0, row: 4 });
    vi.advanceTimersByTime(100);
    expect(onFrame).toHaveBeenLastCalledWith({ col: 1, row: 4 });
    sprite.stop();
  });

  it('setFps changes interval without resetting col index', () => {
    const onFrame = vi.fn();
    const sprite = new PetSprite(onFrame);
    sprite.setRow({ row: 1, count: 3, fps: 10 }); // 100ms/frame
    sprite.start();
    vi.advanceTimersByTime(100);
    expect(onFrame).toHaveBeenLastCalledWith({ col: 1, row: 1 });

    sprite.setFps(20); // 50ms/frame
    onFrame.mockClear();
    vi.advanceTimersByTime(50);
    expect(onFrame).toHaveBeenLastCalledWith({ col: 2, row: 1 });
    sprite.stop();
  });

  it('setFps with same value is a no-op', () => {
    const onFrame = vi.fn();
    const sprite = new PetSprite(onFrame);
    sprite.setRow({ row: 0, count: 2, fps: 10 });
    sprite.start();
    sprite.setFps(10);
    onFrame.mockClear();
    vi.advanceTimersByTime(100);
    expect(onFrame).toHaveBeenCalledTimes(1);
    sprite.stop();
  });
});
