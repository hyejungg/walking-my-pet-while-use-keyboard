# Walking Pet Electron App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 키보드 입력이 있을 때는 데스크탑 위에서 걸어다니고, 입력이 없을 때는 가만히 앉아 있는 작은 펫 위젯 Electron 앱을 macOS·Windows에서 모두 동작하도록 구현한다. 3가지 테마를 설정 화면에서 전환 가능하며, OS 로그인 시 자동 실행을 지원한다.

**Architecture:**
- Electron + TypeScript + electron-vite. 메인 프로세스가 전역 키 후크(uiohook-napi)를 받아 IPC로 렌더러에 신호를 전달하고, 렌더러의 `PetController` 상태머신이 `walk`/`idle` 전환과 위치 이동을 결정한다.
- 펫 윈도우는 frameless·transparent·alwaysOnTop의 작은 위젯이며, 마우스 드래그로 이동·키 입력 시 자동으로 가로 방향 이동(메인 프로세스가 `setBounds`).
- 타자 속도(KPS)에 따라 `speedMultiplier`(1.0~3.0)가 결정되고, 한 스텝당 이동 픽셀(`stepPx`)과 스프라이트 fps가 동시에 곱해진다. `setBounds` 호출 빈도(`intervalMs`)는 고정이라 부하는 일정.
- 설정·자동 시작·테마 메타·창 위치는 `electron-store`에 영속화. 테마 에셋은 `themes/<id>/{pet.json, spritesheet.webp}` 규약. 시트는 균등 그리드(예: 6 cols × 9 rows × 256×208) 가정이며 `pet.json`에 그리드/행 인덱스/fps/stepPx를 명시. CSS `background-position` 단계 이동으로 프레임 인덱싱.

**Tech Stack:**
- Electron 31+, TypeScript, electron-vite, vitest, uiohook-napi, electron-store, electron-builder
- 렌더러는 Vanilla TS + CSS (펫 위젯과 설정 폼 모두 경량). Sprite sheet는 WebP 그대로 (Chromium 기본 지원, 알파 채널 보존)
- 패키징: macOS `.dmg`, Windows NSIS `.exe`

---

## File Structure

```
walking-my-pet-while-use-keyboard/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── electron.vite.config.ts
├── electron-builder.yml
├── vitest.config.ts
├── resources/
│   └── icon.png                    # 트레이/앱 아이콘
├── themes/                         # extraResources로 번들링 (사용자가 image/ 에서 복사)
│   ├── sowai/
│   │   ├── pet.json                # ThemeMeta 전체 (아래 Task 3 참고)
│   │   └── spritesheet.webp        # 1536×1872, 6 cols × 9 rows, frame 256×208
│   └── coding-pup/
│       ├── pet.json
│       └── spritesheet.webp
# 3번째 테마는 폴더만 추가하면 자동 인식
├── src/
│   ├── shared/
│   │   ├── ipc-channels.ts         # IPC 채널 상수
│   │   ├── settings-schema.ts      # electron-store 스키마/타입
│   │   └── theme-types.ts          # ThemeMeta 등 공유 타입
│   ├── main/
│   │   ├── index.ts                # 메인 엔트리(앱 라이프사이클, 윈도우 조립)
│   │   ├── pet-window.ts           # 펫 윈도우 생성/이동
│   │   ├── settings-window.ts      # 설정 윈도우 생성/표시
│   │   ├── tray.ts                 # 시스템 트레이
│   │   ├── store.ts                # electron-store 래퍼
│   │   ├── theme-loader.ts         # themes/ 폴더 스캔
│   │   ├── key-hook.ts             # uiohook-napi 래퍼 + EventEmitter
│   │   ├── auto-launch.ts          # setLoginItemSettings 래퍼
│   │   └── ipc.ts                  # IPC 핸들러 등록
│   ├── preload/
│   │   ├── pet.ts                  # 펫 윈도우용 contextBridge
│   │   └── settings.ts             # 설정 윈도우용 contextBridge
│   └── renderer/
│       ├── pet/
│       │   ├── index.html
│       │   ├── main.ts
│       │   ├── pet-sprite.ts       # 스프라이트 시퀀스 애니메이션
│       │   ├── pet-controller.ts   # idle/walk 상태머신
│       │   └── styles.css
│       └── settings/
│           ├── index.html
│           ├── main.ts
│           └── styles.css
└── tests/
    ├── store.test.ts
    ├── theme-loader.test.ts
    ├── pet-sprite.test.ts
    ├── pet-controller.test.ts
    └── auto-launch.test.ts
```

각 파일 책임:
- `pet-controller.ts`: 순수 로직(키 입력 이벤트 → idle/walk/direction/x좌표). 테스트 가능.
- `pet-sprite.ts`: DOM과 분리된 프레임 인덱서 + 렌더 콜백. 테스트 가능.
- `key-hook.ts`, `pet-window.ts` 등 Electron API 의존 모듈은 thin wrapper로 두고 수동 검증.

---

## Task 1: 프로젝트 초기화 및 Electron 부트스트랩

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `electron.vite.config.ts`
- Create: `vitest.config.ts`
- Create: `src/main/index.ts`
- Create: `src/preload/pet.ts`
- Create: `src/renderer/pet/index.html`
- Create: `src/renderer/pet/main.ts`

- [ ] **Step 1: `package.json` 작성**

```json
{
  "name": "walking-pet",
  "version": "0.1.0",
  "description": "A tiny desktop pet that walks while you type",
  "main": "out/main/index.js",
  "type": "module",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "start": "electron-vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json",
    "pack": "electron-vite build && electron-builder --dir",
    "dist:mac": "electron-vite build && electron-builder --mac",
    "dist:win": "electron-vite build && electron-builder --win"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "electron": "^31.0.0",
    "electron-builder": "^24.13.0",
    "electron-vite": "^2.3.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  },
  "dependencies": {
    "electron-store": "^10.0.0",
    "uiohook-napi": "^1.5.4"
  }
}
```

- [ ] **Step 2: `tsconfig.json` 작성 (렌더러/공유용)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "jsx": "preserve",
    "types": ["node", "vitest/globals"],
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"]
    }
  },
  "include": ["src/renderer", "src/shared", "src/preload", "tests"]
}
```

- [ ] **Step 3: `tsconfig.node.json` 작성 (main 프로세스용)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "types": ["node"],
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"]
    }
  },
  "include": ["src/main", "src/shared", "electron.vite.config.ts"]
}
```

- [ ] **Step 4: `electron.vite.config.ts` 작성**

```ts
import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } },
    build: { outDir: 'out/main', rollupOptions: { input: resolve('src/main/index.ts') } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } },
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: {
          pet: resolve('src/preload/pet.ts')
        }
      }
    }
  },
  renderer: {
    resolve: { alias: { '@shared': resolve('src/shared') } },
    root: 'src/renderer',
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: {
          pet: resolve('src/renderer/pet/index.html')
        }
      }
    }
  }
});
```

- [ ] **Step 5: `vitest.config.ts` 작성**

```ts
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@shared': resolve('src/shared') } },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
```

- [ ] **Step 6: 최소 메인 프로세스 `src/main/index.ts` 작성**

```ts
import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function createPetWindow() {
  const win = new BrowserWindow({
    width: 200,
    height: 200,
    webPreferences: {
      preload: join(__dirname, '../preload/pet.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/pet/index.html`);
  } else {
    win.loadFile(join(__dirname, '../renderer/pet/index.html'));
  }
}

