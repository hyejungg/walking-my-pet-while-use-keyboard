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

function spritePreview(t: ThemeAssets, width: number, row: number): HTMLDivElement {
  const m = t.meta;
  const height = Math.round(m.frameHeight * (width / m.frameWidth));
  // Match the runtime crop so the preview shows the same region the live pet
  // does. Keep in sync with VISIBLE_FRACTION in renderer/pet/main.ts.
  const visibleW = Math.round(width * 0.75);
  const el = document.createElement('div');
  el.className = 'sprite-preview';
  el.style.width = `${visibleW}px`;
  el.style.height = `${height}px`;
  el.style.backgroundImage = `url("${t.spritesheetUrl}")`;
  el.style.backgroundSize = `${m.columns * width}px ${m.rows * height}px`;
  el.style.backgroundPosition = `0px -${row * height}px`;
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

interface Reaction {
  title: string;
  trigger: string;
  rowKey: keyof Pick<
    ThemeMeta,
    'idleRow' | 'walkRow' | 'cryRow' | 'hoverRow' | 'sleepRow'
  >;
}

const REACTIONS: Reaction[] = [
  { title: '기본 자세', trigger: '아무 입력도 없을 때', rowKey: 'idleRow' },
  { title: '걷기', trigger: '타자를 치면', rowKey: 'walkRow' },
  { title: '우는 표정', trigger: '펫을 더블클릭하면', rowKey: 'cryRow' },
  { title: '쳐다보기', trigger: '마우스를 올리면', rowKey: 'hoverRow' },
  { title: '잠자기', trigger: '밤(22시–6시)에', rowKey: 'sleepRow' }
];

function renderReactions() {
  reactionListEl.innerHTML = '';
  const t = activeTheme();
  if (!t) return;
  const m = t.meta;
  for (const r of REACTIONS) {
    const card = document.createElement('div');
    card.className = 'reaction-card';
    card.appendChild(spritePreview(t, REACTION_PREVIEW_W, m[r.rowKey]));

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
