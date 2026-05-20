import { uIOhook } from 'uiohook-napi';
import { EventEmitter } from 'node:events';

export interface KeyHook {
  start(): void;
  stop(): void;
  on(event: 'key', listener: () => void): void;
}

export function createKeyHook(): KeyHook {
  const emitter = new EventEmitter();
  let started = false;

  const onKeydown = () => emitter.emit('key');

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
