# 自律徘徊マスコット化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `vrc-mascot-pwa`を、`model-viewer`による全画面固定表示から、three.js製の自由徘徊マスコット（タップ反応・ドラッグ対応・自律移動）へ作り替える。

**Architecture:** `model-viewer` Webコンポーネントを撤去し、ローカル同梱したthree.jsで`<canvas>`にレンダリング。`OrthographicCamera`（正面固定・傾き無し）を使うことで、画面ピクセル座標とワールド座標の変換を単純な線形計算に保つ。既存の`model.glb`（idle/wave/danceの3クリップ内包、名称は`Armature.001|mixamo.com|Layer0`等のMixamo由来の非意味的な名前）をインデックス基準で扱う。

**Tech Stack:** three.js 0.169.0（ローカルvendor）、ES Modules + import map、Vanilla JS（フレームワーク無し）。既存踏襲でビルドステップ無し。

---

## 前提として確認済みの事実

実装前にPreviewツールで実機検証し、以下を確認済み（推測ではない）:

- `model.glb`のアニメーションクリップは3つ: `gltf.animations[0]` = `"Armature.001|mixamo.com|Layer0"`, `[1]` = `"Armature.001|mixamo.com|Layer0.001"`, `[2]` = `"Armature|mixamo.com|Layer0"`
- 現行`model-viewer`のデフォルト自動再生アニメーション（`autoplay`属性で流れるもの）は**インデックス0**（`"Armature.001|mixamo.com|Layer0"`）。これを新実装でも「待機/移動中に流すデフォルトループ」として踏襲する
- タップ時の挙動は現行実装同様、**クリップをインデックス順に切り替えるだけ**（名前で意味づけしない）。新実装でも同じ考え方を踏襲し、「wave」「dance」等の意味的な名前は使わない

## ファイル構成の変化

```
vrc-mascot-pwa/
├── index.html            # 全面書き換え（model-viewer撤去、canvas+import map）
├── mascot.js              # 新規（three.jsシーン・状態機械・入力処理）
├── vendor/
│   ├── three.module.js    # 新規（three.js 0.169.0 コア、ローカル同梱）
│   ├── loaders/
│   │   └── GLTFLoader.js  # 新規
│   └── utils/
│       └── BufferGeometryUtils.js  # 新規（GLTFLoader.jsの依存）
├── manifest.json          # 変更なし
├── model.glb              # 変更なし
├── model.usdz             # 削除（AR機能廃止に伴い不要）
├── sw.js                  # キャッシュ対象更新、CACHE_VERSION bump（v6→v7）
├── icons/                 # 変更なし
└── README.md              # AR関連記述を更新
```

---

### Task 1: three.jsをローカルにvendorする

**Files:**
- Create: `vendor/three.module.js`
- Create: `vendor/loaders/GLTFLoader.js`
- Create: `vendor/utils/BufferGeometryUtils.js`

- [ ] **Step 1: vendorディレクトリを作成し、three.js 0.169.0の3ファイルをダウンロードする**

```bash
cd "C:\Users\PC_User\Documents\vrc-mascot-pwa"
mkdir -p vendor/loaders vendor/utils
curl -sL "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js" -o vendor/three.module.js
curl -sL "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js" -o vendor/loaders/GLTFLoader.js
curl -sL "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/utils/BufferGeometryUtils.js" -o vendor/utils/BufferGeometryUtils.js
```

- [ ] **Step 2: ダウンロードしたファイルが空でないこと、バージョンが一致することを確認する**

```bash
wc -l vendor/three.module.js vendor/loaders/GLTFLoader.js vendor/utils/BufferGeometryUtils.js
grep -m1 "REVISION" vendor/three.module.js
```

Expected: 3ファイルとも1000行以上（空ではない）。`REVISION`の値が`169`を含む。

- [ ] **Step 3: GLTFLoader.jsの依存importが想定通り（threeへのbare importと、隣接utilsへの相対importのみ）であることを確認する**

```bash
grep -n "^import" vendor/loaders/GLTFLoader.js
```

Expected: `from 'three'`（1件）と`from '../utils/BufferGeometryUtils.js'`（1件）の2つのみ。他のファイルへの依存が増えていた場合、そのファイルも追加でvendorする必要があるため、その時点で立ち止まって追加ダウンロードすること。

- [ ] **Step 4: commit**

```bash
git add vendor/
git commit -m "chore: three.js 0.169.0をローカルにvendor"
```

---

### Task 2: model-viewerをthree.jsベースのcanvasに置き換える（静止表示まで）

