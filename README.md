# Walking Pet

A tiny desktop pet that walks across your screen while you type, and sits idle when your keyboard is quiet. Works on macOS and Windows.

## Features

- Transparent always-on-top widget you can drag anywhere
- Pluggable themes (currently `sowai` and `coding-pup`; drop more folders into `themes/`)
- Typing-speed scaling: walk speed ramps from 1× at slow typing up to ~3× when you're hammering the keyboard
- Auto-launch on OS login (toggle in Settings)
- Position and active theme persist across restarts

## Themes

Drop a folder under `themes/<id>/` with two files:

```
themes/
  my-theme/
    pet.json
    spritesheet.webp     # uniform grid (columns × rows), alpha channel preserved
```

`pet.json` schema:

```json
{
  "id": "my-theme",
  "displayName": "My Theme",
  "description": "...",
  "spritesheetPath": "spritesheet.webp",
  "frameWidth": 256,
  "frameHeight": 208,
  "columns": 6,
  "rows": 9,
  "idleRow": 0,
  "idleColumns": 1,
  "walkRow": 2,
  "walkColumns": 6,
  "fps": 8,
  "stepPx": 6,
  "renderWidth": 160,
  "renderHeight": 130
}
```

- `idleColumns: 1` means a single static idle frame; bump it for animated idle.
- `stepPx` is the base pixels per step at typing rate 1 KPS; it scales up to ~3× with fast typing.
- `renderWidth/Height` is what the pet looks like on screen — sprite cells are scaled to fit.

## Development

```
npm install
npm run dev
```

macOS first-run: grant the app **Accessibility** permission (System Settings → Privacy & Security → Accessibility) so global key events can be observed.

## Installing a downloaded build

### macOS

The macOS `.dmg` is **not code-signed or notarized**, so when you open it on a Mac other than the one that built it, macOS may say the app is *"damaged and can't be opened"* or *"can't be opened because Apple cannot check it for malicious software"*. The app is fine — this is Gatekeeper blocking the unsigned bundle. Use either workaround:

1. **Right-click to open** — drag the app to `/Applications`, then right-click (or Control-click) it → **Open** → **Open** in the dialog. If macOS still refuses, use option 2.
2. **Remove the quarantine flag** — run this once in Terminal after copying the app to `/Applications`:

   ```bash
   xattr -dr com.apple.quarantine "/Applications/Walking Pet.app"
   ```

On first run, grant **Accessibility** permission (System Settings → Privacy & Security → Accessibility) so global key events can be observed.

## Build

- macOS: `npm run dist:mac`
- Windows: `npm run dist:win` (run on Windows)

Outputs land in `dist/`.

## Tests

```
npm run test
```

Vitest suite: 24 tests across 5 files (`tests/auto-launch.test.ts`, `tests/pet-controller.test.ts`, `tests/pet-sprite.test.ts`, `tests/store.test.ts`, `tests/theme-loader.test.ts`).
