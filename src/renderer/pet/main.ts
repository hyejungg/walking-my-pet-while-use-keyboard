import { PetSprite } from './pet-sprite';
import { PetController } from './pet-controller';
import type { ThemeAssets } from '@shared/theme-types';
import { PET_SIZE_SCALE } from '@shared/settings-schema';

const spriteEl = document.getElementById('pet-sprite') as HTMLDivElement;

let activeTheme: ThemeAssets | null = null;
let controller: PetController | null = null;
let applyGen = 0;

let cellW = 0;
let cellH = 0;
const VISIBLE_FRACTION = 0.55;
const VERTICAL_PADDING_RATIO = 0;

// Priority-driven reaction state — the reaction with the highest priority
// that is still active drives sprite rendering. Mutually-exclusive: a higher
// reaction cancels lower ones.
let cryUntilMs = 0;
let dizzyUntilMs = 0;
let cheerUntilMs = 0;
let variantUntilMs = 0;
let hovering = false;
let keyCount = 0;

const sprite = new PetSprite(({ col, row }) => {
  if (!activeTheme) return;
  spriteEl.style.backgroundPosition = `-${col * cellW}px -${row * cellH}px`;
});

function isNightHour(): boolean {
  const h = new Date().getHours();
  return h >= 22 || h < 6;
}

function applyCurrentPose() {
  if (!activeTheme || !controller) return;
  const m = activeTheme.meta;
  const now = Date.now();
  if (now < cryUntilMs) {
    // Cry is a single still frame so it doesn't flicker between poses.
    sprite.setRow({ row: m.cryRow, count: 1, fps: m.fps });
    return;
  }
  if (now < dizzyUntilMs) {
    sprite.setRow({ row: m.dizzyRow, count: m.dizzyColumns, fps: m.fps });
    return;
  }
  if (now < cheerUntilMs) {
    sprite.setRow({ row: m.cheerRow, count: m.cheerColumns, fps: m.fps });
    return;
  }
  if (hovering) {
    sprite.setRow({ row: m.hoverRow, count: m.hoverColumns, fps: m.fps });
    return;
  }
  if (controller.state === 'walk') {
    sprite.setRow({ row: m.walkRow, count: m.walkColumns, fps: m.fps });
    return;
  }
  if (now < variantUntilMs) {
    // A variant is still in flight — leave it alone.
    return;
  }
  if (isNightHour()) {
    sprite.setRow({ row: m.sleepRow, count: m.sleepColumns, fps: m.fps });
    return;
  }
  sprite.setRow({ row: m.idleRow, count: m.idleColumns, fps: m.fps });
}

// Idle-time variety: occasionally pick a different row to show. Suppressed
// during higher-priority reactions and during walk/hover.
const VARIANT_MIN_WAIT_MS = 8_000;
const VARIANT_MAX_WAIT_MS = 18_000;
const VARIANT_DURATION_MS = 2_500;

let variantTimer: ReturnType<typeof setTimeout> | null = null;

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

function reservedRows(): Set<number> {
  if (!activeTheme) return new Set();
  const m = activeTheme.meta;
  return new Set([m.idleRow, m.walkRow, m.cryRow, m.hoverRow, m.cheerRow, m.dizzyRow, m.sleepRow]);
}

function triggerVariant() {
  variantTimer = null;
  if (!activeTheme || !controller) return;
  if (controller.state !== 'idle' || Date.now() < cryUntilMs) {
    scheduleVariant();
    return;
  }
  const m = activeTheme.meta;
  const reserved = reservedRows();
  const rows: number[] = [];
  for (let r = 0; r < m.rows; r++) if (!reserved.has(r)) rows.push(r);
  if (rows.length === 0) {
    scheduleVariant();
    return;
  }
  const row = rows[Math.floor(Math.random() * rows.length)];
  variantUntilMs = Date.now() + VARIANT_DURATION_MS;
  sprite.setRow({ row, count: m.columns, fps: m.fps });
  setTimeout(() => {
    variantUntilMs = 0;
    applyCurrentPose();
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
  cryUntilMs = dizzyUntilMs = cheerUntilMs = 0;
  hovering = false;
  keyCount = 0;

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
  spriteEl.style.backgroundSize = `${m.columns * cellW}px ${m.rows * cellH}px`;

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
    if (s === 'walk') {
      cancelVariant();
    } else {
      scheduleVariant();
    }
    applyCurrentPose();
  });

  controller.onStep(({ speedMultiplier }) => {
    if (!activeTheme) return;
    sprite.setFps(activeTheme.meta.fps * speedMultiplier);
  });

  applyCurrentPose();
  sprite.start();
  scheduleVariant();
}

