import type { ThemeAssets } from '@shared/theme-types';
import type { AppSettings } from '@shared/settings-schema';

const themeListEl = document.getElementById('theme-list') as HTMLDivElement;
const autoLaunchEl = document.getElementById('auto-launch') as HTMLInputElement;
const resetBtn = document.getElementById('reset-position') as HTMLButtonElement;

let settings: AppSettings;
let themes: ThemeAssets[] = [];

function renderThemes() {
  themeListEl.innerHTML = '';
  for (const t of themes) {
    const m = t.meta;
    const card = document.createElement('div');
    card.className = 'theme-card' + (m.id === settings.activeThemeId ? ' selected' : '');
    const preview = document.createElement('div');
    preview.className = 'theme-preview';
    preview.style.width = `${m.renderWidth}px`;
    preview.style.height = `${m.renderHeight}px`;
    preview.style.backgroundImage = `url("${t.spritesheetUrl}")`;
    preview.style.backgroundSize = `${m.columns * m.renderWidth}px ${m.rows * m.renderHeight}px`;
    preview.style.backgroundPosition = `0px -${m.idleRow * m.renderHeight}px`;
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

async function init() {
  [settings, themes] = await Promise.all([
    window.settingsAPI.getSettings(),
    window.settingsAPI.listThemes()
  ]);
  autoLaunchEl.checked = settings.autoLaunch;
  renderThemes();
}

autoLaunchEl.addEventListener('change', async () => {
  settings = await window.settingsAPI.setSettings({ autoLaunch: autoLaunchEl.checked });
});

resetBtn.addEventListener('click', async () => {
  await window.settingsAPI.resetPosition();
});

init();