このタスクでは「アバターが画面中央に表示され、デフォルトアニメーションがループ再生される」ところまでを作る。移動・入力処理はまだ入れない。

**Files:**
- Modify: `index.html`（全面書き換え）
- Create: `mascot.js`

- [ ] **Step 1: index.htmlを書き換える**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>VRCマスコット</title>
  <link rel="manifest" href="manifest.json">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="マスコット">
  <link rel="apple-touch-icon" href="icons/icon-192.png">
  <script type="importmap">
  {
    "imports": {
      "three": "./vendor/three.module.js"
    }
  }
  </script>
  <style>
    :root {
      --sat: env(safe-area-inset-top, 0px);
      --sar: env(safe-area-inset-right, 0px);
      --sab: env(safe-area-inset-bottom, 0px);
      --sal: env(safe-area-inset-left, 0px);
    }
    html, body {
      margin: 0;
      height: 100%;
      background-color: #eee;
      overflow: hidden;
      touch-action: none;
    }
    #stage {
      display: block;
      width: 100vw;
      height: 100vh;
    }
  </style>
</head>
<body>
  <canvas id="stage"></canvas>
  <script type="module" src="mascot.js"></script>
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js');
      });
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: mascot.jsを新規作成する（このタスクの範囲＝表示のみ）**

```javascript
import * as THREE from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';

const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeeeeee);

// 正面固定・傾き無しのOrthographicCameraを使う。
// 理由: 傾きが無ければ「画面ピクセル座標→ワールド座標」の変換が単純な線形計算で済み、
// PerspectiveCameraのunprojectのような複雑な計算が不要になる（Task 4で利用）。
const FRUSTUM_HEIGHT = 4; // ワールド単位。画面の縦幅がこの高さに相当する
const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x999999, 1.3));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
keyLight.position.set(2, 3, 4);
scene.add(keyLight);

const TARGET_HEIGHT = FRUSTUM_HEIGHT / 3; // 画面縦幅の約1/3のサイズにする
const IDLE_CLIP_INDEX = 0; // Preview実機確認済み: model-viewer時代のデフォルト自動再生と同じインデックス

// resize()より前に状態変数を宣言しておく。resize()は定義直後に同期呼び出しされるが、
// Task 3でresize()内からmodelRootを参照するようになるため、let宣言がその時点で
// 初期化済み(TDZを抜けている)である必要がある。
let mixer = null;
let clips = [];
let modelRoot = null;
const clock = new THREE.Clock();

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  const aspect = width / height;
  const halfH = FRUSTUM_HEIGHT / 2;
  const halfW = halfH * aspect;
  camera.left = -halfW;
  camera.right = halfW;
  camera.top = halfH;
  camera.bottom = -halfH;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

new GLTFLoader().load('model.glb', (gltf) => {
  modelRoot = gltf.scene;
  clips = gltf.animations;

  const box = new THREE.Box3().setFromObject(modelRoot);
  const size = new THREE.Vector3();
  box.getSize(size);
  const scale = TARGET_HEIGHT / size.y;
  modelRoot.scale.setScalar(scale);

  // スケール後に再度バウンディングボックスを取り、足元がy=0に来るよう位置補正する
  const scaledBox = new THREE.Box3().setFromObject(modelRoot);
  modelRoot.position.y -= scaledBox.min.y;

  scene.add(modelRoot);

  mixer = new THREE.AnimationMixer(modelRoot);
  playClip(IDLE_CLIP_INDEX, true);

  requestAnimationFrame(animate);
}, undefined, (error) => {
  console.error('mascot.js: model.glbの読み込みに失敗しました', error);
  const message = document.createElement('div');
  message.textContent = '読み込みに失敗しました';
  message.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#666;';
  document.body.appendChild(message);
});

function playClip(index, loop) {
  const clip = clips[index];
  if (!clip || !mixer) return null;
  const action = mixer.clipAction(clip);
  action.reset();
  action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
  action.clampWhenFinished = !loop;
  action.fadeIn(0.2);
  action.play();
  return action;
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);
  renderer.render(scene, camera);
}
```

- [ ] **Step 3: Previewツールで表示を確認する**

Preview toolの`preview_start`（launch.jsonの`vrc-mascot-pwa`設定を使用、既存の`python -m http.server 8765`）でサーバーを起動し、`preview_screenshot`を撮る。

Expected: 画面中央にアバターが立った状態で表示され、待機アニメーションがループ再生されている（静止画では分かりにくいが`preview_eval`で`Date.now()`を挟んで2回スクリーンショットを撮り、ポーズがわずかに変化していれば再生されている）。エラーが出ていないことを`preview_console_logs`で確認する。

