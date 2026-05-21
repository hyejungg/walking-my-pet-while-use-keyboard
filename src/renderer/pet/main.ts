import { PetSprite } from './pet-sprite';
import { PetController } from './pet-controller';
import type { ThemeAssets } from '@shared/theme-types';
import { PET_SIZE_SCALE } from '@shared/settings-schema';

const spriteEl = document.getElementById('pet-sprite') as HTMLDivElement;

let activeTheme: ThemeAssets | null = null;
let controller: PetController | null = null;
let applyGen = 0;
let cryUntilMs = 0;
// One cell on the rendered sprite sheet, scaled. The pet window only shows
// VISIBLE_FRACTION of cellW horizontally so cells that happen to pack more
// than one character render as a single character. VERTICAL_PADDING_RATIO
// stretches the visible window slightly past the cell's nominal height to
// catch characters whose feet bleed below the frame boundary in the source
// sheet (the small inter-cell margin in the sheet hides the overflow).
let cellW = 0;
let cellH = 0;
const VISIBLE_FRACTION = 0.5;
const VERTICAL_PADDING_RATIO = 0.1;

const sprite = new PetSprite(({ col, row }) => {
  if (!activeTheme) return;
  spriteEl.style.backgroundPosition = `-${col * cellW}px -${row * cellH}px`;
});

function restoreFromCry() {
  if (!activeTheme || !controller) return;
  const m = activeTheme.meta;
  if (controller.state === 'walk') {
    sprite.setRow({ row: m.walkRow, count: m.walkColumns, fps: m.fps });
  } else {
    sprite.setRow({ row: m.idleRow, count: m.idleColumns, fps: m.fps });
    scheduleVariant();
  }
}

// Idle-time variety: while the pet is idle, occasionally play a different
// row from the sprite sheet so the user sees more poses than just idle.
// Walk row, cry row, and the idle row itself are excluded so variants are
// genuinely new poses.
const VARIANT_MIN_WAIT_MS = 8_000;
const VARIANT_MAX_WAIT_MS = 18_000;
const VARIANT_DURATION_MS = 2_500;

let variantTimer: ReturnType<typeof setTimeout> | null = null;
let variantUntilMs = 0;

function cancelVariant() {
  if (variantTimer) {
    clearTimeout(variantTimer);
    variantTimer = null;
  }
  variantUntilMs = 0;
}

function scheduleVariant() {
  if (variantTimer) clearTimeout(variantTimer);
  const wait = VARIANT_MIN_WAIT_MS + Math.random() * (VARIANT_MAX_WAIT_MS - VARIANT_MIN_WAIT_MS);
  variantTimer = setTimeout(triggerVariant, wait);
}

function triggerVariant() {
  variantTimer = null;
  if (!activeTheme || !controller) return;
  if (controller.state !== 'idle' || Date.now() < cryUntilMs) {
    scheduleVariant();
    return;
  }
  const m = activeTheme.meta;
  const rows: number[] = [];
  for (let r = 0; r < m.rows; r++) {
    if (r === m.idleRow || r === m.walkRow || r === m.cryRow) continue;
    rows.push(r);
  }
  if (rows.length === 0) return;
  const row = rows[Math.floor(Math.random() * rows.length)];
  sprite.setRow({ row, count: m.columns, fps: m.fps });
  variantUntilMs = Date.now() + VARIANT_DURATION_MS;
  setTimeout(() => {
    variantUntilMs = 0;
    if (!activeTheme || !controller) return;
    if (controller.state === 'idle' && Date.now() >= cryUntilMs) {
      sprite.setRow({ row: m.idleRow, count: m.idleColumns, fps: m.fps });
    }
    scheduleVariant();
  }, VARIANT_DURATION_MS);
}

async function applyTheme(theme: ThemeAssets | null) {
  const gen = ++applyGen;

  if (controller) {
    controller.dispose();
    controller = null;
  }
  cancelVariant();
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
  cellW = Math.round(m.frameWidth * scale);
  cellH = Math.round(m.frameHeight * scale);
  const visibleW = Math.round(cellW * VISIBLE_FRACTION);
  const visibleH = Math.round(cellH * (1 + VERTICAL_PADDING_RATIO));

  spriteEl.style.background = 'transparent';
  spriteEl.style.backgroundImage = `url("${theme.spritesheetUrl}")`;
  spriteEl.style.backgroundRepeat = 'no-repeat';
  spriteEl.style.imageRendering = 'pixelated';
  spriteEl.style.width = `${visibleW}px`;
  spriteEl.style.height = `${visibleH}px`;
  spriteEl.style.backgroundSize =
    `${m.columns * cellW}px ${m.rows * cellH}px`;

  await window.petAPI.setSize(visibleW, visibleH);
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
    if (s === 'walk') {
      cancelVariant();
      sprite.setRow({ row: mm.walkRow, count: mm.walkColumns, fps: mm.fps });
    } else {
      // Don't stomp on a variant that's still playing.
      if (Date.now() >= variantUntilMs) {
        sprite.setRow({ row: mm.idleRow, count: mm.idleColumns, fps: mm.fps });
      }
      scheduleVariant();
    }
  });

  controller.onStep(({ speedMultiplier }) => {
    if (!activeTheme) return;
    // Walk in place: animate sprite frames but do not move the window.
    sprite.setFps(activeTheme.meta.fps * speedMultiplier);
  });

  sprite.setRow({ row: m.idleRow, count: m.idleColumns, fps: m.fps });
  sprite.start();
  scheduleVariant();
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
  cancelVariant();
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
