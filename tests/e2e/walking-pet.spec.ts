import { _electron as electron, test, expect, ElectronApplication, Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const repoRoot = resolve(__dirname, '..', '..');
const mainEntry = join(repoRoot, 'out', 'main', 'index.js');

let app: ElectronApplication;
let petWindow: Page;
let petWindowId: number;
let userDataDir: string;

async function sendKey(times = 1): Promise<void> {
  for (let i = 0; i < times; i++) {
    await app.evaluate(({ BrowserWindow }, id) => {
      BrowserWindow.fromId(id)?.webContents.send('pet:key-typed');
    }, petWindowId);
  }
}

async function getPetBounds() {
  const b = await app.evaluate(({ BrowserWindow }, id) => {
    return BrowserWindow.fromId(id)?.getBounds() ?? null;
  }, petWindowId);
  if (!b) throw new Error('pet window not found');
  return b;
}

async function spriteStyle() {
  return petWindow.locator('#pet-sprite').evaluate((el) => {
    const cs = getComputedStyle(el as HTMLElement);
    return {
      backgroundImage: cs.backgroundImage,
      backgroundPosition: cs.backgroundPosition,
      backgroundSize: cs.backgroundSize,
      transform: cs.transform,
      width: (el as HTMLElement).clientWidth,
      height: (el as HTMLElement).clientHeight
    };
  });
}

async function openSettings(): Promise<Page> {
  const winPromise = app.waitForEvent('window');
  await app.evaluate(() => {
    const g = globalThis as unknown as { __openSettings?: () => void };
    if (typeof g.__openSettings !== 'function') {
      throw new Error('main process did not expose __openSettings');
    }
    g.__openSettings();
  });
  const win = await winPromise;
  await win.waitForLoadState('domcontentloaded');
  return win;
}

test.beforeAll(async () => {
  userDataDir = mkdtempSync(join(tmpdir(), 'walking-pet-e2e-'));
  app = await electron.launch({
    args: [mainEntry, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, WALKING_PET_E2E: '1' },
    timeout: 30_000
  });
  app.process().stdout?.on('data', (b) => process.stdout.write(`[main stdout] ${b}`));
  app.process().stderr?.on('data', (b) => process.stdout.write(`[main stderr] ${b}`));
  app.process().on('exit', (code, signal) =>
    process.stdout.write(`[main exit] code=${code} signal=${signal}\n`));

  petWindow = await app.firstWindow();
  petWindow.on('console', (msg) => process.stdout.write(`[pet console:${msg.type()}] ${msg.text()}\n`));
  petWindow.on('pageerror', (err) => process.stdout.write(`[pet pageerror] ${err.stack || err.message}\n`));
  petWindow.on('close', () => process.stdout.write('[pet window closed]\n'));

  await petWindow.waitForLoadState('domcontentloaded');
  petWindowId = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].id);
  await petWindow.waitForFunction(() => {
    const el = document.getElementById('pet-sprite');
    return !!el && getComputedStyle(el).backgroundImage.includes('spritesheet.webp');
  }, { timeout: 10_000 });
});

test.afterAll(async () => {
  try { await app?.close(); } catch { /* noop */ }
  if (userDataDir) {
    try { rmSync(userDataDir, { recursive: true, force: true }); } catch { /* noop */ }
  }
});

test('pet window boots as a small always-on-top frameless widget', async () => {
  const meta = await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    return {
      bounds: w.getBounds(),
      alwaysOnTop: w.isAlwaysOnTop(),
      visible: w.isVisible()
    };
  });
  expect(meta.alwaysOnTop).toBe(true);
  expect(meta.visible).toBe(true);
  expect(meta.bounds.width).toBe(160);
  expect(meta.bounds.height).toBe(130);
});

test('active theme spritesheet is applied and rendered', async () => {
  const s = await spriteStyle();
  expect(s.backgroundImage).toMatch(/spritesheet\.webp/);
  expect(s.backgroundSize).toMatch(/960px\s+1170px/);
  expect(s.width).toBe(160);
  expect(s.height).toBe(130);
});

test('initial state is idle: backgroundPosition at idleRow=0', async () => {
  const s = await spriteStyle();
  expect(s.backgroundPosition).toMatch(/^0px\s+0px$/);
});

test('typing dispatches walk and physically moves the window', async () => {
  const start = await getPetBounds();

  for (let i = 0; i < 6; i++) {
    await sendKey();
    await petWindow.waitForTimeout(40);
  }
  await petWindow.waitForTimeout(400);

  const after = await getPetBounds();
  expect(after.x).not.toBe(start.x);

  const s = await spriteStyle();
  expect(s.backgroundPosition).toMatch(/-260px$/);
});