- [ ] **Step 4: commit**

```bash
git add index.html mascot.js
git commit -m "feat: model-viewerをthree.jsベースのcanvas表示に置き換え"
```

---

### Task 3: 自由徘徊の状態機械（静止→移動→静止）を実装する

**Files:**
- Modify: `mascot.js`

- [ ] **Step 1: mascot.jsに状態機械・移動範囲計算・アニメーションループへの組み込みを追加する**

`const clock = new THREE.Clock();` の直後に以下を追加する:

```javascript
const STATE = { IDLE: 'idle', MOVING: 'moving', DRAGGING: 'dragging', REACTING: 'reacting' };
let state = STATE.IDLE;
let stateTimer = 0;
const target = new THREE.Vector3();
const MOVE_SPEED = 1.2; // ワールド単位/秒

function getWorldBounds() {
  const style = getComputedStyle(document.documentElement);
  const px = (name) => parseFloat(style.getPropertyValue(name)) || 0;
  const insetTop = px('--sat');
  const insetRight = px('--sar');
  const insetBottom = px('--sab');
  const insetLeft = px('--sal');

  const worldPerPxX = (camera.right - camera.left) / window.innerWidth;
  const worldPerPxY = (camera.top - camera.bottom) / window.innerHeight;

  // キャラの見た目の半分程度を余白として確保し、画面端・セーフエリアに食い込まないようにする。
  // 実機で見て狭すぎ/広すぎる場合はこの係数(0.35 / 0.5)をTask 8の確認時に調整する。
  const halfCharWidth = TARGET_HEIGHT * 0.35;
  const halfCharHeight = TARGET_HEIGHT * 0.5;

  return {
    minX: camera.left + insetLeft * worldPerPxX + halfCharWidth,
    maxX: camera.right - insetRight * worldPerPxX - halfCharWidth,
    minY: camera.bottom + insetBottom * worldPerPxY + halfCharHeight,
    maxY: camera.top - insetTop * worldPerPxY - halfCharHeight,
  };
}

function randomIdleDuration() {
  return THREE.MathUtils.randFloat(2, 8); // 静止時間: 2〜8秒のランダム
}

function pickNewTarget() {
  const b = getWorldBounds();
  target.set(
    THREE.MathUtils.randFloat(b.minX, b.maxX),
    THREE.MathUtils.randFloat(b.minY, b.maxY),
    0
  );
}

function updateWander(delta) {
  if (!modelRoot) return;
  if (state === STATE.IDLE) {
    stateTimer -= delta;
    if (stateTimer <= 0) {
      pickNewTarget();
      state = STATE.MOVING;
    }
  } else if (state === STATE.MOVING) {
    const pos = modelRoot.position;
    const dx = target.x - pos.x;
    const dy = target.y - pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.02) {
      pos.x = target.x;
      pos.y = target.y;
      state = STATE.IDLE;
      stateTimer = randomIdleDuration();
    } else {
      const step = Math.min(MOVE_SPEED * delta, dist);
      pos.x += (dx / dist) * step;
      pos.y += (dy / dist) * step;
    }
  }
}
```

- [ ] **Step 2: リサイズ・画面回転時に、キャラが新しい表示範囲外に出ていたら範囲内へ補正する**

Task 2で追加した`resize()`関数の末尾（`camera.updateProjectionMatrix();`の直後）に以下を追加する:

```javascript
  if (modelRoot) {
    const b = getWorldBounds();
    modelRoot.position.x = THREE.MathUtils.clamp(modelRoot.position.x, b.minX, b.maxX);
    modelRoot.position.y = THREE.MathUtils.clamp(modelRoot.position.y, b.minY, b.maxY);
  }
```

（`getWorldBounds`はこのStepより前の関数なので参照可能。`resize()`はTask 2で`window.addEventListener('resize', resize);`済みのため、追加コードだけで画面回転・リサイズ時の補正が有効になる）

- [ ] **Step 3: GLTFLoaderのロード成功コールバック内、`playClip(IDLE_CLIP_INDEX, true);`の直後に初期タイマーを設定する**

```javascript
  playClip(IDLE_CLIP_INDEX, true);
  stateTimer = randomIdleDuration();
```

- [ ] **Step 4: animate()関数を書き換え、updateWanderを呼び出す**

```javascript
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);
  if (state === STATE.IDLE || state === STATE.MOVING) {
    updateWander(delta);
  }
  renderer.render(scene, camera);
}
```

- [ ] **Step 5: Previewツールで徘徊動作を確認する**

