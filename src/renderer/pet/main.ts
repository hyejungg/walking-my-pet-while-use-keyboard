import { PetSprite, FrameIndex } from './pet-sprite';
import { PetController } from './pet-controller';
import type { ThemeAssets } from '@shared/theme-types';
import { PET_SIZE_SCALE } from '@shared/settings-schema';

const spriteEl = document.getElementById('pet-sprite') as HTMLDivElement;

let activeTheme: ThemeAssets | null = null;
let controller: PetController | null = null;
let applyGen = 0;

let cellW = 0;
let cellH = 0;
const VISIBLE_FRACTION = 1.0;
const VERTICAL_PADDING_RATIO = 0;
const SLEEP_AFTER_IDLE_MS = 60_000;
// How long we wait for a possible dblclick before treating a mouseup as a
// single click. macOS double-click threshold is ~300ms.
const SINGLE_CLICK_DELAY_MS = 280;
// Walk plays slightly faster than the base reactions so the marching looks
// lively even at 1× typing speed.
const WALK_FPS_BOOST = 1.5;

let cryUntilMs = 0;
let clickUntilMs = 0;
let dotUntilMs = 0;
let hovering = false;
let sleeping = false;
let sleepTimer: ReturnType<typeof setTimeout> | null = null;
let singleClickTimer: ReturnType<typeof setTimeout> | null = null;

const sprite = new PetSprite((frame: FrameIndex) => {
  if (!activeTheme) return;
  spriteEl.style.backgroundPosition = `-${frame.col * cellW}px -${frame.row * cellH}px`;
});

function buildSequence(rows: number[], columns: number): FrameIndex[] {
  const frames: FrameIndex[] = [];
  for (const r of rows) {
    for (let c = 0; c < columns; c++) frames.push({ col: c, row: r });
  }
  return frames;
}

interface TargetPose {
  sequence: FrameIndex[];
  fps: number;
}

function computeTarget(): TargetPose | null {
  if (!activeTheme || !controller) return null;
  const m = activeTheme.meta;
  const now = Date.now();
  if (now < cryUntilMs) {
    return { sequence: buildSequence([m.cryRow], m.cryColumns), fps: m.fps };
  }
  if (now < dotUntilMs) {
    return { sequence: buildSequence([m.dotRow], m.dotColumns), fps: m.fps };
  }
  if (now < clickUntilMs) {
    return { sequence: buildSequence([m.clickRow], m.clickColumns), fps: m.fps };
  }
  if (hovering) {
    return { sequence: buildSequence(m.hoverRows, m.hoverColumns), fps: m.fps };
  }
  if (controller.state === 'walk') {
    return { sequence: buildSequence(m.walkRows, m.walkColumns), fps: m.fps * WALK_FPS_BOOST };
  }
  if (sleeping) {
    return { sequence: buildSequence([m.sleepRow], m.sleepColumns), fps: m.fps };
  }
  // Idle: still single frame.
  return { sequence: [{ col: 0, row: m.idleRow }], fps: m.fps };
}

function applyCurrentPose() {
  const t = computeTarget();
  if (!t) return;
  sprite.setSequence(t.sequence, t.fps);
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
    if (!controller || controller.state !== 'idle') return;
    if (Date.now() < cryUntilMs || Date.now() < clickUntilMs || Date.now() < dotUntilMs) return;
    if (hovering) return;
    sleeping = true;
    applyCurrentPose();
  }, SLEEP_AFTER_IDLE_MS);
}

function triggerClick() {
  if (!activeTheme) return;
  const m = activeTheme.meta;
  wakeUp();
  clickUntilMs = Date.now() + m.clickDurationMs;
  applyCurrentPose();
  setTimeout(() => {
    clickUntilMs = 0;
    applyCurrentPose();
    if (controller?.state === 'idle') scheduleSleep();
  }, m.clickDurationMs);
}

function triggerDot() {
  if (!activeTheme) return;
  const m = activeTheme.meta;
  wakeUp();
  dotUntilMs = Date.now() + m.dotDurationMs;
  applyCurrentPose();
  setTimeout(() => {
    dotUntilMs = 0;
    applyCurrentPose();
  }, m.dotDurationMs);
}

async function applyTheme(theme: ThemeAssets | null) {
  const gen = ++applyGen;

  if (controller) {
    controller.dispose();
    controller = null;
  }
  cancelSleepTimer();
  activeTheme = theme;
  cryUntilMs = clickUntilMs = dotUntilMs = 0;
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
      scheduleSleep();
    }
    applyCurrentPose();
  });

  controller.onStep(({ speedMultiplier }) => {
    if (!activeTheme) return;
    sprite.setFps(activeTheme.meta.fps * WALK_FPS_BOOST * speedMultiplier);
  });

  applyCurrentPose();
  sprite.start();
  scheduleSleep();
}

window.petAPI.getActiveTheme().then(applyTheme);
window.petAPI.onActiveThemeChanged(applyTheme);

window.petAPI.onKeyTyped((evt) => {
  if (Date.now() < cryUntilMs) return;
  wakeUp();
  controller?.notifyKey();
  if (evt.isDot) triggerDot();
});

spriteEl.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.petAPI.showContextMenu();
});

spriteEl.addEventListener('dblclick', (e) => {
  e.preventDefault();
  // Cancel any pending single-click reaction so it doesn't fire after cry.
  if (singleClickTimer) {
    clearTimeout(singleClickTimer);
    singleClickTimer = null;
  }
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
  const wasDrag = drag.active;
  spriteEl.classList.remove('dragging');
  drag = null;
  // Single left-click reaction: fire only when the user neither dragged nor
  // produced a dblclick within the short delay window.
  if (!wasDrag) {
    if (singleClickTimer) clearTimeout(singleClickTimer);
    singleClickTimer = setTimeout(() => {
      singleClickTimer = null;
      triggerClick();
    }, SINGLE_CLICK_DELAY_MS);
  }
});
