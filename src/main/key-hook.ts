import { uIOhook, UiohookKey } from 'uiohook-napi';
import { EventEmitter } from 'node:events';

export interface KeyEvent {
  keycode: number;
  isDot: boolean;
}

export interface KeyHook {
  start(): void;
  stop(): void;
  on(event: 'key', listener: (e: KeyEvent) => void): void;
}

// uiohook-napi exports a UiohookKey enum; Period is the '.' key on every
// platform it supports. Fall back to the documented constant if the enum
// import ever drifts.
const PERIOD_KEYCODE = (UiohookKey as Record<string, number>).Period ?? 52;

export function createKeyHook(): KeyHook {
  const emitter = new EventEmitter();
  let started = false;

  const onKeydown = (e: { keycode: number }) => {
    emitter.emit('key', { keycode: e.keycode, isDot: e.keycode === PERIOD_KEYCODE });
  };

  return {
    start(): void {
      if (started) return;
      uIOhook.on('keydown', onKeydown);
      try {
        uIOhook.start();
        started = true;
      } catch (err) {
        console.error('[key-hook] failed to start', err);
        uIOhook.off('keydown', onKeydown);
      }
    },
    stop(): void {
      if (!started) return;
      uIOhook.off('keydown', onKeydown);
      try { uIOhook.stop(); } catch { /* noop */ }
      started = false;
    },
    on(event, listener) { emitter.on(event, listener); }
  };
}