window.petAPI.getActiveTheme().then(applyTheme);
window.petAPI.onActiveThemeChanged(applyTheme);

window.petAPI.onKeyTyped(() => {
  if (Date.now() < cryUntilMs) return;
  controller?.notifyKey();
  // Accumulated typing → cheer reaction every cheerThreshold keys.
  if (!activeTheme) return;
  const m = activeTheme.meta;
  keyCount++;
  if (keyCount >= m.cheerThreshold) {
    keyCount = 0;
    cheerUntilMs = Date.now() + m.cheerDurationMs;
    cancelVariant();
    applyCurrentPose();
    setTimeout(() => {
      cheerUntilMs = 0;
      applyCurrentPose();
    }, m.cheerDurationMs);
  }
});

// Right-click → settings.
spriteEl.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.petAPI.openSettings();
});

// Double-click → still cry frame for cryDurationMs.
spriteEl.addEventListener('dblclick', (e) => {
  e.preventDefault();
  if (!activeTheme) return;
  const m = activeTheme.meta;
  cancelVariant();
  cryUntilMs = Date.now() + m.cryDurationMs;
  applyCurrentPose();
  setTimeout(() => {
    cryUntilMs = 0;
    applyCurrentPose();
  }, m.cryDurationMs);
});

// Hover → react pose for as long as the cursor is over the pet.
spriteEl.addEventListener('mouseenter', () => {
  if (!activeTheme || Date.now() < cryUntilMs) return;
  hovering = true;
  cancelVariant();
  applyCurrentPose();
});
spriteEl.addEventListener('mouseleave', () => {
  if (!hovering) return;
  hovering = false;
  if (Date.now() < cryUntilMs) return;
  applyCurrentPose();
  scheduleVariant();
});

// Drag + shake detection.
const DRAG_THRESHOLD_PX = 3;
const SHAKE_WINDOW_MS = 700;
const SHAKE_REVERSALS_REQUIRED = 4;
const SHAKE_MIN_DELTA_PX = 14;

interface DragState {
  startMx: number;
  startMy: number;
  startWx: number;
  startWy: number;
  active: boolean;
  lastX: number;
  lastDir: 1 | -1 | 0;
  reversals: number;
  reversalSince: number;
}

let drag: DragState | null = null;

function detectShake(now: number, x: number) {
  if (!drag) return;
  const dxStep = x - drag.lastX;
  if (Math.abs(dxStep) < SHAKE_MIN_DELTA_PX) return;
  const dir: 1 | -1 = dxStep > 0 ? 1 : -1;
  if (drag.lastDir !== 0 && dir !== drag.lastDir) {
    drag.reversals++;
    if (now - drag.reversalSince > SHAKE_WINDOW_MS) drag.reversals = 1;
    drag.reversalSince = now;
    if (drag.reversals >= SHAKE_REVERSALS_REQUIRED && activeTheme) {
      const m = activeTheme.meta;
      dizzyUntilMs = now + m.dizzyDurationMs;
      drag.reversals = 0;
      applyCurrentPose();
      setTimeout(() => {
        dizzyUntilMs = 0;
        applyCurrentPose();
      }, m.dizzyDurationMs);
    }
  }
  drag.lastDir = dir;
  drag.lastX = x;
}

spriteEl.addEventListener('mousedown', async (e) => {
  if (e.button !== 0) return;
  const bounds = await window.petAPI.getBounds();
  if (!bounds) return;
  drag = {
    startMx: e.screenX,
    startMy: e.screenY,
    startWx: bounds.x,
    startWy: bounds.y,
    active: false,
    lastX: e.screenX,
    lastDir: 0,
    reversals: 0,
    reversalSince: Date.now()
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
  detectShake(Date.now(), e.screenX);
});

window.addEventListener('mouseup', () => {
  if (!drag) return;
  spriteEl.classList.remove('dragging');
  drag = null;
});

// Re-evaluate pose at 1-minute granularity so the night/day boundary at 22:00
// or 06:00 swaps the idle pose without waiting for an event.
setInterval(() => {
  if (!controller) return;
  if (controller.state !== 'idle') return;
  if (Date.now() < cryUntilMs || Date.now() < dizzyUntilMs ||
      Date.now() < cheerUntilMs || Date.now() < variantUntilMs) return;
  if (hovering) return;
  applyCurrentPose();
}, 60_000);
