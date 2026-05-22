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
// frameWidth 192 already corresponds to exactly one character — no extra crop.
const VISIBLE_FRACTION = 1.0;
const VERTICAL_PADDING_RATIO = 0;

// Sleep after this much continuous idle time.
const SLEEP_AFTER_IDLE_MS = 60_000;

let cryUntilMs = 0;
let hovering = false;
let sleeping = false;
let sleepTimer: ReturnType<typeof setTimeout> | null = null;

const sprite = new PetSprite(({ col, row }) => {
  if (!activeTheme) return;
  spriteEl.style.backgroundPosition = `-${col * cellW}px -${row * cellH}px`;
});

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
  if (sleeping) return { row: m.sleepRow, count: m.sleepColumns, fps: m.fps };
  return { row: m.idleRow, count: m.idleColumns, fps: m.fps };
}

function applyCurrentPose() {
  const target = computeTarget();
  if (!target) return;
  sprite.setRow(target);
}

function cancelSleepTimer() {
  if (sleepTimer) clearTimeout(sleepTimer);
  sleepTimer = null;
}

function wakeUp() {
  cancelSleepTimer();
  if (sleeping) {
    sleeping = false;
    applyCurrentPose();
  }
}

function scheduleSleep() {
  cancelSleepTimer();
  sleepTimer = setTimeout(() => {
    sleepTimer = null;
    if (!controller) return;
    if (controller.state !== 'idle') return;
    if (Date.now() < cryUntilMs) return;
    if (hovering) return;
    sleeping = true;
    applyCurrentPose();
  }, SLEEP_AFTER_IDLE_MS);
}

async function applyTheme(theme: ThemeAssets | null) {
  const gen = ++applyGen;

  if (controller) {
    controller.dispose();
    controller = null;
  }
  cancelSleepTimer();
  activeTheme = theme;
  cryUntilMs = 0;
  hovering = false;
  sleeping = false;

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
    if (s === 'walk') {
      wakeUp();
    } else {
      // Entering idle: start the timer that eventually puts the pet to sleep.
      scheduleSleep();
    }
    applyCurrentPose();
  });

  controller.onStep(({ speedMultiplier }) => {
    if (!activeTheme) return;
    sprite.setFps(activeTheme.meta.fps * speedMultiplier);
  });

  applyCurrentPose();
  sprite.start();
  scheduleSleep();
}

window.petAPI.getActiveTheme().then(applyTheme);
window.petAPI.onActiveThemeChanged(applyTheme);

window.petAPI.onKeyTyped(() => {
  if (Date.now() < cryUntilMs) return;
  wakeUp();
  controller?.notifyKey();
});

spriteEl.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.petAPI.showContextMenu();
});

spriteEl.addEventListener('dblclick', (e) => {
  e.preventDefault();
  if (!activeTheme) return;
  const m = activeTheme.meta;
  wakeUp();
  cryUntilMs = Date.now() + m.cryDurationMs;
  applyCurrentPose();
  setTimeout(() => {
    cryUntilMs = 0;
    applyCurrentPose();
    if (controller?.state === 'idle') scheduleSleep();
  }, m.cryDurationMs);
});

spriteEl.addEventListener('mouseenter', () => {
  if (!activeTheme || Date.now() < cryUntilMs) return;
  wakeUp();
  hovering = true;
  applyCurrentPose();
});
spriteEl.addEventListener('mouseleave', () => {
  if (!hovering) return;
  hovering = false;
  if (Date.now() < cryUntilMs) return;
  applyCurrentPose();
  if (controller?.state === 'idle') scheduleSleep();
});

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
    wakeUp();
  }
  window.petAPI.setPosition(drag.startWx + dx, drag.startWy + dy);
});

window.addEventListener('mouseup', () => {
  if (!drag) return;
  spriteEl.classList.remove('dragging');
  drag = null;
});
