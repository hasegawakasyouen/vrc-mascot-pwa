# Service Worker オフラインキャッシュ 設計書

- 日付: 2026-07-08
- ステータス: 承認済み（brainstormingフェーズ完了）

## 背景・目的

現状の `vrc-mascot-pwa` はホーム画面から起動するたびに `model.glb`（約6.4MB）/`model.usdz`（約8.4MB）を含む全アセットをネットワークから再取得している。Service Workerによるオフラインキャッシュを導入し、2回目以降の起動を高速化し、ネットワークが不安定な場所でも起動できるようにする。

## 前提・制約

- ビルド工程を持たない静的サイトという方針を維持する（Workbox等のライブラリは導入しない）
- 起動の速さを優先する（キャッシュ優先。オンライン時でも常に最新を確認しにいく方式は採用しない）
- 真の初回オフライン起動（一度もオンラインで開いたことがない状態）はサポートしない

## ファイル構成・登録方法

```
vrc-mascot-pwa/
├── sw.js                # 新規: Service Worker本体
├── index.html           # 変更: SW登録スクリプトを追加
└── (既存ファイルは変更なし)
```

`index.html` の末尾（既存の `<script>` の後）に以下を追加する:

```javascript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js');
  });
}
```

## キャッシュ対象とバージョン管理

`sw.js` 冒頭でバージョン文字列とキャッシュ対象URLリストを定義する:

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
  'https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js',
];
```

- **install時**: `CACHE_URLS` を全て `CACHE_VERSION` という名前のCacheに保存する
- **fetch時**: リクエストされたURLがキャッシュにあればキャッシュを即返す（cache-first）。キャッシュになければネットワークから取得し、成功したらキャッシュにも保存する
- **activate時**: `CACHE_VERSION` と一致しない古いキャッシュを削除し、`clients.claim()` で既に開いているページも即座に新しいSWの管理下に入れる

**将来アバターを差し替えたときの手順**: `model.glb`/`model.usdz` 等を更新したら、`sw.js` の `CACHE_VERSION` を `'mascot-cache-v2'` のように上げる。ブラウザがバイト列の変わった `sw.js` を検知して新しいSWをインストールし、次回起動時（最短で2回目の起動）に新しいキャッシュへ切り替わる。CDNのmodel-viewer JSはバージョン3.5.0に固定しているため通常は変わらないが、同じ仕組みでキャッシュされる。

## エラーハンドリング

- CDN（`ajax.googleapis.com`）が初回インストール時に到達不能だった場合に備え、CDNのURLだけ `cache.add()` を個別に `try/catch` で囲み、失敗しても他のファイルのキャッシュは成立するようにする（部分的失敗を許容し、CDN分は次回オンライン時の通常fetch経由でキャッシュされる）
- fetchハンドラでネットワークが完全に使えず、かつキャッシュにも該当URLがない場合（＝真の初回オフラインアクセス）は、素直にネットワークエラーをそのまま返す。凝ったフォールバックUIは作らない（スコープ外）

## 動作確認方法

1. ローカルプレビューで通常通り開き、DevToolsのApplicationタブでService Workerが登録され `activated` 状態になっていることを確認
2. DevToolsのNetworkタブで「Offline」にチェックを入れてページをリロードし、キャッシュから正しく表示されることを確認（model-viewerのJS・3Dモデル・アニメーションすべて動作すること）
3. Cache Storageで `mascot-cache-v1` に想定した全URLがキャッシュされていることを確認
4. GitHub Pagesにデプロイ後、iPhoneのSafariで機内モードにしてアプリを開き、正しく起動することを確認

## スコープ外（今回やらないこと）

- キャッシュ更新のユーザー通知（「新しいバージョンがあります」等のUI）
- バックグラウンド同期・プッシュ通知
- 真の初回オフライン起動
