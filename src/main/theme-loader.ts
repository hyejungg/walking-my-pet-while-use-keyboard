import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ThemeAssets, ThemeMeta } from '@shared/theme-types';

const NUMBER_FIELDS: Array<keyof ThemeMeta> = [
  'frameWidth', 'frameHeight', 'columns', 'rows',
  'idleRow', 'idleColumns', 'walkRow', 'walkColumns',
  'cryRow', 'cryColumns', 'cryDurationMs',
  'hoverRow', 'hoverColumns',
  'sleepRow', 'sleepColumns',
  'fps', 'stepPx', 'renderWidth', 'renderHeight'
];

function parseMeta(file: string): ThemeMeta | null {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf-8'));
    if (
      typeof parsed.id !== 'string' ||
      typeof parsed.displayName !== 'string' ||
      typeof parsed.description !== 'string' ||
      typeof parsed.spritesheetPath !== 'string'
    ) return null;
    for (const f of NUMBER_FIELDS) {
      if (typeof parsed[f] !== 'number' || !Number.isFinite(parsed[f])) return null;
    }
    return parsed as ThemeMeta;
  } catch {
    return null;
  }
}

export function loadThemes(rootDir: string): ThemeAssets[] {
  if (!existsSync(rootDir)) return [];
  const entries = readdirSync(rootDir);
  const themes: ThemeAssets[] = [];

  for (const name of entries) {
    const dir = join(rootDir, name);
    if (!statSync(dir).isDirectory()) continue;

    const metaPath = join(dir, 'pet.json');
    if (!existsSync(metaPath)) continue;

    const meta = parseMeta(metaPath);
    if (!meta) continue;

    const sheetPath = join(dir, meta.spritesheetPath);
    if (!existsSync(sheetPath)) continue;

    themes.push({
      meta,
      spritesheetUrl: pathToFileURL(resolve(sheetPath)).href
    });
  }

  themes.sort((a, b) => a.meta.id.localeCompare(b.meta.id));
  return themes;
}
