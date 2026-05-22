import { uIOhook, UiohookKey } from 'uiohook-napi';
import { EventEmitter } from 'node:events';

export interface KeyEvent {
  keycode: number;
  isQuestion: boolean;
}

export interface KeyHook {
  start(): void;
  stop(): void;
  on(event: 'key', listener: (e: KeyEvent) => void): void;
}

// '?' is Shift + '/'. uiohook only reports the raw keycode (Slash) — Shift
// state isn't tracked here, so pressing either '/' or '?' will trigger
// the question reaction.
const SLASH_KEYCODE = (UiohookKey as Record<string, number>).Slash ?? 53;

export function createKeyHook(): KeyHook {
  const emitter = new EventEmitter();
  let started = false;

  const onKeydown = (e: { keycode: number }) => {
    emitter.emit('key', { keycode: e.keycode, isQuestion: e.keycode === SLASH_KEYCODE });
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
