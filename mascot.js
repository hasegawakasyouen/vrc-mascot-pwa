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
let baseModelScale = 1;
const clock = new THREE.Clock();

const STATE = { IDLE: 'idle', MOVING: 'moving', DRAGGING: 'dragging', REACTING: 'reacting' };
let state = STATE.IDLE;
let stateTimer = 0;
const target = new THREE.Vector3();
const MOVE_SPEED = 1.2; // ワールド単位/秒

let pointerDownPos = null;
let pointerDownTime = 0;
let isDragging = false;
let activePointerId = null;
const TAP_MOVE_THRESHOLD = 8; // px: これ以下の移動ならタップ扱い
const TAP_TIME_THRESHOLD = 300; // ms: これ以下の押下時間ならタップ扱い
const DRAG_START_THRESHOLD = 12; // px: これを超えたらドラッグ開始とみなす

function screenToWorld(xPx, yPx) {
  const worldX = (xPx / window.innerWidth) * (camera.right - camera.left) + camera.left;
  const worldY = -(yPx / window.innerHeight) * (camera.top - camera.bottom) + camera.top;
  return { x: worldX, y: worldY };
}

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
      updateFacing(dx, dy);
    }
  }
}

function updateFacing(dx, dy) {
  // カメラが正面固定で奥行き方向の移動が無いため、画面内の移動ベクトル(dx, dy)を
  // (x, z)相当とみなしてY軸回転角を求める簡略化を行っている。物理的な正確さより
  // 「動いている方向になんとなく体を向ける」自然さを優先した実装。
  if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) return;
  if (!modelRoot) return;
  modelRoot.rotation.y = Math.atan2(dx, dy);
}

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
  if (modelRoot) {
    const b = getWorldBounds();
    modelRoot.position.x = THREE.MathUtils.clamp(modelRoot.position.x, b.minX, b.maxX);
    modelRoot.position.y = THREE.MathUtils.clamp(modelRoot.position.y, b.minY, b.maxY);
  }
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
  baseModelScale = scale;

  // スケール後に再度バウンディングボックスを取り、足元がy=0に来るよう位置補正する
  const scaledBox = new THREE.Box3().setFromObject(modelRoot);
  modelRoot.position.y -= scaledBox.min.y;
  modelRoot.position.x -= (scaledBox.min.x + scaledBox.max.x) / 2;
  modelRoot.position.z -= (scaledBox.min.z + scaledBox.max.z) / 2;

  scene.add(modelRoot);

  mixer = new THREE.AnimationMixer(modelRoot);
  playClip(IDLE_CLIP_INDEX, true);
  stateTimer = randomIdleDuration();

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
  if (state === STATE.IDLE || state === STATE.MOVING) {
    updateWander(delta);
  }
  renderer.render(scene, camera);
}

function handleTap() {
  if (state === STATE.DRAGGING || state === STATE.REACTING || !modelRoot || clips.length === 0) return;
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
    if (state !== STATE.REACTING) return;
    playClip(IDLE_CLIP_INDEX, true);
    state = STATE.IDLE;
    stateTimer = randomIdleDuration();
  }, durationMs);
}

function bounce() {
  if (!modelRoot) return;
  if (navigator.vibrate) navigator.vibrate(50);
  modelRoot.scale.setScalar(baseModelScale * 1.08);
  setTimeout(() => {
    if (modelRoot) modelRoot.scale.setScalar(baseModelScale);
  }, 150);
}

canvas.addEventListener('pointerdown', (e) => {
  if (activePointerId !== null) return;
  activePointerId = e.pointerId;
  pointerDownPos = { x: e.clientX, y: e.clientY };
  pointerDownTime = performance.now();
  isDragging = false;
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointerDownPos || !modelRoot) return;
  if (e.pointerId !== activePointerId) return;
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
    const b = getWorldBounds();
    modelRoot.position.x = THREE.MathUtils.clamp(worldPos.x, b.minX, b.maxX);
    modelRoot.position.y = THREE.MathUtils.clamp(worldPos.y, b.minY, b.maxY);
  }
});

canvas.addEventListener('pointerup', (e) => {
  if (!pointerDownPos) return;
  if (e.pointerId !== activePointerId) return;
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
  activePointerId = null;
});

canvas.addEventListener('pointercancel', (e) => {
  if (e.pointerId !== activePointerId) return;
  if (isDragging) {
    isDragging = false;
    state = STATE.IDLE;
    stateTimer = randomIdleDuration();
  }
  pointerDownPos = null;
  activePointerId = null;
});