app.whenReady().then(() => {
  createPetWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createPetWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 7: 최소 preload `src/preload/pet.ts` 작성**

```ts
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('petAPI', {
  ping: () => 'pong'
});
```

- [ ] **Step 8: 최소 렌더러 `src/renderer/pet/index.html` 작성**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Walking Pet</title>
  </head>
  <body>
    <div id="root">hello pet</div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 9: 최소 렌더러 `src/renderer/pet/main.ts` 작성**

```ts
console.log('pet renderer booted', (window as any).petAPI?.ping?.());
```

- [ ] **Step 10: 의존성 설치 및 실행 검증**

```bash
npm install
npm run typecheck
npm run dev
```

Expected: Electron 윈도우가 열리고 흰 배경에 "hello pet" 글자가 표시됨. 콘솔(DevTools)에 `pet renderer booted pong` 로그.

- [ ] **Step 11: 빌드 산출물 `.gitignore`에 추가**

기존 `.gitignore` 끝에 다음을 추가:

```
out/
dist/
node_modules/
.vite/
.DS_Store
```

(이미 포함되어 있으면 중복 추가하지 말 것)

- [ ] **Step 12: 커밋**

```bash
git add package.json tsconfig.json tsconfig.node.json electron.vite.config.ts vitest.config.ts src/ .gitignore
git commit -m "chore: bootstrap electron-vite scaffold with empty pet window"
```

---

## Task 2: 펫 윈도우를 투명·항상위·프레임리스 위젯으로 변경

**Files:**
- Modify: `src/main/index.ts`
- Create: `src/main/pet-window.ts`
- Modify: `src/renderer/pet/index.html`
- Create: `src/renderer/pet/styles.css`
- Modify: `src/renderer/pet/main.ts`

- [ ] **Step 1: 펫 윈도우 생성을 모듈로 분리하고 옵션 적용 — `src/main/pet-window.ts`**

```ts
import { BrowserWindow, screen } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface PetWindowOptions {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export function createPetWindow(opts: PetWindowOptions): BrowserWindow {
  const display = screen.getPrimaryDisplay().workArea;
  const x = opts.x ?? display.x + display.width / 2 - opts.width / 2;
  const y = opts.y ?? display.y + display.height - opts.height - 80;

  const win = new BrowserWindow({
    width: opts.width,
    height: opts.height,
    x: Math.round(x),
    y: Math.round(y),
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/pet.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/pet/index.html`);
  } else {
    win.loadFile(join(__dirname, '../renderer/pet/index.html'));
  }

  win.once('ready-to-show', () => win.show());
  return win;
}
```

- [ ] **Step 2: 메인 엔트리에서 새 모듈 사용하도록 정리 — `src/main/index.ts`**

```ts
import { app, BrowserWindow } from 'electron';
import { createPetWindow } from './pet-window.js';

let petWindow: BrowserWindow | null = null;

