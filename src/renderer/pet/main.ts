import { PetSprite } from './pet-sprite';
import { PetController } from './pet-controller';
import type { ThemeAssets } from '@shared/theme-types';

const spriteEl = document.getElementById('pet-sprite') as HTMLDivElement;

let activeTheme: ThemeAssets | null = null;
let controller: PetController | null = null;

const sprite = new PetSprite(({ col, row }) => {
  const m = activeTheme?.meta;
  if (!m) return;
  spriteEl.style.backgroundPosition =
    `-${col * m.renderWidth}px -${row * m.renderHeight}px`;
});

async function applyTheme(theme: ThemeAssets | null) {
  if (controller) {
    controller.dispose();
    controller = null;
  }
  activeTheme = theme;

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

  await window.petAPI.setSize(m.renderWidth, m.renderHeight);

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
    const mm = activeTheme.meta;
    if (s === 'walk') sprite.setRow({ row: mm.walkRow, count: mm.walkColumns, fps: mm.fps });
    else sprite.setRow({ row: mm.idleRow, count: mm.idleColumns, fps: mm.fps });
  });

  controller.onStep(async ({ dx, direction, speedMultiplier }) => {
    if (!activeTheme) return;
    spriteEl.style.transform = direction === 'left' ? 'scaleX(-1)' : 'scaleX(1)';
    sprite.setFps(activeTheme.meta.fps * speedMultiplier);
    const result = await window.petAPI.moveBy(dx);
    if (result.hitEdge && controller) controller.flipDirection();
  });

  sprite.setRow({ row: m.idleRow, count: m.idleColumns, fps: m.fps });
  sprite.start();
}

window.petAPI.getActiveTheme().then(applyTheme);
window.petAPI.onActiveThemeChanged(applyTheme);
window.petAPI.onKeyTyped(() => controller?.notifyKey());