`preview_start`でサーバーを起動し、ページをロードした直後に`preview_eval`で`modelRoot`の位置を読む（`mascot.js`はモジュールなので、確認用に`window.__mascotDebug = { get pos() { return modelRoot.position.clone(); }, get state() { return state; } };`を一時的に`animate`関数の直前に追記してから確認し、確認後に削除する）。

```javascript
// mascot.js の animate() 定義の直前に一時的に追加
window.__mascotDebug = {
  get pos() { return modelRoot ? modelRoot.position.clone() : null; },
  get state() { return state; },
};
```

`preview_eval`で以下を実行し、10秒待って再度読む:

```javascript
window.__mascotDebug.pos
```

Expected: 10秒後の値が最初の値と異なる（＝実際に移動している）。`window.__mascotDebug.state`が`'idle'`と`'moving'`を行き来していることも確認する。確認できたらデバッグ用の`window.__mascotDebug`追記は削除する。

- [ ] **Step 6: commit**

```bash
git add mascot.js
git commit -m "feat: 自由徘徊の状態機械（静止→移動→静止）を追加"
```

---

### Task 4: 移動方向への回転（向き）を実装する

**Files:**
- Modify: `mascot.js`

- [ ] **Step 1: `updateWander`内の移動処理に回転を追加する**

`updateWander`関数内の`else`ブロック（移動中の処理）を以下に置き換える:

```javascript
    } else {
      const step = Math.min(MOVE_SPEED * delta, dist);
      pos.x += (dx / dist) * step;
      pos.y += (dy / dist) * step;
      updateFacing(dx, dy);
    }
```

`updateWander`関数の直後に以下を追加する:

```javascript
function updateFacing(dx, dy) {
  // カメラが正面固定で奥行き方向の移動が無いため、画面内の移動ベクトル(dx, dy)を
  // (x, z)相当とみなしてY軸回転角を求める簡略化を行っている。物理的な正確さより
  // 「動いている方向になんとなく体を向ける」自然さを優先した実装。
  if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) return;
  if (!modelRoot) return;
  modelRoot.rotation.y = Math.atan2(dx, dy);
}
```

- [ ] **Step 2: Previewツールで回転を確認する**

Task 3のStep 5と同じ要領で`window.__mascotDebug`に`get rotY() { return modelRoot ? modelRoot.rotation.y : null; }`を追加し、移動中（`state === 'moving'`のとき）に`rotY`が0以外の値になることを確認する。確認後、デバッグ用コードを削除する。

- [ ] **Step 3: commit**

```bash
git add mascot.js
git commit -m "feat: 移動方向に応じてY軸回転で向きを変える"
```

---

### Task 5: タップ反応（バウンス＋アニメ切替）を実装する

**Files:**
- Modify: `mascot.js`

- [ ] **Step 1: ポインター入力の判定用ステートと定数を追加する**

`const MOVE_SPEED = 1.2;`の下に追加:

```javascript
let pointerDownPos = null;
let pointerDownTime = 0;
let isDragging = false;
const TAP_MOVE_THRESHOLD = 8; // px: これ以下の移動ならタップ扱い
const TAP_TIME_THRESHOLD = 300; // ms: これ以下の押下時間ならタップ扱い
const DRAG_START_THRESHOLD = 12; // px: これを超えたらドラッグ開始とみなす
```

- [ ] **Step 2: タップ反応処理を追加する**

ファイル末尾に追加:

```javascript
function handleTap() {
  if (state === STATE.DRAGGING || !modelRoot || clips.length === 0) return;
  state = STATE.REACTING;

  const reactionPool = clips.map((_, i) => i).filter((i) => i !== IDLE_CLIP_INDEX);
  const nextIndex = reactionPool.length > 0
    ? reactionPool[Math.floor(Math.random() * reactionPool.length)]
    : IDLE_CLIP_INDEX;
  playClip(nextIndex, false);
  bounce();

  const clip = clips[nextIndex];
  const durationMs = (clip ? clip.duration : 1) * 1000;
  setTimeout(() => {
    playClip(IDLE_CLIP_INDEX, true);
    state = STATE.IDLE;
    stateTimer = randomIdleDuration();
  }, durationMs);
}

function bounce() {
  if (!modelRoot) return;
  if (navigator.vibrate) navigator.vibrate(50);
  const baseScale = modelRoot.scale.x;
  modelRoot.scale.setScalar(baseScale * 1.08);
  setTimeout(() => {
    if (modelRoot) modelRoot.scale.setScalar(baseScale);
  }, 150);
}

canvas.addEventListener('pointerdown', (e) => {
  pointerDownPos = { x: e.clientX, y: e.clientY };
  pointerDownTime = performance.now();
  isDragging = false;
});

canvas.addEventListener('pointerup', (e) => {
  if (!pointerDownPos) return;
  const dx = e.clientX - pointerDownPos.x;
  const dy = e.clientY - pointerDownPos.y;
  const dist = Math.hypot(dx, dy);
  const elapsed = performance.now() - pointerDownTime;

  if (!isDragging && dist <= TAP_MOVE_THRESHOLD && elapsed <= TAP_TIME_THRESHOLD) {
    handleTap();
  }
  pointerDownPos = null;
});
```