app.whenReady().then(() => {
  petWindow = createPetWindow({ width: 160, height: 160 });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      petWindow = createPetWindow({ width: 160, height: 160 });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 3: 렌더러 HTML/CSS로 투명 배경 + 드래그 가능 영역 만들기**

`src/renderer/pet/index.html`:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Walking Pet</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <div id="pet" class="pet">
      <div id="pet-sprite" class="pet-sprite"></div>
    </div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

`src/renderer/pet/styles.css`:

```css
html, body {
  margin: 0;
  padding: 0;
  background: transparent;
  overflow: hidden;
  width: 100%;
  height: 100%;
  cursor: grab;
}

.pet {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-app-region: drag;
  user-select: none;
}

.pet-sprite {
  width: 96px;
  height: 96px;
  background: rgba(255, 200, 200, 0.6);
  border: 2px dashed rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  -webkit-app-region: drag;
}
```

(분홍색 placeholder 박스는 이후 task에서 실제 스프라이트로 교체)

- [ ] **Step 4: `src/renderer/pet/main.ts`는 일단 그대로 부팅 로그만 출력**

```ts
console.log('pet renderer booted');
```

- [ ] **Step 5: 실행 후 수동 확인**

```bash
npm run dev
```

Expected:
- 데스크탑 오른쪽 하단 부근에 작은 분홍 점선 박스 위젯이 떠 있음
- 다른 윈도우 위로 항상 표시됨
- 위젯을 드래그하면 자유롭게 이동 가능
- 작업표시줄/Dock에는 표시되지 않음 (macOS는 Dock에는 보일 수 있음 — Task 10에서 LSUIElement로 보정)

- [ ] **Step 6: 커밋**

```bash
git add src/main/pet-window.ts src/main/index.ts src/renderer/pet/
git commit -m "feat(pet-window): make pet a transparent, always-on-top, draggable widget"
```

---

## Task 3: 공유 타입 및 IPC 채널 상수 정의

**Files:**
- Create: `src/shared/ipc-channels.ts`
- Create: `src/shared/theme-types.ts`
- Create: `src/shared/settings-schema.ts`

- [ ] **Step 1: IPC 채널 상수 — `src/shared/ipc-channels.ts`**

```ts
export const IPC = {
  KEY_TYPED: 'pet:key-typed',
  THEMES_LIST: 'pet:themes-list',
  THEME_GET_ACTIVE: 'pet:theme-get-active',
  THEME_SET_ACTIVE: 'pet:theme-set-active',
  SETTINGS_GET: 'pet:settings-get',
  SETTINGS_SET: 'pet:settings-set',
  PET_MOVE_BY: 'pet:move-by',
  PET_SET_SIZE: 'pet:set-size',
  PET_POSITION_RESET: 'pet:position-reset'
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
```

- [ ] **Step 2: 테마 타입 — `src/shared/theme-types.ts`**

```ts
export interface ThemeMeta {
  id: string;
  displayName: string;
  description: string;
  spritesheetPath: string;   // pet.json과 같은 폴더 안의 파일명 (예: "spritesheet.webp")
  frameWidth: number;        // 시트의 한 셀 폭 (px)
  frameHeight: number;       // 시트의 한 셀 높이 (px)
  columns: number;           // 그리드 열 수
  rows: number;              // 그리드 행 수
  idleRow: number;           // idle 애니메이션이 위치한 행 인덱스 (0-base)
  idleColumns: number;       // 해당 행에서 사용할 프레임 수 (≤ columns). 1이면 정지 이미지
  walkRow: number;           // walk 애니메이션이 위치한 행 인덱스
  walkColumns: number;       // 해당 행에서 사용할 프레임 수
  fps: number;               // 기준 fps (KPS 1배일 때)
  stepPx: number;            // 기준 stepPx (KPS 1배일 때 윈도우가 한 step에 움직이는 px)
  renderWidth: number;       // 화면에 표시할 폭 (frameWidth와 다를 수 있음 — 스케일 다운/업용)
  renderHeight: number;      // 화면에 표시할 높이
}

export interface ThemeAssets {
  meta: ThemeMeta;
  spritesheetUrl: string;    // file:// 절대 경로 (렌더러에서 background-image로 로드)
}
```

- [ ] **Step 3: 설정 스키마 — `src/shared/settings-schema.ts`**

```ts
export interface AppSettings {
  activeThemeId: string;
  autoLaunch: boolean;
  petPosition: { x: number; y: number } | null;
  idleTimeoutMs: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  activeThemeId: 'theme-1',
  autoLaunch: false,
  petPosition: null,
  idleTimeoutMs: 600
};
```

- [ ] **Step 4: 커밋**

```bash
git add src/shared/
git commit -m "feat(shared): add IPC channel constants and settings/theme types"
```

---

## Task 4: electron-store 래퍼 (TDD)

**Files:**
- Create: `src/main/store.ts`
- Create: `tests/store.test.ts`

- [ ] **Step 1: 테스트 작성 — `tests/store.test.ts`**

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@shared/settings-schema';

vi.mock('electron-store', () => {
  return {
    default: class MockStore<T> {
      private data: T;
      constructor(opts: { defaults: T }) {
        this.data = { ...opts.defaults };
      }
      get<K extends keyof T>(key: K): T[K] { return this.data[key]; }
      set<K extends keyof T>(key: K, val: T[K]): void { this.data[key] = val; }
      get store(): T { return this.data; }
      set store(v: T) { this.data = v; }
    }
  };
});

import { createSettingsStore } from '../src/main/store';

describe('settings store', () => {
  let store: ReturnType<typeof createSettingsStore>;
  beforeEach(() => { store = createSettingsStore(); });

  it('returns defaults when nothing is set', () => {
    expect(store.getAll()).toEqual(DEFAULT_SETTINGS);
  });

  it('persists individual fields', () => {
    store.set('activeThemeId', 'theme-2');
    expect(store.get('activeThemeId')).toBe('theme-2');
  });

  it('merges patches via update', () => {
    store.update({ autoLaunch: true, idleTimeoutMs: 800 });
    expect(store.get('autoLaunch')).toBe(true);
    expect(store.get('idleTimeoutMs')).toBe(800);
    expect(store.get('activeThemeId')).toBe(DEFAULT_SETTINGS.activeThemeId);
  });
});
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

```bash
npm run test -- tests/store.test.ts
```

Expected: FAIL — `createSettingsStore` 모듈을 찾을 수 없음.

- [ ] **Step 3: 구현 — `src/main/store.ts`**

```ts
import Store from 'electron-store';
import { AppSettings, DEFAULT_SETTINGS } from '@shared/settings-schema';

export function createSettingsStore() {
  const store = new Store<AppSettings>({
    name: 'walking-pet-settings',
    defaults: DEFAULT_SETTINGS
  });

  return {
    get<K extends keyof AppSettings>(key: K): AppSettings[K] {
      return store.get(key);
    },
    set<K extends keyof AppSettings>(key: K, val: AppSettings[K]): void {
      store.set(key, val);
    },
    update(patch: Partial<AppSettings>): void {
      store.store = { ...store.store, ...patch };
    },
    getAll(): AppSettings {
      return store.store;
    }
  };
}

export type SettingsStore = ReturnType<typeof createSettingsStore>;
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm run test -- tests/store.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/main/store.ts tests/store.test.ts
git commit -m "feat(store): add electron-store wrapper with typed settings"
```

---

## Task 5: 테마 폴더 스캐너 (TDD)

**Files:**
- Create: `src/main/theme-loader.ts`
- Create: `tests/theme-loader.test.ts`

각 테마 폴더는 `pet.json`(ThemeMeta JSON)과 `spritesheet.webp`(또는 meta가 지정한 파일) 두 개를 가진다. 로더는 폴더를 스캔해 둘이 모두 있고 메타가 유효한 경우만 통과시키고, 시트 절대 경로를 `spritesheetUrl`(file:// URL)로 환산해 반환한다.

- [ ] **Step 1: 테스트 작성 — `tests/theme-loader.test.ts`**

```ts
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
    walkRow: 2,
    walkColumns: 6,
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
    expect(t.meta.walkColumns).toBe(6);
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
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

```bash
npm run test -- tests/theme-loader.test.ts
```

Expected: FAIL — `loadThemes` 미구현.

- [ ] **Step 3: 구현 — `src/main/theme-loader.ts`**

```ts
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ThemeAssets, ThemeMeta } from '@shared/theme-types';

const NUMBER_FIELDS: Array<keyof ThemeMeta> = [
  'frameWidth', 'frameHeight', 'columns', 'rows',
  'idleRow', 'idleColumns', 'walkRow', 'walkColumns',
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
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm run test -- tests/theme-loader.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/main/theme-loader.ts tests/theme-loader.test.ts
git commit -m "feat(theme-loader): scan sprite-sheet themes and emit ThemeAssets list"
```

---

## Task 6: PetSprite — 스프라이트 시트 프레임 인덱서 (TDD)

**Files:**
- Create: `src/renderer/pet/pet-sprite.ts`
- Create: `tests/pet-sprite.test.ts`

`PetSprite`는 시트의 한 행(`row`)을 따라 `count`개의 프레임을 `fps` 속도로 순환하면서 `(col, row)` 인덱스를 콜백으로 알린다. 콜백 수신자(렌더러 main.ts)는 이 좌표를 `background-position: -(col * frameWidth)px -(row * frameHeight)px`로 변환해 DOM에 적용한다. DOM 의존 없음 → 단위 테스트 용이.

- [ ] **Step 1: 테스트 작성 — `tests/pet-sprite.test.ts`**

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { PetSprite } from '../src/renderer/pet/pet-sprite';

describe('PetSprite', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('emits frame indices at the specified fps cycling within a row', () => {
    const onFrame = vi.fn();
    const sprite = new PetSprite(onFrame);
    sprite.setRow({ row: 2, count: 3, fps: 10 }); // 100ms/frame
    sprite.start();

    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(onFrame).toHaveBeenLastCalledWith({ col: 0, row: 2 });

    vi.advanceTimersByTime(100);
    expect(onFrame).toHaveBeenLastCalledWith({ col: 1, row: 2 });

    vi.advanceTimersByTime(100);
    expect(onFrame).toHaveBeenLastCalledWith({ col: 2, row: 2 });

    vi.advanceTimersByTime(100);
    expect(onFrame).toHaveBeenLastCalledWith({ col: 0, row: 2 }); // wrap

    sprite.stop();
  });

  it('count=1 emits a single static frame and never advances', () => {
    const onFrame = vi.fn();
    const sprite = new PetSprite(onFrame);
    sprite.setRow({ row: 0, count: 1, fps: 8 });
    sprite.start();
    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(onFrame).toHaveBeenLastCalledWith({ col: 0, row: 0 });
    vi.advanceTimersByTime(1000);
    expect(onFrame).toHaveBeenCalledTimes(1);
    sprite.stop();
  });

  it('stop halts further emissions', () => {
    const onFrame = vi.fn();
    const sprite = new PetSprite(onFrame);
    sprite.setRow({ row: 1, count: 3, fps: 10 });
    sprite.start();
    onFrame.mockClear();
    sprite.stop();
    vi.advanceTimersByTime(1000);
    expect(onFrame).not.toHaveBeenCalled();
  });

  it('setRow while running switches sequence and resets col to 0', () => {
    const onFrame = vi.fn();
    const sprite = new PetSprite(onFrame);
    sprite.setRow({ row: 1, count: 3, fps: 10 });
    sprite.start();
    vi.advanceTimersByTime(100);
    onFrame.mockClear();

    sprite.setRow({ row: 4, count: 2, fps: 10 });
    expect(onFrame).toHaveBeenLastCalledWith({ col: 0, row: 4 });
    vi.advanceTimersByTime(100);
    expect(onFrame).toHaveBeenLastCalledWith({ col: 1, row: 4 });
    sprite.stop();
  });

  it('setFps changes interval without resetting col index', () => {
    const onFrame = vi.fn();
    const sprite = new PetSprite(onFrame);
    sprite.setRow({ row: 1, count: 3, fps: 10 }); // 100ms/frame
    sprite.start();
    vi.advanceTimersByTime(100);
    expect(onFrame).toHaveBeenLastCalledWith({ col: 1, row: 1 });

    sprite.setFps(20); // 50ms/frame
    onFrame.mockClear();
    vi.advanceTimersByTime(50);
    expect(onFrame).toHaveBeenLastCalledWith({ col: 2, row: 1 });
    sprite.stop();
  });

  it('setFps with same value is a no-op', () => {
    const onFrame = vi.fn();
    const sprite = new PetSprite(onFrame);
    sprite.setRow({ row: 0, count: 2, fps: 10 });
    sprite.start();
    sprite.setFps(10);
    onFrame.mockClear();
    vi.advanceTimersByTime(100);
    expect(onFrame).toHaveBeenCalledTimes(1);
    sprite.stop();
  });
});
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

```bash
npm run test -- tests/pet-sprite.test.ts
```

Expected: FAIL.

- [ ] **Step 3: 구현 — `src/renderer/pet/pet-sprite.ts`**

```ts
export interface SpriteRow {
  row: number;
  count: number;
  fps: number;
}

export interface FrameIndex {
  col: number;
  row: number;
}

export type FrameCallback = (frame: FrameIndex) => void;

export class PetSprite {
  private row = 0;
  private count = 1;
  private intervalMs = 125;
  private timer: ReturnType<typeof setInterval> | null = null;
  private col = 0;
  private running = false;

  constructor(private readonly onFrame: FrameCallback) {}

  setRow(opts: SpriteRow): void {
    this.row = opts.row;
    this.count = Math.max(1, opts.count);
    this.intervalMs = Math.max(1, Math.round(1000 / Math.max(1, opts.fps)));
    this.col = 0;
    if (this.running) {
      this.emitCurrent();
      this.restartTimer();
    }
  }

  setFps(fps: number): void {
    const next = Math.max(1, Math.round(1000 / Math.max(1, fps)));
    if (next === this.intervalMs) return;
    this.intervalMs = next;
    if (this.running) this.restartTimer();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.emitCurrent();
    this.restartTimer();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private restartTimer(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.count <= 1) {
      this.timer = null;
      return;
    }
    this.timer = setInterval(() => {
      this.col = (this.col + 1) % this.count;
      this.emitCurrent();
    }, this.intervalMs);
  }

  private emitCurrent(): void {
    this.onFrame({ col: this.col, row: this.row });
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm run test -- tests/pet-sprite.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/renderer/pet/pet-sprite.ts tests/pet-sprite.test.ts
git commit -m "feat(pet-sprite): index sprite-sheet rows with dynamic fps and static-frame support"
```

---

## Task 7: PetController — idle/walk 상태머신 + 타자 속도 반영 (TDD)

**Files:**
- Create: `src/renderer/pet/pet-controller.ts`
- Create: `tests/pet-controller.test.ts`

`PetController`는 키 입력 신호를 받아 상태(idle ↔ walk)를 전환하고, walk 동안 좌우 방향·이동 픽셀·스프라이트 속도를 결정하는 순수 로직이다. 최근 `rateWindowMs` 동안의 키 입력 수로 KPS(keys per second)를 계산해 `speedMultiplier`(1.0~3.0)를 만들고, 한 스텝당 `dx`와 sprite fps에 동일하게 곱한다. `intervalMs`(setBounds 호출 간격)는 고정.

매핑 규칙:
- KPS ≤ 1 → multiplier 1.0
- KPS ≥ 10 → multiplier 3.0
- 그 사이는 선형 보간 (`1 + (kps - 1) / 9 * 2`)

DOM이나 Electron API에 의존하지 않는다.

- [ ] **Step 1: 테스트 작성 — `tests/pet-controller.test.ts`**

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { PetController } from '../src/renderer/pet/pet-controller';

const defaults = {
  idleTimeoutMs: 500,
  baseStepPx: 4,
  intervalMs: 100,
  rateWindowMs: 2000,
  minMultiplier: 1.0,
  maxMultiplier: 3.0
};

describe('PetController', () => {
  beforeEach(() => vi.useFakeTimers({ now: 0 }));
  afterEach(() => vi.useRealTimers());

  it('starts idle facing right', () => {
    const c = new PetController(defaults);
    expect(c.state).toBe('idle');
    expect(c.direction).toBe('right');
    expect(c.speedMultiplier).toBe(1.0);
  });

  it('switches to walk on key and back to idle after timeout', () => {
    const onChange = vi.fn();
    const c = new PetController(defaults);
    c.onStateChange(onChange);
    c.notifyKey();
    expect(c.state).toBe('walk');
    expect(onChange).toHaveBeenLastCalledWith('walk');

    vi.advanceTimersByTime(499);
    expect(c.state).toBe('walk');

    vi.advanceTimersByTime(2);
    expect(c.state).toBe('idle');
    expect(onChange).toHaveBeenLastCalledWith('idle');
  });

  it('continuous keys keep walking', () => {
    const c = new PetController(defaults);
    c.notifyKey();
    vi.advanceTimersByTime(300);
    c.notifyKey();
    vi.advanceTimersByTime(300);
    expect(c.state).toBe('walk');
  });

  it('slow typing yields multiplier ≈ 1 and dx = baseStepPx', () => {
    const onStep = vi.fn();
    const c = new PetController(defaults);
    c.onStep(onStep);
    c.notifyKey();

    vi.advanceTimersByTime(100);
    const ev = onStep.mock.lastCall![0];
    expect(ev.direction).toBe('right');
    expect(ev.speedMultiplier).toBeCloseTo(1.0, 5);
    expect(ev.dx).toBe(4);
  });

  it('fast typing pushes multiplier toward 3.0 and scales dx accordingly', () => {
    const onStep = vi.fn();
    const c = new PetController(defaults);
    c.onStep(onStep);
    // 20 keys within ~1s -> KPS ~= 20/2 = 10 over 2s window -> multiplier ≈ 3.0
    for (let i = 0; i < 20; i++) {
      c.notifyKey();
      vi.advanceTimersByTime(50);
    }
    const ev = onStep.mock.lastCall![0];
    expect(ev.speedMultiplier).toBeCloseTo(3.0, 1);
    expect(ev.dx).toBe(Math.round(4 * ev.speedMultiplier));
  });

  it('multiplier decays as old timestamps fall out of the window', () => {
    const c = new PetController(defaults);
    // burst of 20 keys
    for (let i = 0; i < 20; i++) {
      c.notifyKey();
      vi.advanceTimersByTime(20);
    }
    const fast = c.speedMultiplier;
    expect(fast).toBeGreaterThan(2.0);

    // wait until window expires fully
    vi.advanceTimersByTime(2500);
    c.notifyKey(); // single late key
    expect(c.speedMultiplier).toBeCloseTo(1.0, 1);
  });

  it('stops emitting steps when idle', () => {
    const onStep = vi.fn();
    const c = new PetController({ ...defaults, idleTimeoutMs: 200 });
    c.onStep(onStep);
    c.notifyKey();
    vi.advanceTimersByTime(100);
    onStep.mockClear();
    vi.advanceTimersByTime(500);
    expect(onStep).toHaveBeenCalledTimes(1);
    onStep.mockClear();
    vi.advanceTimersByTime(500);
    expect(onStep).not.toHaveBeenCalled();
  });

  it('flipDirection inverts current direction', () => {
    const c = new PetController(defaults);
    expect(c.direction).toBe('right');
    c.flipDirection();
    expect(c.direction).toBe('left');
  });
});
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

```bash
npm run test -- tests/pet-controller.test.ts
```

Expected: FAIL.

- [ ] **Step 3: 구현 — `src/renderer/pet/pet-controller.ts`**

```ts
export type PetState = 'idle' | 'walk';
export type Direction = 'left' | 'right';

export interface PetControllerOptions {
  idleTimeoutMs: number;
  baseStepPx: number;
  intervalMs: number;
  rateWindowMs: number;
  minMultiplier: number;
  maxMultiplier: number;
}

export interface StepEvent {
  dx: number;
  direction: Direction;
  speedMultiplier: number;
}

const KPS_FLOOR = 1;
const KPS_CEIL = 10;

export class PetController {
  state: PetState = 'idle';
  direction: Direction = 'right';
  speedMultiplier: number;

  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private stepTimer: ReturnType<typeof setInterval> | null = null;
  private stateListeners: Array<(s: PetState) => void> = [];
  private stepListeners: Array<(e: StepEvent) => void> = [];
  private keyTimestamps: number[] = [];

  constructor(private readonly opts: PetControllerOptions) {
    this.speedMultiplier = opts.minMultiplier;
  }

  onStateChange(fn: (s: PetState) => void): void { this.stateListeners.push(fn); }
  onStep(fn: (e: StepEvent) => void): void { this.stepListeners.push(fn); }

  notifyKey(): void {
    const now = Date.now();
    this.recordKey(now);
    if (this.state === 'idle') this.setState('walk');
    this.resetIdleTimer();
    this.ensureStepTimer();
  }

  flipDirection(): void {
    this.direction = this.direction === 'right' ? 'left' : 'right';
  }

  dispose(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.stepTimer) clearInterval(this.stepTimer);
    this.idleTimer = null;
    this.stepTimer = null;
  }

  private recordKey(now: number): void {
    this.keyTimestamps.push(now);
    this.pruneAndRecomputeMultiplier(now);
  }

  private pruneAndRecomputeMultiplier(now: number): void {
    const cutoff = now - this.opts.rateWindowMs;
    while (this.keyTimestamps.length > 0 && this.keyTimestamps[0] < cutoff) {
      this.keyTimestamps.shift();
    }
    const windowSec = this.opts.rateWindowMs / 1000;
    const kps = this.keyTimestamps.length / windowSec;
    const clamped = Math.max(KPS_FLOOR, Math.min(KPS_CEIL, kps));
    const t = (clamped - KPS_FLOOR) / (KPS_CEIL - KPS_FLOOR);
    this.speedMultiplier =
      this.opts.minMultiplier + t * (this.opts.maxMultiplier - this.opts.minMultiplier);
  }

  private setState(s: PetState): void {
    if (this.state === s) return;
    this.state = s;
    for (const l of this.stateListeners) l(s);
    if (s === 'idle' && this.stepTimer) {
      clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.setState('idle'), this.opts.idleTimeoutMs);
  }

  private ensureStepTimer(): void {
    if (this.stepTimer) return;
    this.stepTimer = setInterval(() => {
      if (this.state !== 'walk') return;
      this.pruneAndRecomputeMultiplier(Date.now());
      const magnitude = Math.max(1, Math.round(this.opts.baseStepPx * this.speedMultiplier));
      const dx = this.direction === 'right' ? magnitude : -magnitude;
      const event: StepEvent = { dx, direction: this.direction, speedMultiplier: this.speedMultiplier };
      for (const l of this.stepListeners) l(event);
    }, this.opts.intervalMs);
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm run test -- tests/pet-controller.test.ts
```

Expected: PASS (8 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/renderer/pet/pet-controller.ts tests/pet-controller.test.ts
git commit -m "feat(pet-controller): scale step distance and sprite fps with typing speed"
```

---

## Task 8: 전역 키 후크 (uiohook-napi) 메인 측 래퍼

**Files:**
- Create: `src/main/key-hook.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: 키 후크 래퍼 — `src/main/key-hook.ts`**

```ts
import { uIOhook } from 'uiohook-napi';
import { EventEmitter } from 'node:events';

export interface KeyHook {
  start(): void;
  stop(): void;
  on(event: 'key', listener: () => void): void;
}

export function createKeyHook(): KeyHook {
  const emitter = new EventEmitter();
  let started = false;

  const onKeydown = () => emitter.emit('key');

  return {
    start(): void {
      if (started) return;
      uIOhook.on('keydown', onKeydown);
      try {
        uIOhook.start();
        started = true;
      } catch (err) {
        console.error('[key-hook] failed to start', err);
        uIOhook.off('keydown', onKeydown);
      }
    },
    stop(): void {
      if (!started) return;
      uIOhook.off('keydown', onKeydown);
      try { uIOhook.stop(); } catch { /* noop */ }
      started = false;
    },
    on(event, listener) { emitter.on(event, listener); }
  };
}
```

- [ ] **Step 2: 메인에서 키 후크 시작 + 윈도우에 신호 전달 — `src/main/index.ts`**

```ts
import { app, BrowserWindow } from 'electron';
import { createPetWindow } from './pet-window.js';
import { createKeyHook } from './key-hook.js';
import { IPC } from '@shared/ipc-channels';

let petWindow: BrowserWindow | null = null;
const keyHook = createKeyHook();

app.whenReady().then(() => {
  petWindow = createPetWindow({ width: 160, height: 160 });

  keyHook.on('key', () => {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.webContents.send(IPC.KEY_TYPED);
    }
  });
  keyHook.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      petWindow = createPetWindow({ width: 160, height: 160 });
    }
  });
});

app.on('before-quit', () => keyHook.stop());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 3: 펫 preload에 키 이벤트 구독 API 추가 — `src/preload/pet.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/ipc-channels';

contextBridge.exposeInMainWorld('petAPI', {
  onKeyTyped(handler: () => void): () => void {
    const listener = () => handler();
    ipcRenderer.on(IPC.KEY_TYPED, listener);
    return () => ipcRenderer.off(IPC.KEY_TYPED, listener);
  }
});

declare global {
  interface Window {
    petAPI: {
      onKeyTyped(handler: () => void): () => void;
    };
  }
}
```

- [ ] **Step 4: 수동 확인**

```bash
npm run dev
```

DevTools 콘솔에서 다음을 임시 실행:

```js
window.petAPI.onKeyTyped(() => console.log('key!'));
```

Expected: 다른 앱에서 키를 누를 때마다 콘솔에 `key!` 로그 출력. macOS에서는 처음 실행 시 "보안 및 개인 정보 보호 → 손쉬운 사용"에서 Electron(또는 빌드 후의 앱)을 허용해야 한다.

- [ ] **Step 5: 커밋**

```bash
git add src/main/key-hook.ts src/main/index.ts src/preload/pet.ts
git commit -m "feat(key-hook): forward global keydown events to the pet renderer via IPC"
```

---

## Task 9: 펫 윈도우 위치 이동 — IPC로 윈도우 좌표 변경

**Files:**
- Create: `src/main/ipc.ts`
- Modify: `src/main/index.ts`
- Modify: `src/main/pet-window.ts`
- Modify: `src/preload/pet.ts`

펫 윈도우는 작은 크기를 유지하고, walk 시 메인 프로세스의 `setBounds`로 윈도우 자체를 좌우 이동한다. 화면 경계에 도달하면 방향을 뒤집는다.

- [ ] **Step 1: 펫 윈도우 모듈에 헬퍼 추가 — `src/main/pet-window.ts` 끝부분**

```ts
export function moveWindowBy(win: BrowserWindow, dx: number): {
  newX: number;
  hitEdge: 'left' | 'right' | null;
} {
  const display = screen.getDisplayMatching(win.getBounds()).workArea;
  const bounds = win.getBounds();
  let nextX = bounds.x + dx;
  let hit: 'left' | 'right' | null = null;

  if (nextX < display.x) {
    nextX = display.x;
    hit = 'left';
  } else if (nextX + bounds.width > display.x + display.width) {
    nextX = display.x + display.width - bounds.width;
    hit = 'right';
  }

  win.setBounds({ ...bounds, x: Math.round(nextX) });
  return { newX: nextX, hitEdge: hit };
}
```

- [ ] **Step 2: IPC 핸들러 모듈 — `src/main/ipc.ts`**

```ts
import { BrowserWindow, ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels';
import { moveWindowBy } from './pet-window.js';

export function registerPetWindowIpc(getPetWindow: () => BrowserWindow | null) {
  ipcMain.handle(IPC.PET_MOVE_BY, (_e, payload: { dx: number }) => {
    const win = getPetWindow();
    if (!win || win.isDestroyed()) return { hitEdge: null };
    return moveWindowBy(win, payload.dx);
  });
}
```

- [ ] **Step 3: 메인 엔트리에 IPC 등록 — `src/main/index.ts`**

```ts
import { registerPetWindowIpc } from './ipc.js';
// ...
app.whenReady().then(() => {
  petWindow = createPetWindow({ width: 160, height: 160 });
  registerPetWindowIpc(() => petWindow);
  // ...
});
```

- [ ] **Step 4: preload에 이동 API 추가 — `src/preload/pet.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/ipc-channels';

contextBridge.exposeInMainWorld('petAPI', {
  onKeyTyped(handler: () => void): () => void {
    const listener = () => handler();
    ipcRenderer.on(IPC.KEY_TYPED, listener);
    return () => ipcRenderer.off(IPC.KEY_TYPED, listener);
  },
  moveBy(dx: number): Promise<{ hitEdge: 'left' | 'right' | null }> {
    return ipcRenderer.invoke(IPC.PET_MOVE_BY, { dx });
  }
});

declare global {
  interface Window {
    petAPI: {
      onKeyTyped(handler: () => void): () => void;
      moveBy(dx: number): Promise<{ hitEdge: 'left' | 'right' | null }>;
    };
  }
}
```

- [ ] **Step 5: 수동 확인**

```bash
npm run dev
```

DevTools 콘솔:

```js
await window.petAPI.moveBy(50);
```

Expected: 펫 윈도우가 오른쪽으로 50px 이동. `-1000` 같은 큰 음수를 주면 `hitEdge: 'left'`가 반환되고 윈도우가 화면 왼쪽 가장자리에 붙음.

- [ ] **Step 6: 커밋**

```bash
git add src/main/pet-window.ts src/main/ipc.ts src/main/index.ts src/preload/pet.ts
git commit -m "feat(pet-window): expose move-by IPC that clamps pet window inside work area"
```

---

## Task 10: 렌더러에서 모든 조각을 연결 (PetSprite + PetController + IPC + sprite sheet)

**Files:**
- Modify: `src/renderer/pet/main.ts`
- Modify: `src/renderer/pet/styles.css`
- Modify: `src/preload/pet.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/main/pet-window.ts` (resizePetWindow 추가)
- Modify: `src/main/index.ts`
- Add: `themes/<id>/{pet.json, spritesheet.webp}` — `image/` 폴더의 두 에셋을 옮기고 `pet.json`을 확장 스키마로 작성

이 task가 끝나면 펫이 활성 테마의 sprite sheet 한 행을 idle/walk에 맞춰 순환 렌더하고, 키 입력으로 walk → 윈도우 자체가 좌우 이동, 가장자리에서 방향 전환까지 동작한다.

- [ ] **Step 1: 테마 에셋 폴더 만들기 — image/ → themes/ 복사 + pet.json 확장**

```bash
mkdir -p themes/sowai themes/coding-pup
cp image/walking-sun/spritesheet.webp themes/sowai/
cp image/coding-ddosuni/spritesheet.webp themes/coding-pup/
```

`themes/sowai/pet.json` (행 인덱스는 사용자가 확정한 값으로 추후 수정):

```json
{
  "id": "sowai",
  "displayName": "Sowai",
  "description": "A compact mackerel-tabby cat digital pet that loafs like bread and walks around.",
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

`themes/coding-pup/pet.json` (마찬가지로 추후 확정):

```json
{
  "id": "coding-pup",
  "displayName": "Coding Pup",
  "description": "A black-and-white coding dog companion inspired by the provided photo.",
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

- [ ] **Step 2: 펫 윈도우 크기 조절 헬퍼 추가 — `src/main/pet-window.ts` 끝부분에 추가**

```ts
export function resizePetWindow(win: BrowserWindow, width: number, height: number): void {
  const b = win.getBounds();
  win.setBounds({ x: b.x, y: b.y, width, height });
}
```

- [ ] **Step 3: 메인 IPC 확장 — `src/main/ipc.ts`**

`registerPetWindowIpc`에 테마 조회·크기 조절 핸들러를 추가:

```ts
import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { IPC } from '@shared/ipc-channels';
import { moveWindowBy, resizePetWindow } from './pet-window.js';
import { loadThemes } from './theme-loader.js';
import type { SettingsStore } from './store.js';
import type { ThemeAssets } from '@shared/theme-types';

export function getThemesDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'themes')
    : join(app.getAppPath(), 'themes');
}

export function registerPetWindowIpc(
  getPetWindow: () => BrowserWindow | null,
  store: SettingsStore
) {
  ipcMain.handle(IPC.PET_MOVE_BY, (_e, payload: { dx: number }) => {
    const win = getPetWindow();
    if (!win || win.isDestroyed()) return { hitEdge: null };
    return moveWindowBy(win, payload.dx);
  });

  ipcMain.handle(IPC.PET_SET_SIZE, (_e, payload: { width: number; height: number }) => {
    const win = getPetWindow();
    if (!win || win.isDestroyed()) return;
    resizePetWindow(win, payload.width, payload.height);
  });

  ipcMain.handle(IPC.THEMES_LIST, (): ThemeAssets[] => loadThemes(getThemesDir()));

  ipcMain.handle(IPC.THEME_GET_ACTIVE, (): ThemeAssets | null => {
    const themes = loadThemes(getThemesDir());
    const id = store.get('activeThemeId');
    return themes.find(t => t.meta.id === id) ?? themes[0] ?? null;
  });
}
```

- [ ] **Step 4: 메인 엔트리에서 초기 윈도우 크기를 활성 테마에 맞추기 — `src/main/index.ts`**

```ts
import { app, BrowserWindow } from 'electron';
import { createPetWindow } from './pet-window.js';
import { createKeyHook } from './key-hook.js';
import { createSettingsStore } from './store.js';
import { registerPetWindowIpc, getThemesDir } from './ipc.js';
import { loadThemes } from './theme-loader.js';
import { IPC } from '@shared/ipc-channels';

let petWindow: BrowserWindow | null = null;
const keyHook = createKeyHook();
const store = createSettingsStore();

app.whenReady().then(() => {
  const themes = loadThemes(getThemesDir());
  const activeId = store.get('activeThemeId');
  const active = themes.find(t => t.meta.id === activeId) ?? themes[0] ?? null;
  const width = active?.meta.renderWidth ?? 160;
  const height = active?.meta.renderHeight ?? 130;

  const savedPos = store.get('petPosition');
  petWindow = createPetWindow({ width, height, x: savedPos?.x, y: savedPos?.y });
  registerPetWindowIpc(() => petWindow, store);

  petWindow.on('moved', () => {
    if (!petWindow) return;
    const [x, y] = petWindow.getPosition();
    store.set('petPosition', { x, y });
  });

  keyHook.on('key', () => {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.webContents.send(IPC.KEY_TYPED);
    }
  });
  keyHook.start();
});

app.on('before-quit', () => keyHook.stop());
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 5: preload에 테마/크기 API 추가 — `src/preload/pet.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/ipc-channels';
import type { ThemeAssets } from '@shared/theme-types';

const api = {
  onKeyTyped(handler: () => void): () => void {
    const listener = () => handler();
    ipcRenderer.on(IPC.KEY_TYPED, listener);
    return () => ipcRenderer.off(IPC.KEY_TYPED, listener);
  },
  moveBy(dx: number): Promise<{ hitEdge: 'left' | 'right' | null }> {
    return ipcRenderer.invoke(IPC.PET_MOVE_BY, { dx });
  },
  setSize(width: number, height: number): Promise<void> {
    return ipcRenderer.invoke(IPC.PET_SET_SIZE, { width, height });
  },
  getActiveTheme(): Promise<ThemeAssets | null> {
    return ipcRenderer.invoke(IPC.THEME_GET_ACTIVE);
  },
  onActiveThemeChanged(handler: (t: ThemeAssets | null) => void): () => void {
    const listener = (_e: unknown, t: ThemeAssets | null) => handler(t);
    ipcRenderer.on(IPC.THEME_SET_ACTIVE, listener);
    return () => ipcRenderer.off(IPC.THEME_SET_ACTIVE, listener);
  }
};

contextBridge.exposeInMainWorld('petAPI', api);

declare global {
  interface Window { petAPI: typeof api; }
}
```

- [ ] **Step 6: 펫 렌더러 통합 — `src/renderer/pet/main.ts`**

```ts
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
```

- [ ] **Step 7: 스프라이트 컨테이너 스타일 — `src/renderer/pet/styles.css`의 `.pet-sprite` 갱신**

```css
.pet-sprite {
  background: transparent;
  background-repeat: no-repeat;
  image-rendering: pixelated;
  transform-origin: center center;
  transition: transform 80ms linear;
  -webkit-app-region: drag;
}
```

이전의 분홍 placeholder 박스 관련 속성(`border`, `border-radius`, `width: 96px`, `height: 96px`)은 제거. 크기·배경은 JS에서 동적으로 설정한다.

- [ ] **Step 8: 빌드/실행 검증**

```bash
npm run typecheck
npm run dev
```

Expected:
- 펫 윈도우 크기가 `sowai`(또는 정렬 순서상 첫 테마) `renderWidth × renderHeight`로 표시
- idle 자세 정지 이미지(또는 idle 행의 짧은 시퀀스)로 보임
- 다른 앱에서 키를 타이핑하면 walk 행 프레임이 순환되며 윈도우가 좌우로 이동
- 빠른 연타 시 walk 애니메이션이 빨라지고 한 step의 dx도 커짐 (최대 ≈ 3배)
- 화면 가장자리 도달 시 자동 방향 전환
- 약 0.6초 입력 없으면 idle 행으로 복귀
- macOS는 첫 실행 시 "손쉬운 사용" 권한 요청. 허용 후 앱 재시작.

이 단계에서 idle/walk 행 인덱스가 실제 스프라이트와 어긋나면 시각적으로 어색하게 보인다 — 사용자가 확정한 행 번호로 `pet.json`을 다시 저장한 뒤 재실행.

- [ ] **Step 9: 커밋**

```bash
git add src/main/ipc.ts src/main/index.ts src/main/pet-window.ts src/preload/pet.ts src/renderer/pet/main.ts src/renderer/pet/styles.css src/shared/ipc-channels.ts themes/
git commit -m "feat(pet): render sprite-sheet theme via background-position with typing-speed scaling"
```

---

## Task 11: 설정 윈도우 — 테마 선택 + 자동 시작 + 위치 초기화

**Files:**
- Create: `src/main/settings-window.ts`
- Create: `src/preload/settings.ts`
- Create: `src/renderer/settings/index.html`
- Create: `src/renderer/settings/main.ts`
- Create: `src/renderer/settings/styles.css`
- Modify: `electron.vite.config.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: electron-vite에 settings preload/renderer 엔트리 추가 — `electron.vite.config.ts`**

`preload.rollupOptions.input`에 `settings: resolve('src/preload/settings.ts')` 추가, `renderer.rollupOptions.input`에 `settings: resolve('src/renderer/settings/index.html')` 추가.

- [ ] **Step 2: 설정 윈도우 모듈 — `src/main/settings-window.ts`**

```ts
import { BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

let settingsWindow: BrowserWindow | null = null;

export function openSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return settingsWindow;
  }

  const win = new BrowserWindow({
    width: 420,
    height: 480,
    resizable: false,
    title: 'Walking Pet — Settings',
    webPreferences: {
      preload: join(__dirname, '../preload/settings.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/settings/index.html`);
  } else {
    win.loadFile(join(__dirname, '../renderer/settings/index.html'));
  }

  win.on('closed', () => { settingsWindow = null; });
  settingsWindow = win;
  return win;
}
```

- [ ] **Step 3: 설정 IPC 추가 — `src/main/ipc.ts`에 다음 함수와 import 추가**

파일 상단에 `screen`을 import에 추가하고, 기존 `getThemesDir`을 재사용한다.

```ts
// 상단 import 정리
import { BrowserWindow, ipcMain, screen } from 'electron';
import { IPC } from '@shared/ipc-channels';
import type { SettingsStore } from './store.js';
import type { AppSettings } from '@shared/settings-schema';
import { loadThemes } from './theme-loader.js';
// getThemesDir, moveWindowBy는 동일 파일에 이미 정의되어 있음

