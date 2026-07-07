# Service Worker オフラインキャッシュ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `vrc-mascot-pwa`にバージョン管理付きCache-First Service Workerを追加し、2回目以降の起動をキャッシュから即座に行えるようにする（オフラインでも起動可能にする）。

**Architecture:** `sw.js`を新規作成し、install時に全アセット（ローカルファイル＋CDNのmodel-viewer JS）をバージョン管理されたCache Storageに保存。fetch時はキャッシュ優先で返し、なければネットワーク取得してキャッシュに追加。activate時に旧バージョンのキャッシュを削除する。

**Tech Stack:** Service Worker API, Cache Storage API（ライブラリなし、素のJS）

**確認済みの環境:**
- プロジェクトルート: `C:\Users\PC_User\Documents\vrc-mascot-pwa`（git, branch master, 直接コミットでOK — 既存プロジェクトと同じ前提）
- 既存の公開URL: `https://hasegawakasyouen.github.io/vrc-mascot-pwa/`（既にgh CLI認証済み、リポジトリ作成済みなので今回はpushのみでよい）
- Preview検証にはこのセッションの `.claude/.claude/launch.json` に既に `vrc-mascot-pwa`（ポート8768）のエントリがある

---

### Task 1: sw.js を作成する

**Files:**
- Create: `C:\Users\PC_User\Documents\vrc-mascot-pwa\sw.js`

- [ ] **Step 1: sw.jsを書く**

```javascript
const CACHE_VERSION = 'mascot-cache-v1';

const CACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './model.glb',
  './model.usdz',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

const CDN_URL = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await cache.addAll(CACHE_URLS);
      try {
        await cache.add(CDN_URL);
      } catch (err) {
        // CDNが初回インストール時に到達不能でも、ローカルアセットのキャッシュは成立させる。
        // CDN分は次回オンライン時の通常fetch経由でキャッシュされる。
        console.warn('sw.js: CDN prefetch failed, will cache on next successful fetch:', err);
      }
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

**設計メモ（実装者向け）:**
- `CACHE_VERSION` を将来アバターを差し替えるたびに `'mascot-cache-v2'` のように上げることで、古いキャッシュされたモデルを新しいものに切り替える（Task 6で README にこの手順を明記する）
- `fetch` イベントは GET 以外を素通しする（このサイトは静的なので実質GETのみだが、念のためのガード）
- `event.respondWith` 内で例外が発生した場合（＝ネットワークもキャッシュもない、真の初回オフラインアクセス）は、素のネットワークエラーがそのまま伝播する。これは設計通りの許容範囲（スコープ外の初回オフライン起動）

- [ ] **Step 2: コミット**

```bash
cd "C:\Users\PC_User\Documents\vrc-mascot-pwa"
git add sw.js
git commit -m "feat: add versioned cache-first service worker for offline support"
```

---

### Task 2: index.htmlにSW登録コードを追加する

**Files:**
- Modify: `C:\Users\PC_User\Documents\vrc-mascot-pwa\index.html`

- [ ] **Step 1: 既存の `<script>` タグの直後（`</script>`の後、`</body>`の前）に以下を追加する**

```html
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js');
      });
    }
  </script>
```

**重要:** 既存のタップリアクション用の `<script>` タグの中身は一切変更しないこと。新しい `<script>` タグを追加するだけ。

- [ ] **Step 2: コミット**

```bash
cd "C:\Users\PC_User\Documents\vrc-mascot-pwa"
git add index.html
git commit -m "feat: register service worker on page load"
```

---

### Task 3: ローカルでService Workerの動作を確認する

**Files:** なし

- [ ] **Step 1: プレビューサーバーをリロードし、Service Workerの登録状態を確認する**

実行者（エージェント）は既存の `vrc-mascot-pwa` プレビューサーバーでページをリロードし、`preview_eval` で以下を実行して登録状態を確認する:

```javascript
navigator.serviceWorker.getRegistrations().then(regs =>
  regs.map(r => ({ scope: r.scope, active: !!r.active, activeState: r.active && r.active.state }))
)
```

Expected: 1件の登録があり、`activeState` が `"activated"` になっている（登録直後は `"activating"` の場合があるため、必要なら少し待って再確認する）

- [ ] **Step 2: Cache Storageに想定したURLがキャッシュされているか確認する**

```javascript
caches.open('mascot-cache-v1').then(cache =>
  cache.keys().then(keys => keys.map(k => k.url))
)
```

Expected: `model.glb`、`model.usdz`、`manifest.json`、`icons/icon-192.png`、`icons/icon-512.png`、`index.html`、CDNのmodel-viewer JSのURLが含まれている

- [ ] **Step 3: オフライン相当の動作を確認する**

`preview_eval` で `fetch` をモックできない場合は、Cache Storageから直接該当リクエストが返るか確認する形でよい:

```javascript
caches.match('./model.glb').then(res => ({ found: !!res, status: res && res.status }))
```

Expected: `found: true`

- [ ] **Step 4: 問題があれば修正**

登録されていない、あるいはキャッシュに想定したURLが無い場合は `sw.js` を見直す。

---

### Task 4: GitHub Pagesへpushする

**Files:** なし

- [ ] **Step 1: pushする（リポジトリは既存のものを使う。新規作成は不要）**

```bash
cd "C:\Users\PC_User\Documents\vrc-mascot-pwa"
git push
```

- [ ] **Step 2: 公開サイトが更新されたか確認する**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://hasegawakasyouen.github.io/vrc-mascot-pwa/sw.js
```