（ドラッグの実処理はTask 6で追加する。ここでは`isDragging`は常に`false`のままなので、タップ判定のみが動く）

- [ ] **Step 3: Previewツールでタップ反応を確認する**

`preview_start`でサーバー起動後、`preview_click`で`#stage`をクリックし、`preview_eval`で`window.__mascotDebug.state`（Task 3のデバッグコードを一時的に再追加して使う）を読んで`'reacting'`になっていること、数秒後に`'idle'`へ戻ることを確認する。`preview_screenshot`でバウンス演出（一瞬拡大する）も確認する。確認後、デバッグ用コードを削除する。

- [ ] **Step 4: commit**

```bash
git add mascot.js
git commit -m "feat: タップでバウンス演出とアニメ切替を行う"
```

---

### Task 6: ドラッグ操作を実装する

**Files:**
- Modify: `mascot.js`

- [ ] **Step 1: 画面ピクセル座標→ワールド座標の変換関数を追加する**

`function getWorldBounds() {`の直前に追加:

```javascript
function screenToWorld(xPx, yPx) {
  const worldX = (xPx / window.innerWidth) * (camera.right - camera.left) + camera.left;
  const worldY = -(yPx / window.innerHeight) * (camera.top - camera.bottom) + camera.top;
  return { x: worldX, y: worldY };
}
```

- [ ] **Step 2: pointerdown/pointerupハンドラーを書き換え、pointermoveハンドラーを追加する**

既存の`canvas.addEventListener('pointerdown', ...)`を以下に置き換える:

```javascript
canvas.addEventListener('pointerdown', (e) => {
  pointerDownPos = { x: e.clientX, y: e.clientY };
  pointerDownTime = performance.now();
  isDragging = false;
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointerDownPos || !modelRoot) return;
  const dx = e.clientX - pointerDownPos.x;
  const dy = e.clientY - pointerDownPos.y;
  const dist = Math.hypot(dx, dy);

  if (!isDragging && dist > DRAG_START_THRESHOLD) {
    isDragging = true;
    state = STATE.DRAGGING;
    canvas.setPointerCapture(e.pointerId);
  }

  if (isDragging) {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    modelRoot.position.x = worldPos.x;
    modelRoot.position.y = worldPos.y;
  }
});
```

既存の`canvas.addEventListener('pointerup', ...)`を以下に置き換える:

```javascript
canvas.addEventListener('pointerup', (e) => {
  if (!pointerDownPos) return;
  const dx = e.clientX - pointerDownPos.x;
  const dy = e.clientY - pointerDownPos.y;
  const dist = Math.hypot(dx, dy);
  const elapsed = performance.now() - pointerDownTime;

  if (isDragging) {
    isDragging = false;
    state = STATE.IDLE;
    stateTimer = randomIdleDuration();
  } else if (dist <= TAP_MOVE_THRESHOLD && elapsed <= TAP_TIME_THRESHOLD) {
    handleTap();
  }
  pointerDownPos = null;
});
```

- [ ] **Step 3: Previewツールでドラッグ動作を確認する**

`preview_eval`でpointerイベントを合成して発火させる（`preview_click`はドラッグを表現できないため、`preview_eval`で`PointerEvent`を直接dispatchする）:

```javascript
(async () => {
  const el = document.getElementById('stage');
  const down = new PointerEvent('pointerdown', { clientX: 100, clientY: 400, pointerId: 1, bubbles: true });
  el.dispatchEvent(down);
  const move = new PointerEvent('pointermove', { clientX: 250, clientY: 200, pointerId: 1, bubbles: true });
  el.dispatchEvent(move);
  await new Promise(r => setTimeout(r, 50));
  const upEvt = new PointerEvent('pointerup', { clientX: 250, clientY: 200, pointerId: 1, bubbles: true });
  el.dispatchEvent(upEvt);
  return window.__mascotDebug ? window.__mascotDebug.state : 'no debug hook';
})()
```

