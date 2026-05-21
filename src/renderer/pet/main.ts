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
// How long the sprite fades out before a new pose is committed.
const FADE_OUT_MS = 120;
const FADE_OUT_OPACITY = 0.25;

let cryUntilMs = 0;
let hovering = false;
let lastAppliedRow = -1;
let pendingFadeTimer: ReturnType<typeof setTimeout> | null = null;

const sprite = new PetSprite(({ col, row }) => {
  if (!activeTheme) return;
  spriteEl.style.backgroundPosition = `-${col * cellW}px -${row * cellH}px`;
});

function isNightHour(): boolean {
  const h = new Date().getHours();
  return h >= 22 || h < 6;
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
  if (isNightHour()) return { row: m.sleepRow, count: m.sleepColumns, fps: m.fps };
  return { row: m.idleRow, count: m.idleColumns, fps: m.fps };
}

function applyCurrentPose() {
  const target = computeTarget();
  if (!target) return;
  if (target.row === lastAppliedRow) {
    // Same row — likely a count/fps refresh during walk speed changes; no
    // visual swap, no fade needed.
    sprite.setRow(target);
    return;
  }
  if (pendingFadeTimer) {
    clearTimeout(pendingFadeTimer);
    pendingFadeTimer = null;
  }
  spriteEl.style.opacity = String(FADE_OUT_OPACITY);
  pendingFadeTimer = setTimeout(() => {
    pendingFadeTimer = null;
    sprite.setRow(target);
    lastAppliedRow = target.row;
    spriteEl.style.opacity = '1';
  }, FADE_OUT_MS);
}

async function applyTheme(theme: ThemeAssets | null) {
  const gen = ++applyGen;

  if (controller) {
    controller.dispose();
    controller = null;
  }
  if (pendingFadeTimer) {
    clearTimeout(pendingFadeTimer);
    pendingFadeTimer = null;
  }
  activeTheme = theme;
  cryUntilMs = 0;
  hovering = false;
  lastAppliedRow = -1;

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
  spriteEl.style.opacity = '1';

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

  controller.onStateChange(() => {
    applyCurrentPose();
  });

  controller.onStep(({ speedMultiplier }) => {
    if (!activeTheme) return;
    sprite.setFps(activeTheme.meta.fps * speedMultiplier);
  });

  applyCurrentPose();
  sprite.start();
}

window.petAPI.getActiveTheme().then(applyTheme);
window.petAPI.onActiveThemeChanged(applyTheme);

window.petAPI.onKeyTyped(() => {
  if (Date.now() < cryUntilMs) return;
  controller?.notifyKey();
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
  applyCurrentPose();
});
spriteEl.addEventListener('mouseleave', () => {
  if (!hovering) return;
  hovering = false;
  if (Date.now() < cryUntilMs) return;
  applyCurrentPose();
});

// Click-and-drag anywhere on the sprite moves the pet window.
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

// Re-evaluate pose at 1-minute granularity so the night/day boundary at 22:00
// or 06:00 swaps the idle pose without waiting for an event.
setInterval(() => {
  if (!controller || controller.state !== 'idle') return;
  if (Date.now() < cryUntilMs) return;
  if (hovering) return;
  applyCurrentPose();
}, 60_000);
