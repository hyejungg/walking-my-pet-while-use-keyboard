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
const VISIBLE_FRACTION = 0.75;
const VERTICAL_PADDING_RATIO = 0;

let cryUntilMs = 0;
let variantUntilMs = 0;
let hovering = false;

// Walk left/right flip — every WALK_FLIP_INTERVAL_MS the sprite mirrors
// horizontally so the character looks like it's wandering both directions.
const WALK_FLIP_INTERVAL_MS = 4_000;
let walkFlipped = false;
let walkFlipTimer: ReturnType<typeof setInterval> | null = null;

// Idle-time variants: every 8–18 seconds an "unused" row plays for ~2.5s.
const VARIANT_MIN_WAIT_MS = 8_000;
const VARIANT_MAX_WAIT_MS = 18_000;
const VARIANT_DURATION_MS = 2_500;
let variantTimer: ReturnType<typeof setTimeout> | null = null;
let variantTimeout: ReturnType<typeof setTimeout> | null = null;

const sprite = new PetSprite(({ col, row }) => {
  if (!activeTheme) return;
  spriteEl.style.backgroundPosition = `-${col * cellW}px -${row * cellH}px`;
});

function isNightHour(): boolean {
  const h = new Date().getHours();
  return h >= 22 || h < 6;
}

function reservedRows(): Set<number> {
  if (!activeTheme) return new Set();
  const m = activeTheme.meta;
  return new Set([m.idleRow, m.walkRow, m.cryRow, m.hoverRow, m.sleepRow]);
}

interface TargetPose {
  row: number;
  count: number;
  fps: number;
}

function computeTarget(): TargetPose | null {
  if (!activeTheme || !controller) return null;
  const m = activeTheme.meta;
  const now = Date.now();
  if (now < cryUntilMs) return { row: m.cryRow, count: 1, fps: m.fps };
  if (hovering) return { row: m.hoverRow, count: m.hoverColumns, fps: m.fps };
  if (controller.state === 'walk') return { row: m.walkRow, count: m.walkColumns, fps: m.fps };
  if (now < variantUntilMs) return null; // variant timeout already set the row
  if (isNightHour()) return { row: m.sleepRow, count: m.sleepColumns, fps: m.fps };
  return { row: m.idleRow, count: m.idleColumns, fps: m.fps };
}

function applyCurrentPose() {
  const target = computeTarget();
  if (!target) return;
  sprite.setRow(target);
}

function startWalkFlipTimer() {
  if (walkFlipTimer) clearInterval(walkFlipTimer);
  walkFlipped = false;
  spriteEl.style.transform = 'scaleX(1)';
  walkFlipTimer = setInterval(() => {
    walkFlipped = !walkFlipped;
    spriteEl.style.transform = walkFlipped ? 'scaleX(-1)' : 'scaleX(1)';
  }, WALK_FLIP_INTERVAL_MS);
}

function stopWalkFlipTimer() {
  if (walkFlipTimer) clearInterval(walkFlipTimer);
  walkFlipTimer = null;
  walkFlipped = false;
  spriteEl.style.transform = 'scaleX(1)';
}

function cancelVariant() {
  if (variantTimer) clearTimeout(variantTimer);
  if (variantTimeout) clearTimeout(variantTimeout);
  variantTimer = variantTimeout = null;
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
  if (controller.state !== 'idle' || Date.now() < cryUntilMs || hovering) {
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
  // Variant is a single still frame so the pet "tries on" a pose rather
  // than animating through it.
  sprite.setRow({ row, count: 1, fps: m.fps });
  variantTimeout = setTimeout(() => {
    variantTimeout = null;
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
  stopWalkFlipTimer();
  activeTheme = theme;
  cryUntilMs = 0;
  hovering = false;

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
  spriteEl.style.transform = 'scaleX(1)';

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
    if (s === 'walk') {
      cancelVariant();
      startWalkFlipTimer();
    } else {
      stopWalkFlipTimer();
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
});

spriteEl.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.petAPI.openSettings();
});

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
    if (controller?.state === 'idle') scheduleVariant();
  }, m.cryDurationMs);
});

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
  if (controller?.state === 'idle') scheduleVariant();
});

// Drag.
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

setInterval(() => {
  if (!controller || controller.state !== 'idle') return;
  if (Date.now() < cryUntilMs || Date.now() < variantUntilMs) return;
  if (hovering) return;
  applyCurrentPose();
}, 60_000);
