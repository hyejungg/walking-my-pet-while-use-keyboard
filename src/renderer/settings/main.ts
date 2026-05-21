import type { ThemeAssets } from '@shared/theme-types';
import type { AppSettings, PetSize } from '@shared/settings-schema';

const PREVIEW_W = 96;

const themeListEl = document.getElementById('theme-list') as HTMLDivElement;
const autoLaunchEl = document.getElementById('auto-launch') as HTMLInputElement;
const resetBtn = document.getElementById('reset-position') as HTMLButtonElement;
const sizeRadios = Array.from(
  document.querySelectorAll<HTMLInputElement>('input[name="pet-size"]')
);

let settings: AppSettings;
let themes: ThemeAssets[] = [];

function renderThemes() {
  themeListEl.innerHTML = '';
  for (const t of themes) {
    const m = t.meta;
    // Scale every preview to a fixed width while preserving the frame ratio
    // so cards line up regardless of the theme's native frame size.
    const previewW = PREVIEW_W;
    const previewH = Math.round(m.frameHeight * (previewW / m.frameWidth));

    const card = document.createElement('div');
    card.className = 'theme-card' + (m.id === settings.activeThemeId ? ' selected' : '');
    const preview = document.createElement('div');
    preview.className = 'theme-preview';
    preview.style.width = `${previewW}px`;
    preview.style.height = `${previewH}px`;
    preview.style.backgroundImage = `url("${t.spritesheetUrl}")`;
    preview.style.backgroundSize = `${m.columns * previewW}px ${m.rows * previewH}px`;
    preview.style.backgroundPosition = `0px -${m.idleRow * previewH}px`;
    preview.style.backgroundRepeat = 'no-repeat';
    preview.style.imageRendering = 'pixelated';

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = m.displayName;

    card.appendChild(preview);
    card.appendChild(name);
    card.addEventListener('click', async () => {
      settings = await window.settingsAPI.setSettings({ activeThemeId: m.id });
      renderThemes();
    });
    themeListEl.appendChild(card);
  }
}

function renderSize() {
  for (const r of sizeRadios) {
    r.checked = r.value === settings.petSize;
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