Expected: ドラッグ中は`state`が`'dragging'`になり、pointerupで`'idle'`に戻る。（`window.__mascotDebug`はTask 3同様に一時的に追加してから使い、確認後に削除する）

- [ ] **Step 4: commit**

```bash
git add mascot.js
git commit -m "feat: ドラッグでの手動移動に対応"
```

---

### Task 7: AR機能を廃止し、アセット・キャッシュを整理する

**Files:**
- Modify: `sw.js`
- Delete: `model.usdz`
- Modify: `README.md`

- [ ] **Step 1: model.usdzを削除する**

```bash
cd "C:\Users\PC_User\Documents\vrc-mascot-pwa"
git rm model.usdz
```

- [ ] **Step 2: sw.jsを書き換える**

`sw.js`全体を以下に置き換える:

```javascript
const CACHE_VERSION = 'mascot-cache-v7';

const CACHE_URLS = [
  './',
  './index.html',
  './mascot.js',
  './manifest.json',
  './model.glb',
  './vendor/three.module.js',
  './vendor/loaders/GLTFLoader.js',
  './vendor/utils/BufferGeometryUtils.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await cache.addAll(CACHE_URLS);
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;

      const response = await fetch(event.request);
      const cache = await caches.open(CACHE_VERSION);
      cache.put(event.request, response.clone());
      return response;
    })()
  );
});
```

（`CDN_URL`のprefetchブロックを削除した。model-viewerのCDN依存が無くなったため）

- [ ] **Step 3: README.mdからAR関連の記述を除去し、three.js vendoringに関する記述を追加する**

以下の箇所をそれぞれ置き換える。

**「仕組み」図（AR Quick Look対応の削除）:**

置換前:
```
ホーム画面のアイコンから起動 → 全画面表示 → タップでバウンド反応 + AR Quick Look対応
```

置換後:
```
ホーム画面のアイコンから起動 → 全画面表示 → タップでバウンド反応 + 自由に画面内を徘徊
```

**ファイル構成表:**

置換前:
```
vrc-mascot-pwa/
├── index.html              # model-viewer + タップ反応スクリプト
├── manifest.json           # PWA設定（scope・display等）
├── model.glb               # 通常3D表示用（全ブラウザ対応）
├── model.usdz               # iOS AR Quick Look用
├── icons/
│   ├── icon-192.png        # ホーム画面アイコン（192x192）
│   └── icon-512.png        # スプラッシュ画面等用（512x512）
└── README.md               # このファイル
```

置換後:
```
vrc-mascot-pwa/
├── index.html              # canvas + import map
├── mascot.js                # three.jsシーン・自律徘徊の状態機械・タップ/ドラッグ処理
├── vendor/                  # three.js本体（ローカル同梱、オフラインキャッシュ用）
│   ├── three.module.js
│   ├── loaders/GLTFLoader.js
│   └── utils/BufferGeometryUtils.js
├── manifest.json           # PWA設定（scope・display等）
├── model.glb               # 3Dモデル本体（idle/wave/danceの3アニメーションを内包）
├── icons/
│   ├── icon-192.png        # ホーム画面アイコン（192x192）
│   └── icon-512.png        # スプラッシュ画面等用（512x512）
└── README.md               # このファイル
```

**「Step 1: アバターモデルの入れ替え」のコピーコマンド（`model.usdz`のコピーを削除）:**

置換前:
```bash
cp "C:\Users\PC_User\Documents\ar-avatar-demo\model.glb" "C:\Users\PC_User\Documents\vrc-mascot-pwa\model.glb"
cp "C:\Users\PC_User\Documents\ar-avatar-demo\model.usdz" "C:\Users\PC_User\Documents\vrc-mascot-pwa\model.usdz"
```

置換後:
```bash
cp "C:\Users\PC_User\Documents\ar-avatar-demo\model.glb" "C:\Users\PC_User\Documents\vrc-mascot-pwa\model.glb"
```

**「Step 2: ローカルプレビューでアイコン用画像をキャプチャ」のコンソールスクリプト（model-viewerのシャドウDOM回避策が不要になったため簡略化）:**

置換前:
```javascript
// model-viewer を一時停止し、カメラを調整して正面顔の画像を取得
mascot.pause();
mascot.cameraOrbit = "0deg 0deg auto";
mascot.fieldOfView = "25deg";
mascot.currentTime = 0;

// 少し待ってレンダリング完了後、キャプチャ取得
// 注意: model-viewer の実際のWebGL canvasはシャドウDOM内にあるため、
// document.getElementById('mascot').querySelector('canvas') では取得できない
// (querySelectorはシャドウDOM境界を貫通しないため null が返り、エラーになる)。
// model-viewer 要素自身が公開している toDataURL() を直接呼び出すこと。
setTimeout(() => {
  const dataUrl = mascot.toDataURL('image/png');
  console.log(dataUrl);
}, 500);
```

