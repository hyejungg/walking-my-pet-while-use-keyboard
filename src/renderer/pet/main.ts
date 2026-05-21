import { PetSprite } from './pet-sprite';
import { PetController } from './pet-controller';
import type { ThemeAssets } from '@shared/theme-types';
import { PET_SIZE_SCALE } from '@shared/settings-schema';

const spriteEl = document.getElementById('pet-sprite') as HTMLDivElement;

let activeTheme: ThemeAssets | null = null;
let controller: PetController | null = null;
let applyGen = 0;
let cryUntilMs = 0;
let effectiveRenderWidth = 0;
let effectiveRenderHeight = 0;

const sprite = new PetSprite(({ col, row }) => {
  if (!activeTheme) return;
  spriteEl.style.backgroundPosition =
    `-${col * effectiveRenderWidth}px -${row * effectiveRenderHeight}px`;
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
  const settings = await window.petAPI.getSettings();
  if (gen !== applyGen) return;

  const scale = PET_SIZE_SCALE[settings.petSize];
  effectiveRenderWidth = Math.round(m.frameWidth * scale);
  effectiveRenderHeight = Math.round(m.frameHeight * scale);

  spriteEl.style.background = 'transparent';
  spriteEl.style.backgroundImage = `url("${theme.spritesheetUrl}")`;
  spriteEl.style.backgroundRepeat = 'no-repeat';
  spriteEl.style.imageRendering = 'pixelated';
  spriteEl.style.width = `${effectiveRenderWidth}px`;
  spriteEl.style.height = `${effectiveRenderHeight}px`;
  spriteEl.style.backgroundSize =
    `${m.columns * effectiveRenderWidth}px ${m.rows * effectiveRenderHeight}px`;

  await window.petAPI.setSize(effectiveRenderWidth, effectiveRenderHeight);
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
    // Walk in place: animate sprite frames but do not move the window.
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

// Double-click plays cry animation for cryDurationMs.
spriteEl.addEventListener('dblclick', (e) => {
  e.preventDefault();
  if (!activeTheme) return;
  const m = activeTheme.meta;
  cryUntilMs = Date.now() + m.cryDurationMs;
  sprite.setRow({ row: m.cryRow, count: m.cryColumns, fps: m.fps });
  setTimeout(restoreFromCry, m.cryDurationMs);
});

// Click-and-drag anywhere on the sprite moves the pet window. Only enters
// drag mode after the cursor actually moves so single/double clicks are
// undisturbed.
const DRAG_THRESHOLD_PX = 3;

interface DragState {
  startMx: number;
  startMy: number;
  startWx: number;
  startWy: number;
  active: boolean;
}

let drag: DragState | null = null;

spriteEl.addEventListener('mousedown', async (e) => {
  if (e.button !== 0) return;
  const bounds = await window.petAPI.getBounds();
  if (!bounds) return;
  drag = {
    startMx: e.screenX,
    startMy: e.screenY,
    startWx: bounds.x,
    startWy: bounds.y,
    active: false
  };
});

window.addEventListener('mousemove', (e) => {
  if (!drag) return;
  const dx = e.screenX - drag.startMx;
  const dy = e.screenY - drag.startMy;
  if (!drag.active) {
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    drag.active = true;
    spriteEl.classList.add('dragging');
  }
  window.petAPI.setPosition(drag.startWx + dx, drag.startWy + dy);
});

window.addEventListener('mouseup', () => {
  if (!drag) return;
  spriteEl.classList.remove('dragging');
  drag = null;
});
