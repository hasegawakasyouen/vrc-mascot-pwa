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
  modelRoot.position.x -= (scaledBox.min.x + scaledBox.max.x) / 2;
  modelRoot.position.z -= (scaledBox.min.z + scaledBox.max.z) / 2;

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