置換後:
```javascript
// three.js化により <canvas id="stage"> がそのままWebGLキャンバスなので、
// シャドウDOM越しのアクセスは不要。直接 toDataURL() を呼べる。
setTimeout(() => {
  const dataUrl = document.getElementById('stage').toDataURL('image/png');
  console.log(dataUrl);
}, 500);
```

**「Step 4: GitHub Pagesにデプロイ」のgit addコマンド（`model.usdz`を除去）:**

置換前:
```bash
git add model.glb model.usdz icons/icon-512.png icons/icon-192.png
```

置換後:
```bash
git add model.glb icons/icon-512.png icons/icon-192.png
```

**「Step 6: iPhoneで「ホーム画面に追加」」のチェック項目（AR Quick Look確認の削除）:**

置換前:
```
1. 3Dモデルが表示される
2. タップするとスケール変化（バウンド反応）が起こる
3. 「ARで見る」ボタンをタップ → AR Quick Lookが起動 → 床に配置してアニメーション確認
4. Safari右下のシェアボタン → 「ホーム画面に追加」
5. ホーム画面のアイコンをタップして起動 → 全画面表示 → タップ反応・AR機能が使える
```

置換後:
```
1. 3Dモデルが表示される
2. タップするとバウンス演出が起こる
3. 指でつまむとドラッグでき、離すとまた自律的に動き出す
4. Safari右下のシェアボタン → 「ホーム画面に追加」
5. ホーム画面のアイコンをタップして起動 → 全画面表示 → 自律徘徊・タップ反応・ドラッグが使える
```

**「既知の制限・注意点」のリスト:**

置換前:
```
- **iOS Safari（PWA / AR Quick Look）専用** — Android非対応
- **真のシステム壁紙ではない** — Appleの制約上、サードパーティアプリによるライブ壁紙は不可能です。あくまで「ホーム画面のアイコンから開くと全画面表示されるWebアプリ」です
- **アニメーションはタップで順送り切り替え** — `model.glb`に複数のアニメーションクリップが入っている場合、タップのたびに次のクリップへ自動で切り替わります（`mascot.availableAnimations`のインデックス順）。選択メニュー等のUIはありません
- **初回起動のみネットワーク接続が必要** — `sw.js` によるService Workerキャッシュを導入済み。2回目以降はオフラインでも起動できます（Step 5参照）
- **キャッシュ更新には最短でも2回の起動が必要** — Service Workerの仕組み上、アバターを差し替えた直後の1回目の起動ではまだ古いキャッシュが使われることがあります
```

置換後:
```
- **iOS Safari（PWA）専用** — Android非対応（未検証）
- **アプリを開いている間だけ動く** — OSのホーム画面や他アプリの上に常駐して動き回ることはできません（iOSのサードパーティアプリには許可されていない領域のため）。あくまで「このPWAを開いている画面の中で」アバターが自律的に動き回ります
- **タップは毎回ランダムなリアクション** — タップするたびに、待機アニメーション以外のクリップからランダムに1つ再生し、終わるとまた自律徘徊に戻ります。選択メニュー等のUIはありません
- **初回起動のみネットワーク接続が必要** — `sw.js` によるService Workerキャッシュを導入済み。2回目以降はオフラインでも起動できます（Step 5参照）
- **キャッシュ更新には最短でも2回の起動が必要** — Service Workerの仕組み上、アバターを差し替えた直後の1回目の起動ではまだ古いキャッシュが使われることがあります
```

**「実装メモ」の「AR ボタンのタップ反応二重トリガー対策」節（見出しから次の見出しの直前までを丸ごと削除）:**

削除対象の見出しと本文全体:
```
### AR ボタンのタップ反応二重トリガー対策

デスクトップブラウザでテスト中、AR が利用できない環境ではAR ボタンが表示されないという仕様が判明しました。具体的には：

- AR 対応デバイス（iPhone実機）では、`<model-viewer>` の `ar-button` slot にボタンが描画される
- AR 非対応環境（デスクトップブラウザ等）では、`canActivateAR === false` のため slot 要素自体が 0×0 で折りたたまれる

そのため、デスクトップでは「ARボタンがあるはずの位置」にクリックが着地しても、実は `<model-viewer>` キャンバス上をクリックしているため、正しくマスコットのバウンス反応が発火します。これは **不具合ではなく仕様通りの動作** です。

ただし、**二重トリガー防止のため、以下の防御を実装しました**：

1. `#ar-button` 要素に直接 `click` リスナーを付け、`event.stopPropagation()` で bubbling を止める
   - AR ボタン自体がクリックされた場合、このリスナーが最優先で event を消費する

