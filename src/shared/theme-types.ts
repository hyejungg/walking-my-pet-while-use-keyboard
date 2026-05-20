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