export function registerSettingsIpc(
  store: SettingsStore,
  getPetWindow: () => BrowserWindow | null,
  setAutoLaunch: (enabled: boolean) => void
) {
  ipcMain.handle(IPC.SETTINGS_GET, (): AppSettings => store.getAll());

  ipcMain.handle(IPC.SETTINGS_SET, (_e, patch: Partial<AppSettings>): AppSettings => {
    store.update(patch);

    if (patch.activeThemeId) {
      const all = loadThemes(getThemesDir());
      const active = all.find(t => t.meta.id === patch.activeThemeId) ?? null;
      const win = getPetWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC.THEME_SET_ACTIVE, active);
      }
    }

    if (typeof patch.autoLaunch === 'boolean') {
      setAutoLaunch(patch.autoLaunch);
    }

    return store.getAll();
  });

  ipcMain.handle(IPC.PET_POSITION_RESET, () => {
    store.set('petPosition', null);
    const win = getPetWindow();
    if (!win || win.isDestroyed()) return;
    const display = screen.getPrimaryDisplay().workArea;
    const b = win.getBounds();
    win.setBounds({
      x: Math.round(display.x + display.width / 2 - b.width / 2),
      y: Math.round(display.y + display.height - b.height - 80),
      width: b.width,
      height: b.height
    });
  });
}
```

- [ ] **Step 4: 설정 preload — `src/preload/settings.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/ipc-channels';
import type { AppSettings } from '@shared/settings-schema';
import type { ThemeAssets } from '@shared/theme-types';

