import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadThemes } from '../src/main/theme-loader';

function writeMeta(dir: string, patch: Partial<Record<string, unknown>> = {}) {
  writeFileSync(join(dir, 'pet.json'), JSON.stringify({
    id: 'sample',
    displayName: 'Sample',
    description: 'd',
    spritesheetPath: 'spritesheet.webp',
    frameWidth: 256,
    frameHeight: 208,
    columns: 6,
    rows: 9,
    idleRow: 0,
    idleColumns: 1,
    walkRows: [1, 2],
    walkColumns: 8,
    cryRow: 5,
    cryColumns: 8,
    cryDurationMs: 1500,
    hoverRows: [3, 4],
    hoverColumns: 8,
    sleepRow: 6,
    sleepColumns: 6,
    clickRow: 7,
    clickColumns: 8,
    clickDurationMs: 1000,
    questionRow: 8,
    questionColumns: 8,
    questionDurationMs: 1000,
    callKeycodes: [34, 24, 20, 31, 38, 30, 32, 37],
    callRow: 4,
    callColumns: 1,
    callDurationMs: 2000,
    fps: 8,
    stepPx: 4,
    renderWidth: 128,
    renderHeight: 104,
    ...patch
  }));
}

describe('theme-loader', () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'pet-themes-'));

    const ok = join(root, 'sample');
    mkdirSync(ok, { recursive: true });
    writeMeta(ok);
    writeFileSync(join(ok, 'spritesheet.webp'), 'fakedata');

    // missing spritesheet file
    const noSheet = join(root, 'no-sheet');
    mkdirSync(noSheet, { recursive: true });
    writeMeta(noSheet, { id: 'no-sheet' });

    // invalid meta (missing required field)
    const badMeta = join(root, 'bad-meta');
    mkdirSync(badMeta, { recursive: true });
    writeFileSync(join(badMeta, 'pet.json'), JSON.stringify({ id: 'bad-meta' }));
    writeFileSync(join(badMeta, 'spritesheet.webp'), 'fake');

    // unrelated file
    writeFileSync(join(root, 'README.txt'), 'hi');
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('returns valid themes sorted by id with absolute file:// URL', () => {
    const themes = loadThemes(root);
    expect(themes).toHaveLength(1);
    const t = themes[0];
    expect(t.meta.id).toBe('sample');
    expect(t.meta.frameWidth).toBe(256);
    expect(t.meta.walkColumns).toBe(8);
    expect(t.meta.walkRows).toEqual([1, 2]);
    expect(t.meta.clickRow).toBe(7);
    expect(t.meta.questionRow).toBe(8);
    expect(t.spritesheetUrl.startsWith('file://')).toBe(true);
    expect(t.spritesheetUrl.endsWith('/sample/spritesheet.webp')).toBe(true);
  });

  it('skips themes whose spritesheet file is missing', () => {
    const themes = loadThemes(root);
    expect(themes.find(t => t.meta.id === 'no-sheet')).toBeUndefined();
  });

  it('skips themes with invalid pet.json', () => {
    const themes = loadThemes(root);
    expect(themes.find(t => t.meta.id === 'bad-meta')).toBeUndefined();
  });
});
