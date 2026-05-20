import { Tray, Menu, nativeImage, app } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

let tray: Tray | null = null;

export function createTray(onOpenSettings: () => void): Tray {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'tray-icon.png')
    : join(__dirname, '../../resources/tray-icon.png');

  const image = nativeImage.createFromPath(iconPath);
  if (process.platform === 'darwin') image.setTemplateImage(true);

  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip('Walking Pet');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Settings…', click: onOpenSettings },
    { type: 'separator' },
    { label: 'Quit', role: 'quit' }
  ]));
  return tray;
}