const api = {
  getSettings(): Promise<AppSettings> {
    return ipcRenderer.invoke(IPC.SETTINGS_GET);
  },
  setSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    return ipcRenderer.invoke(IPC.SETTINGS_SET, patch);
  },
  listThemes(): Promise<ThemeAssets[]> {
    return ipcRenderer.invoke(IPC.THEMES_LIST);
  },
  resetPosition(): Promise<void> {
    return ipcRenderer.invoke(IPC.PET_POSITION_RESET);
  }
};

contextBridge.exposeInMainWorld('settingsAPI', api);

declare global {
  interface Window { settingsAPI: typeof api; }
}
```

- [ ] **Step 5: 설정 화면 HTML — `src/renderer/settings/index.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Walking Pet Settings</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main>
      <h1>Walking Pet</h1>

      <section>
        <h2>Theme</h2>
        <div id="theme-list" class="theme-list"></div>
      </section>

      <section>
        <h2>Behavior</h2>
        <label class="row">
          <input type="checkbox" id="auto-launch" />
          <span>Start automatically when I log in</span>
        </label>
        <button id="reset-position" class="row-btn">Reset pet position</button>
      </section>
    </main>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: 설정 화면 스타일 — `src/renderer/settings/styles.css`**

```css
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 24px; background: #fafafa; color: #222; }
h1 { font-size: 20px; margin: 0 0 16px; }
h2 { font-size: 14px; text-transform: uppercase; color: #666; margin: 24px 0 8px; }
section { margin-bottom: 16px; }
.theme-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.theme-card { border: 2px solid transparent; border-radius: 8px; padding: 8px; background: white; cursor: pointer; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.theme-card.selected { border-color: #4a90e2; }
.theme-preview { max-width: 100%; }
.theme-card .name { font-size: 12px; }
.row { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
.row-btn { padding: 8px 12px; border-radius: 6px; border: 1px solid #ccc; background: white; cursor: pointer; }
.row-btn:hover { background: #f0f0f0; }
```

