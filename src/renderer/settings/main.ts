import type { ThemeAssets, ThemeMeta } from '@shared/theme-types';
import type { AppSettings, PetSize } from '@shared/settings-schema';

const PREVIEW_W = 72;
const REACTION_PREVIEW_W = 84;

const themeListEl = document.getElementById('theme-list') as HTMLDivElement;
const reactionListEl = document.getElementById('reaction-list') as HTMLDivElement;
const autoLaunchEl = document.getElementById('auto-launch') as HTMLInputElement;
const resetBtn = document.getElementById('reset-position') as HTMLButtonElement;
const sizeRadios = Array.from(
  document.querySelectorAll<HTMLInputElement>('input[name="pet-size"]')
);

let settings: AppSettings;
let themes: ThemeAssets[] = [];

function activeTheme(): ThemeAssets | null {
  return themes.find(t => t.meta.id === settings.activeThemeId) ?? themes[0] ?? null;
}

function spritePreview(t: ThemeAssets, width: number, row: number, col: number = 0): HTMLDivElement {
  const m = t.meta;
  const height = Math.round(m.frameHeight * (width / m.frameWidth));
  const el = document.createElement('div');
  el.className = 'sprite-preview';
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.style.backgroundImage = `url("${t.spritesheetUrl}")`;
  el.style.backgroundSize = `${m.columns * width}px ${m.rows * height}px`;
  el.style.backgroundPosition = `-${col * width}px -${row * height}px`;
  el.style.backgroundRepeat = 'no-repeat';
  el.style.imageRendering = 'pixelated';
  return el;
}

function renderThemes() {
  themeListEl.innerHTML = '';
  for (const t of themes) {
    const m = t.meta;
    const card = document.createElement('div');
    card.className = 'theme-card' + (m.id === settings.activeThemeId ? ' selected' : '');
    card.appendChild(spritePreview(t, PREVIEW_W, m.idleRow));

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = m.displayName;
    card.appendChild(name);

    card.addEventListener('click', async () => {
      settings = await window.settingsAPI.setSettings({ activeThemeId: m.id });
      renderThemes();
      renderReactions();
    });
    themeListEl.appendChild(card);
  }
}

function renderSize() {
  for (const r of sizeRadios) {
    r.checked = r.value === settings.petSize;
  }
}

interface PreviewFrame { row: number; col: number; }

interface Reaction {
  title: string;
  trigger: string;
  /** Returns the row+col to use as the static preview thumbnail. */
  preview(m: ThemeMeta): PreviewFrame;
}

const REACTIONS: Reaction[] = [
  // idle: first cell of the loaf row
  { title: '기본 자세', trigger: '아무 입력도 없을 때',
    preview: (m) => ({ row: m.idleRow, col: 0 }) },

  // walk: middle frame of the second walk row (mid-stride, clearly walking)
  { title: '걷기', trigger: '타자를 치면',
    preview: (m) => ({ row: m.walkRows[m.walkRows.length - 1], col: 2 }) },

  // hover: the larger forward-staring pose lives on the second hover row
  { title: '쳐다보기', trigger: '마우스를 올리면',
    preview: (m) => ({ row: m.hoverRows[m.hoverRows.length - 1], col: 0 }) },

  // cry: a mid-cycle cell of the cry row reads as "actually crying"
  { title: '우는 표정', trigger: '펫을 더블클릭하면',
    preview: (m) => ({ row: m.cryRow, col: 4 }) },

  { title: '클릭 반응', trigger: '펫을 한 번 클릭하면',
    preview: (m) => ({ row: m.clickRow, col: 2 }) },

  // sleep: later cell so the eyes-closed frame is more likely
  { title: '잠자기', trigger: '1분 동안 가만히 두면',
    preview: (m) => ({ row: m.sleepRow, col: 4 }) },

  // question + call share the same row (callRow == questionRow), so collapse
  // them into one card with a combined trigger label.
  { title: '갸우뚱 (물음표·이름 부르기)',
    trigger: '타이핑 중 ?를 치거나 펫 이름을 부르면',
    preview: (m) => ({ row: m.callRow, col: 2 }) }
];

function renderReactions() {
  reactionListEl.innerHTML = '';
  const t = activeTheme();
  if (!t) return;
  const m = t.meta;
  for (const r of REACTIONS) {
    const card = document.createElement('div');
    card.className = 'reaction-card';
    const { row, col } = r.preview(m);
    card.appendChild(spritePreview(t, REACTION_PREVIEW_W, row, col));

    const body = document.createElement('div');
    body.className = 'reaction-body';

    const title = document.createElement('div');
    title.className = 'reaction-title';
    title.textContent = r.title;
    body.appendChild(title);

    const trig = document.createElement('div');
    trig.className = 'reaction-trigger';
    trig.textContent = r.trigger;
    body.appendChild(trig);

    card.appendChild(body);
    reactionListEl.appendChild(card);
  }
}

async function init() {
  [settings, themes] = await Promise.all([
    window.settingsAPI.getSettings(),
    window.settingsAPI.listThemes()
  ]);
  autoLaunchEl.checked = settings.autoLaunch;
  renderSize();
  renderThemes();
  renderReactions();
}

autoLaunchEl.addEventListener('change', async () => {
  settings = await window.settingsAPI.setSettings({ autoLaunch: autoLaunchEl.checked });
});

resetBtn.addEventListener('click', async () => {
  await window.settingsAPI.resetPosition();
});

for (const r of sizeRadios) {
  r.addEventListener('change', async () => {
    if (!r.checked) return;
    settings = await window.settingsAPI.setSettings({ petSize: r.value as PetSize });
  });
}

init();
