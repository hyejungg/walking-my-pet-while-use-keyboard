import { PetSprite } from './pet-sprite';
import { PetController } from './pet-controller';
import type { ThemeAssets } from '@shared/theme-types';

const DRAG_PADDING_PX = 8;

const spriteEl = document.getElementById('pet-sprite') as HTMLDivElement;

let activeTheme: ThemeAssets | null = null;
let controller: PetController | null = null;
let applyGen = 0;
let cryUntilMs = 0;

const sprite = new PetSprite(({ col, row }) => {
  const m = activeTheme?.meta;
  if (!m) return;
  spriteEl.style.backgroundPosition =
    `-${col * m.renderWidth}px -${row * m.renderHeight}px`;
});

function restoreFromCry() {
  if (!activeTheme || !controller) return;
  const m = activeTheme.meta;
  if (controller.state === 'walk') {
    sprite.setRow({ row: m.walkRow, count: m.walkColumns, fps: m.fps });
  } else {
    sprite.setRow({ row: m.idleRow, count: m.idleColumns, fps: m.fps });
  }
}

async function applyTheme(theme: ThemeAssets | null) {
  const gen = ++applyGen;

  if (controller) {
    controller.dispose();
    controller = null;
  }
  activeTheme = theme;
  cryUntilMs = 0;

  if (!theme) {
    spriteEl.style.background = 'rgba(255,200,200,0.6)';
    return;
  }

  const m = theme.meta;
  spriteEl.style.background = 'transparent';
  spriteEl.style.backgroundImage = `url("${theme.spritesheetUrl}")`;
  spriteEl.style.backgroundRepeat = 'no-repeat';
  spriteEl.style.imageRendering = 'pixelated';
  spriteEl.style.width = `${m.renderWidth}px`;
  spriteEl.style.height = `${m.renderHeight}px`;
  spriteEl.style.backgroundSize = `${m.columns * m.renderWidth}px ${m.rows * m.renderHeight}px`;

  // Window is sprite-size plus a thin transparent drag border so the sprite
  // body stays clickable (right-click, double-click) while the perimeter is
  // draggable.
  await window.petAPI.setSize(
    m.renderWidth + DRAG_PADDING_PX * 2,
    m.renderHeight + DRAG_PADDING_PX * 2
  );
  if (gen !== applyGen) return;

  controller = new PetController({
    idleTimeoutMs: 600,
    baseStepPx: m.stepPx,
    intervalMs: Math.max(40, Math.round(1000 / m.fps)),
    rateWindowMs: 2000,
    minMultiplier: 1.0,
    maxMultiplier: 3.0
  });

  controller.onStateChange((s) => {
    if (!activeTheme) return;
    if (Date.now() < cryUntilMs) return;
    const mm = activeTheme.meta;
    if (s === 'walk') sprite.setRow({ row: mm.walkRow, count: mm.walkColumns, fps: mm.fps });
    else sprite.setRow({ row: mm.idleRow, count: mm.idleColumns, fps: mm.fps });
  });

  controller.onStep(({ speedMultiplier }) => {
    if (!activeTheme) return;
    // The pet walks in place: animate sprite frames but do not move the window.
    sprite.setFps(activeTheme.meta.fps * speedMultiplier);
  });

  sprite.setRow({ row: m.idleRow, count: m.idleColumns, fps: m.fps });
  sprite.start();
}

window.petAPI.getActiveTheme().then(applyTheme);
window.petAPI.onActiveThemeChanged(applyTheme);
window.petAPI.onKeyTyped(() => {
  if (Date.now() < cryUntilMs) return;
  controller?.notifyKey();
});

// Right-click anywhere on the sprite opens the settings window.
spriteEl.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.petAPI.openSettings();
});

// Double-click triggers the cry animation for cryDurationMs, then falls back
// to whatever state the controller is currently in.
spriteEl.addEventListener('dblclick', (e) => {
  e.preventDefault();
  if (!activeTheme) return;
  const m = activeTheme.meta;
  cryUntilMs = Date.now() + m.cryDurationMs;
  sprite.setRow({ row: m.cryRow, count: m.cryColumns, fps: m.fps });
  setTimeout(restoreFromCry, m.cryDurationMs);
});