2. マスコットの click ハンドラーで `event.target.closest('#ar-button')` をチェック（defense in depth）

**テストのコツ：** AR ボタンが実際に機能しているかは **実AR対応デバイス（iPhone実機）でのみ確認** してください。デスクトップブラウザでは AR ボタンそのものが存在しないため、この実装の真価は測れません。
```

削除後は、直前の「### アイコン生成プロセス（実装時の具体的手順）」節の直後に「### `reacting` フラグの確実なリセット」節が続く形になる（間の節が丸ごと無くなる）。

**「実装メモ」の「`reacting` フラグの確実なリセット」節（FOV操作前提の記述のため、新実装に合わせて全文差し替え）:**

置換前:
```
### `reacting` フラグの確実なリセット

タップ反応時のFOV操作（ズーム）で予期しないエラーが発生した場合、マスコットが永続的に反応不能になるのを防ぐため、以下を実装しました：

- タップハンドラーの FOV 操作を `try/finally` で囲み、`finally` ブロック内で **必ず** `setTimeout` をスケジュール
- この `setTimeout` 内で `reacting` フラグをリセット、CSS の `.tapped` クラスを削除
- `getFieldOfView()` / `fieldOfView` setter がエラーを投げても、フラグリセットは発火するため、UI が固まらない
```

置換後:
```
### タップ反応中の状態管理

three.js化に伴い、タップ反応は「カメラのFOVを操作する」旧実装から「`state`を`STATE.REACTING`にし、再生したクリップの`duration`分だけ`setTimeout`で待ってから`STATE.IDLE`に戻す」方式に変更した。クリップの長さに応じて反応時間が自動的に決まるため、アニメーションを差し替えても待ち時間を手動調整する必要がない。
```

- [ ] **Step 4: Previewツールでオフラインキャッシュを確認する**

`preview_start`でサーバーを起動し、ページを一度ロードした後、`preview_network`で`sw.js`経由のリクエストが発生していること、`model.usdz`へのリクエストが存在しないことを確認する。`preview_logs`で`Service Worker`関連のエラーが出ていないか確認する。

- [ ] **Step 5: commit**

```bash
git add sw.js model.usdz README.md
git commit -m "feat: AR機能を廃止しキャッシュ対象・READMEを整理"
```

---

### Task 8: 最終通し確認

**Files:** なし（動作確認のみ）

- [ ] **Step 1: Previewツールをモバイルビューポートに設定し、一連の動作を確認する**

`preview_resize`で`mobile`プリセット（375x812）に設定した上で、以下を確認する:

1. 起動直後、アバターが画面中央付近に表示され、待機アニメーションが流れている（`preview_screenshot`）
2. しばらく待つと自律的に画面内を移動する（Task 3のデバッグ手法で位置変化を確認、または複数回`preview_screenshot`を撮り位置差分を目視）
3. `preview_click`で`#stage`をタップするとバウンス演出が起きる
4. Task 6のPointerEvent合成手法でドラッグを再現し、追従することを確認する
5. `preview_console_logs`でエラーが出ていないことを確認する
6. `preview_resize`で幅を変えて（例: 320x568の小さいiPhone SEサイズ）、キャラが画面外にはみ出さないことを確認する

- [ ] **Step 2: 気になった調整（速度・待機時間・余白係数など）があれば、該当箇所の定数を微調整しコミットする**

Task 3で導入した`MOVE_SPEED`・`randomIdleDuration()`の範囲・`getWorldBounds()`内の`halfCharWidth`/`halfCharHeight`係数が調整候補。

- [ ] **Step 3: 最終コミット**

```bash
git add -A
git commit -m "polish: 自律徘徊マスコットの動作パラメータを調整"
```

（Step 2で調整が無かった場合、このコミットは不要）

---

## 実機確認について

Previewツールでの確認はデスクトップブラウザのシミュレーションであり、実際のiPhone Safari（PWAとしてホーム画面に追加した状態）での最終確認はユーザー側で行う（README「自分のアバターに差し替える手順」と同じ既存の運用パターンを踏襲）。特にService Workerのキャッシュ更新挙動（最短2回起動）とタッチ操作の感触は実機でしか判断できない。