- [ ] **Step 7: 설정 화면 로직 — `src/renderer/settings/main.ts`**

```ts
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
```

- [ ] **Step 8: 메인 엔트리에서 settings IPC 등록 (Task 12에서 auto-launch 모듈 추가 후 완성)**

지금은 setAutoLaunch에 임시 no-op을 넣어둔다 — Task 12에서 실제 호출로 교체:

```ts
// src/main/index.ts
import { registerPetWindowIpc, registerSettingsIpc } from './ipc.js';

app.whenReady().then(() => {
  // ...기존 코드...
  registerSettingsIpc(store, () => petWindow, (_enabled) => { /* TODO Task 12 */ });
});
```

- [ ] **Step 9: 임시로 트레이가 없으니 메뉴 단축키로 설정 창 열기 (확인용)**

DevTools 콘솔에서 `await window.petAPI.openSettings?.()` 형태로 확인하기 어려우므로, 임시로 메인에서 앱 부팅 1초 후 자동으로 한 번 열어 검증:

```ts
// src/main/index.ts (검증용, Task 13 이후 제거)
setTimeout(() => {
  import('./settings-window.js').then(m => m.openSettingsWindow());
}, 1000);
```

- [ ] **Step 10: 수동 확인**

```bash
npm run dev
```

Expected: 펫 위젯과 함께 설정 창이 열리고, 테마 카드(현재는 1개만) 클릭 시 펫의 외형이 바뀌며, "Reset pet position" 클릭 시 펫이 기본 위치로 돌아감.