test('typing speed multiplier scales step distance', async () => {
  // Let any prior burst decay
  await petWindow.waitForTimeout(2500);

  const before = await getPetBounds();
  for (let i = 0; i < 2; i++) { await sendKey(); await petWindow.waitForTimeout(250); }
  await petWindow.waitForTimeout(200);
  const slowEnd = await getPetBounds();
  const slowDelta = Math.abs(slowEnd.x - before.x);

  await petWindow.waitForTimeout(2500);
  const fastStart = await getPetBounds();
  for (let i = 0; i < 25; i++) { await sendKey(); await petWindow.waitForTimeout(30); }
  await petWindow.waitForTimeout(150);
  const fastEnd = await getPetBounds();
  const fastDelta = Math.abs(fastEnd.x - fastStart.x);

  expect(fastDelta).toBeGreaterThan(slowDelta);
});

test('after typing stops the pet returns to idle row', async () => {
  await sendKey(); await sendKey(); await sendKey();
  await petWindow.waitForTimeout(200);
  await petWindow.waitForTimeout(1200);
  const s = await spriteStyle();
  expect(s.backgroundPosition).toMatch(/^0px\s+0px$/);
});

test('window stays clamped inside the work area on long bursts', async () => {
  const beforeBounds = await getPetBounds();
  const display = await app.evaluate(({ screen }) => screen.getPrimaryDisplay().workArea);

  const start = Date.now();
  while (Date.now() - start < 1800) {
    await sendKey();
    await petWindow.waitForTimeout(15);
  }
  await petWindow.waitForTimeout(200);

  const after = await getPetBounds();
  expect(after.x).toBeGreaterThanOrEqual(display.x);
  expect(after.x + after.width).toBeLessThanOrEqual(display.x + display.width);
  expect(after.x).not.toBe(beforeBounds.x);
});

test('settings window opens, lists both themes, switches active theme', async () => {
  const settingsWin = await openSettings();
  await settingsWin.waitForSelector('.theme-card');

  const cards = settingsWin.locator('.theme-card');
  await expect(cards).toHaveCount(2);

  const initiallySelected = await settingsWin
    .locator('.theme-card.selected .name')
    .textContent();
  expect(initiallySelected?.trim()).toBe('Coding Pup');

  await settingsWin.getByText('Sowai').click();
  await expect(settingsWin.locator('.theme-card.selected .name')).toHaveText('Sowai');

  await petWindow.waitForFunction(() => {
    const el = document.getElementById('pet-sprite');
    return !!el && getComputedStyle(el).backgroundImage.includes('sowai');
  }, { timeout: 5_000 });

  const bounds = await getPetBounds();
  expect(bounds.width).toBe(160);
  expect(bounds.height).toBe(130);

  await settingsWin.close();
});

test('reset position centers the pet near the bottom of the work area', async () => {
  await app.evaluate(({ BrowserWindow, screen }) => {
    const w = BrowserWindow.getAllWindows()[0];
    const wa = screen.getPrimaryDisplay().workArea;
    const b = w.getBounds();
    w.setBounds({ x: wa.x + 10, y: wa.y + 10, width: b.width, height: b.height });
  });
  const moved = await getPetBounds();

  const settingsWin = await openSettings();
  await settingsWin.getByText('Reset pet position').click();
  await petWindow.waitForTimeout(300);

  const after = await getPetBounds();
  const display = await app.evaluate(({ screen }) => screen.getPrimaryDisplay().workArea);
  // Reset should center horizontally and drop the pet to the lower half of the
  // work area. Exact y depends on macOS dock + menu bar and may differ between
  // the spec's screen lookup and the main handler's, so accept a generous band.
  const expectedX = Math.round(display.x + display.width / 2 - after.width / 2);
  expect(Math.abs(after.x - expectedX)).toBeLessThanOrEqual(2);
  expect(after.y).toBeGreaterThan(moved.y + 100);
  expect(after.y + after.height).toBeLessThanOrEqual(display.y + display.height);

  await settingsWin.close();
});

test('auto-launch toggle is persisted and reflected by Electron', async () => {
  const settingsWin = await openSettings();

  const checkbox = settingsWin.locator('#auto-launch');
  await expect(checkbox).not.toBeChecked();

  await checkbox.check();
  await petWindow.waitForTimeout(150);
  const after = await app.evaluate(({ app: electronApp }) => electronApp.getLoginItemSettings());
  expect(after.openAtLogin).toBe(true);

  await checkbox.uncheck();
  await petWindow.waitForTimeout(150);
  const cleared = await app.evaluate(({ app: electronApp }) => electronApp.getLoginItemSettings());
  expect(cleared.openAtLogin).toBe(false);

  await settingsWin.close();
});