Expected: 200（GitHub Pagesの反映まで数分かかることがある）

---

### Task 5: iPhone実機で機内モード起動を確認する（手動）

この工程はWindows環境からは実行できないため、実機での確認手順のみ示す。

**Files:** なし

- [ ] **Step 1: iPhoneのSafariで公開URLを開き、一度読み込ませる（Service Workerの初回インストールのため）**

`https://hasegawakasyouen.github.io/vrc-mascot-pwa/` を開き、正常に表示されることを確認

- [ ] **Step 2: ページを閉じて、機内モードをオンにする**

- [ ] **Step 3: 再度Safariで同じURLを開く（または既にホーム画面に追加済みならそのアイコンから起動）**

正常にアバターが表示され、アニメーションが再生されることを確認する（ネットワーク接続なしで起動できることの確認）

- [ ] **Step 4: 機内モードを解除する**

- [ ] **Step 5: 問題があれば記録**

うまくいかない場合、症状（真っ白のまま/エラー表示等）をメモする

---

### Task 6: READMEにキャッシュ更新手順を追記する

**Files:**
- Modify: `C:\Users\PC_User\Documents\vrc-mascot-pwa\README.md`

- [ ] **Step 1: 「自分のアバターに差し替える手順」セクションの最後（Step 4の後、既存の「既知の制限・注意点」セクションの前）に以下を追記する**

```markdown
### Step 5: キャッシュバージョンを更新する（Service Worker）

このプロジェクトは Service Worker（`sw.js`）でアセットをキャッシュしており、起動が高速になる代わりに、アバターを差し替えても古いキャッシュが表示され続けることがあります。差し替え後は必ず以下を行ってください:

1. `sw.js` 冒頭の `CACHE_VERSION` を上げる（例: `'mascot-cache-v1'` → `'mascot-cache-v2'`）
2. コミット・push する

```bash
git add sw.js
git commit -m "chore: bump cache version after avatar update"
git push
```

ブラウザは `sw.js` のバイト列が変わったことを検知して新しいService Workerをインストールし、次回起動時（最短で2回目の起動）に新しいキャッシュへ切り替わります。即座に反映したい場合は、iPhoneのSafariでページを2回続けて開き直してください。
```

- [ ] **Step 2: 「既知の制限・注意点」セクションに以下の1行を追加する**

```markdown
- **キャッシュ更新には最短でも2回の起動が必要** — Service Workerの仕組み上、アバターを差し替えた直後の1回目の起動ではまだ古いキャッシュが使われることがあります
```

- [ ] **Step 3: コミット・push**

```bash
cd "C:\Users\PC_User\Documents\vrc-mascot-pwa"
git add README.md
git commit -m "docs: document service worker cache version bump procedure"
git push
```

---

## Self-Review メモ

- **Spec網羅性**: design spec の各セクション（ファイル構成/キャッシュ対象・バージョン管理/エラーハンドリング/動作確認）に対応するTaskをすべて用意した
- **プレースホルダ**: 「TBD」「後で」は含まない
- **型/名称の一貫性**: `CACHE_VERSION = 'mascot-cache-v1'` はTask 1（sw.js作成）とTask 3（ローカル確認のCache Storage名）、Task 6（README更新手順の例）で一貫している