- [ ] **Step 11: 검증용 setTimeout 제거**

Task 13에서 트레이로 정식 진입이 생기므로 위 임시 코드 삭제.

- [ ] **Step 12: 커밋**

```bash
git add src/main/settings-window.ts src/main/ipc.ts src/main/index.ts src/preload/settings.ts src/renderer/settings/ electron.vite.config.ts
git commit -m "feat(settings): add settings window for theme selection and position reset"
```

---

## Task 12: 자동 시작 (Auto-launch) 모듈 (TDD)

**Files:**
- Create: `src/main/auto-launch.ts`
- Create: `tests/auto-launch.test.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: 테스트 작성 — `tests/auto-launch.test.ts`**

`app.setLoginItemSettings`를 mock하여 호출 인자만 검증한다.

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const setLoginItemSettings = vi.fn();
const getLoginItemSettings = vi.fn(() => ({ openAtLogin: false }));

vi.mock('electron', () => ({
  app: {
    setLoginItemSettings: (...args: unknown[]) => setLoginItemSettings(...args),
    getLoginItemSettings: () => getLoginItemSettings(),
    getPath: () => '/tmp',
    isPackaged: false,
    getAppPath: () => '/tmp/app'
  }
}));

import { applyAutoLaunch, isAutoLaunchEnabled } from '../src/main/auto-launch';

describe('auto-launch', () => {
  beforeEach(() => {
    setLoginItemSettings.mockClear();
    getLoginItemSettings.mockReset();
  });

  it('enabling sets openAtLogin=true', () => {
    applyAutoLaunch(true);
    expect(setLoginItemSettings).toHaveBeenCalledWith(expect.objectContaining({ openAtLogin: true }));
  });

  it('disabling sets openAtLogin=false', () => {
    applyAutoLaunch(false);
    expect(setLoginItemSettings).toHaveBeenCalledWith(expect.objectContaining({ openAtLogin: false }));
  });

  it('isAutoLaunchEnabled reads from getLoginItemSettings', () => {
    getLoginItemSettings.mockReturnValueOnce({ openAtLogin: true });
    expect(isAutoLaunchEnabled()).toBe(true);
    getLoginItemSettings.mockReturnValueOnce({ openAtLogin: false });
    expect(isAutoLaunchEnabled()).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

```bash
npm run test -- tests/auto-launch.test.ts
```

Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현 — `src/main/auto-launch.ts`**

```ts
import { app } from 'electron';

export function applyAutoLaunch(enabled: boolean): void {
  if (process.platform === 'darwin' || process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: enabled
    });
  }
}

export function isAutoLaunchEnabled(): boolean {
  return !!app.getLoginItemSettings().openAtLogin;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm run test -- tests/auto-launch.test.ts
```

Expected: PASS.

- [ ] **Step 5: 메인 엔트리에 연결 — `src/main/index.ts`**

`registerSettingsIpc` 호출의 third arg를 실제 함수로 교체:

```ts
import { applyAutoLaunch } from './auto-launch.js';

// ...
app.whenReady().then(() => {
  // 부팅 시 저장된 설정과 OS 상태 동기화
  applyAutoLaunch(store.get('autoLaunch'));
  // ...
  registerSettingsIpc(store, () => petWindow, applyAutoLaunch);
});
```

- [ ] **Step 6: 수동 확인 (macOS)**

```bash
npm run dev
```

설정 창에서 "Start automatically when I log in"을 체크한 뒤 끈다. `시스템 설정 → 일반 → 로그인 항목`에서 Electron이 추가/제거되는지 확인. (개발 모드에서는 Electron 헬퍼가 등록되며, 패키징 후에는 빌드된 앱이 등록됨)

- [ ] **Step 7: 커밋**

```bash
git add src/main/auto-launch.ts src/main/index.ts tests/auto-launch.test.ts
git commit -m "feat(auto-launch): persist and apply OS login-item setting on macOS and Windows"
```

---

## Task 13: 시스템 트레이 (설정 열기 / 종료)

**Files:**
- Create: `src/main/tray.ts`
- Modify: `src/main/index.ts`
- Create/Place: `resources/tray-icon.png` (16×16 또는 32×32 PNG, 단색 권장)

- [ ] **Step 1: 트레이 아이콘 placeholder 준비**

`resources/tray-icon.png` 위치에 임시 PNG를 둔다 (Mac은 templateImage 권장: 검정 단색 + 알파). 사용자가 추후 교체할 수 있도록 파일 경로만 고정.

- [ ] **Step 2: 트레이 모듈 — `src/main/tray.ts`**

```ts
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
```

- [ ] **Step 3: 메인 엔트리에서 트레이 생성 — `src/main/index.ts`**

```ts
import { createTray } from './tray.js';
import { openSettingsWindow } from './settings-window.js';

// app.whenReady 내부에서
createTray(() => openSettingsWindow());
```

- [ ] **Step 4: macOS Dock 아이콘 숨김 (위젯 느낌)**

```ts
// app.whenReady() 가장 위
if (process.platform === 'darwin') {
  app.dock?.hide();
}
```

- [ ] **Step 5: 수동 확인**

```bash
npm run dev
```

Expected: macOS는 메뉴바 우측에, Windows는 작업 표시줄 트레이에 펫 아이콘이 표시되고 우클릭/클릭 시 Settings / Quit 메뉴가 뜬다. Dock에는 펫 앱이 보이지 않음(맥).

- [ ] **Step 6: 커밋**

```bash
git add src/main/tray.ts src/main/index.ts resources/tray-icon.png
git commit -m "feat(tray): add system tray with settings shortcut and quit"
```

---

## Task 14: 패키징 (electron-builder)

**Files:**
- Create: `electron-builder.yml`
- Modify: `package.json`
- (Optional) Create: `build/entitlements.mac.plist`

- [ ] **Step 1: electron-builder 설정 — `electron-builder.yml`**

```yaml
appId: com.molly.walkingpet
productName: Walking Pet
directories:
  buildResources: build
  output: dist
files:
  - out/**
  - package.json
extraResources:
  - from: themes
    to: themes
  - from: resources/tray-icon.png
    to: tray-icon.png
mac:
  category: public.app-category.utilities
  target:
    - target: dmg
      arch:
        - arm64
        - x64
  icon: resources/icon.png
  hardenedRuntime: false
  gatekeeperAssess: false
  extendInfo:
    LSUIElement: 1
win:
  target:
    - target: nsis
      arch:
        - x64
  icon: resources/icon.png
nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
```

`LSUIElement: 1`은 macOS에서 Dock 아이콘을 완전히 숨겨 위젯처럼 동작시키는 핵심 키.

- [ ] **Step 2: `package.json`의 `build` 필드는 사용하지 않고 `electron-builder.yml`을 그대로 사용**

(이미 `package.json`의 scripts에 `dist:mac`, `dist:win`이 정의되어 있음 — Task 1 기준)

- [ ] **Step 3: macOS dmg 생성 시도**

```bash
npm run dist:mac
```

Expected: `dist/` 아래에 `Walking Pet-<version>-arm64.dmg`와 `-x64.dmg` 생성. 코드사인 미설정이므로 첫 실행 시 Gatekeeper 경고가 뜨지만 우클릭 → 열기로 실행 가능.

- [ ] **Step 4: Windows NSIS 생성 시도 (macOS에서는 `dist:win` 호출 시 wine 또는 docker 필요 — 가능하면 Windows 머신/VM에서 실행)**

```bash
npm run dist:win
```

Expected: `dist/Walking Pet Setup-<version>.exe`. (사용자가 Windows 환경에서 검증)

- [ ] **Step 5: 패키지 실행 후 핵심 동작 확인**
- macOS에서 dmg 마운트 → 앱을 Applications로 드래그 → 실행
  - Dock에는 표시되지 않고 메뉴바 트레이에만 표시되어야 함
  - "보안 및 개인 정보 보호 → 손쉬운 사용"에서 권한 부여 후 키 감지 동작
- Settings → "Start automatically when I log in" 체크 후 OS 재시작 → 로그인 후 자동 실행되는지 확인

- [ ] **Step 6: 커밋**

```bash
git add electron-builder.yml
git commit -m "build: configure electron-builder for macOS dmg and Windows NSIS"
```

---

## Task 15: README 작성

**Files:**
- Create: `README.md`

- [ ] **Step 1: README 작성**

```markdown
# Walking Pet

A tiny desktop pet that walks across your screen while you type, and sits idle when your keyboard is quiet. Works on macOS and Windows.

## Features

- Transparent always-on-top widget you can drag anywhere
- Three swappable themes (assets placed under `themes/<id>/`)
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

## Build

- macOS: `npm run dist:mac`
- Windows: `npm run dist:win` (run on Windows)

Outputs land in `dist/`.

## Tests

```
npm run test
```
```

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "docs: add README covering theme layout, dev, build, and tests"
```

---

## Final Verification

- [ ] **Step 1: 전체 테스트 통과 확인**

```bash
npm run test
npm run typecheck
```

Expected: 모든 테스트(store, theme-loader, pet-sprite, pet-controller, auto-launch) PASS. typecheck 오류 0.

- [ ] **Step 2: 개발 모드 골든 패스 시나리오**

```bash
npm run dev
```

순서대로 검증:
1. 데스크탑 위 펫 위젯이 idle 애니메이션으로 표시됨
2. 텍스트 편집기로 포커스를 옮겨 타이핑 → 펫이 walk 애니메이션으로 전환, 윈도우가 좌우 이동
3. 빠르게 연타할 때 다리 움직임이 빨라지고 한 번에 더 먼 거리를 이동 (최대 약 3배), 천천히 치면 1배로 수렴
4. 화면 가장자리에서 자동으로 방향 전환
5. 일정 시간(≥ 600ms) 입력이 없으면 idle로 복귀
6. 마우스로 펫을 드래그해 임의 위치로 이동 → 위치가 저장됨
7. 트레이 → Settings에서 테마 변경 → 즉시 펫의 외형이 바뀜
8. Settings에서 "Reset pet position" → 펫이 기본 위치로 복귀
9. Settings에서 "Start automatically when I log in" → 토글이 OS 설정에 반영됨

- [ ] **Step 3: 패키징 산출물 실행 검증 (각 OS에서)**

위 시나리오를 dmg/exe 설치본에서 한 번 더 통과 확인. macOS Accessibility 권한, Windows의 시작 프로그램 등록 여부 점검.

- [ ] **Step 4: 모든 커밋이 푸시 가능한 상태인지 점검**

```bash
git status
git log --oneline
```

Expected: working tree clean, 모든 task 단위 커밋이 차곡차곡 쌓여 있음.

---

## Notes for the implementer

- **electron-store의 ESM 호환성:** v10부터 ESM only이므로 `"type": "module"`인 본 프로젝트에 적합. v8 이하를 쓰면 require 문제로 막힌다.
- **uiohook-napi와 macOS:** 첫 실행 시 OS가 키 감지 권한을 묻는다. 권한이 거부되면 `uIOhook.start()`가 조용히 실패할 수 있으므로 로그를 남겨둠. 사용자가 권한 부여 후 앱 재시작이 가장 단순한 복구 경로.
- **윈도우 이동 빈도:** `intervalMs`(테마 fps 기반)마다 `setBounds`를 호출한다. 8~12fps 정도가 부드러움/CPU 균형이 좋다. 너무 높이면 macOS에서 윈도우 이동 트랜잭션 비용으로 미세한 jitter가 보일 수 있다.
- **테마 에셋이 빈 경우:** `theme-loader`가 폴더를 건너뛰므로 사용자가 `themes/`에 아무것도 안 넣으면 펫은 분홍 placeholder 박스로 표시된다(Task 2의 fallback). 실제 에셋이 들어오면 자동으로 첫 테마가 활성화된다.
- **잘못된 행 인덱스:** `pet.json`의 `idleRow`/`walkRow`/`*Columns`가 실제 스프라이트 시트의 모션 위치와 어긋나면 단순히 다른 자세가 표시될 뿐 앱은 정상 동작한다. 행 의미는 시트 제작 시점에 시각 확인 → `pet.json` 갱신 → 앱 재시작으로 맞춘다.
- **`image-rendering: pixelated`** 는 도트 풍 시트가 부드러운 보간 없이 또렷하게 보이게 한다. 사진풍 시트라면 이 줄을 `auto`로 바꿔도 무방.
- **드래그 가능 영역(`-webkit-app-region: drag`)과 클릭 가능 요소:** 추후 펫에 클릭 인터랙션(예: 클릭하면 점프)을 추가하려면 해당 요소에 `-webkit-app-region: no-drag`을 부여해야 한다.
