# VRCデスクトップマスコットPWA

VRChat改変アバターをiPhoneのホーム画面アイコンから全画面起動できるPWA。`ar-avatar-demo`の資産（`model.glb`）を流用し、three.js（ローカルvendor）で自律徘徊マスコットとして描画する。

**ステータス:** iPhone実機での動作確認済み（GitHub Pages上でライブ運用）

---

## 仕組み

このプロジェクトはサーバーレスのモバイル全画面アプリ実装です。

```
ar-avatar-demo で準備した model.glb
    ↓
three.js（ローカルvendor）による自律徘徊レンダリング
    ↓
manifest.json (PWA設定)
    ↓
iPhone Safari「ホーム画面に追加」
    ↓
ホーム画面のアイコンから起動 → 全画面表示 → タップでバウンド反応 + 自由に画面内を徘徊
```

### ファイル構成

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

---

## 自分のアバターに差し替える手順

### 前提条件

- `ar-avatar-demo` のREADME通りにステップ1〜5が完了している（`model.glb` の準備できている状態）
- Pillow（Python画像ライブラリ）がインストール済み: `pip install Pillow`
- ローカルプレビュー用にPythonのHTTPサーバーが動かせる環境

### Step 1: アバターモデルの入れ替え

1. `ar-avatar-demo` からこのプロジェクトの `model.glb` を上書きコピーする

```bash
cp "C:\Users\PC_User\Documents\ar-avatar-demo\model.glb" "C:\Users\PC_User\Documents\vrc-mascot-pwa\model.glb"
```

### Step 2: ローカルプレビューでアイコン用画像をキャプチャ

```bash
cd "C:\Users\PC_User\Documents\vrc-mascot-pwa"
python -m http.server 8080
```

ブラウザで `http://localhost:8080` を開き、以下の手順でアイコン用の画像をキャプチャします。

**ブラウザデベロッパーツール（F12）のコンソールで以下を実行:**

```javascript
// three.js化により <canvas id="stage"> がそのままWebGLキャンバスなので、
// シャドウDOM越しのアクセスは不要。直接 toDataURL() を呼べる。
setTimeout(() => {
  const dataUrl = document.getElementById('stage').toDataURL('image/png');
  console.log(dataUrl);
}, 500);
```

**コンソール出力の長い `data:image/png;base64,` で始まる文字列をすべてコピーします。**

### Step 3: Pillowでアイコン生成

以下のPythonスクリプトを実行してアイコンを生成します（three.jsのWebGL canvasは透明背景なので、不透明な背景に合成する必要があります）。

**スクリプト例:** `generate_icons.py`

```python
#!/usr/bin/env python
# -*- coding: utf-8 -*-
import base64
import io
from PIL import Image

# コンソールからコピーした data URL を貼り付け
DATA_URL = "data:image/png;base64,..."  # ← ここに上記でコピーした文字列を貼り付け

# Base64データを抽出
base64_data = DATA_URL.split(',')[1]
png_bytes = base64.b64decode(base64_data)
canvas_img = Image.open(io.BytesIO(png_bytes))

# 透明背景を不透明な背景に合成（#eeeeee = (238, 238, 238)）
background = Image.new('RGB', canvas_img.size, color=(0xee, 0xee, 0xee))
if canvas_img.mode == 'RGBA':
    background.paste(canvas_img, (0, 0), canvas_img)
else:
    background.paste(canvas_img, (0, 0))

# まず canvas_img を一度保存して実際に開き、キャラクターの頭〜上半身が
# 収まる正方形の切り抜き範囲を目視で決めること。カメラ角度やポーズによって
# 最適な座標は変わるため、汎用的な計算式では決め打ちできない。
canvas_img.save('icon_screenshot_raw.png')  # 一度保存して確認する

# 上記の画像を確認してから、実際の座標に置き換える
CROP_BOX = (0, 0, 100, 100)  # (left, top, right, bottom) ← 実際の値に置き換える
cropped = background.crop(CROP_BOX)

# 512x512、192x192 にリサイズ
icon_512 = cropped.resize((512, 512), Image.LANCZOS)
icon_192 = cropped.resize((192, 192), Image.LANCZOS)

# 保存
icon_512.save('icons/icon-512.png')
icon_192.save('icons/icon-192.png')

print("✓ icons/icon-512.png")
print("✓ icons/icon-192.png")
```

**実行:**

```bash
python generate_icons.py
```

### Step 4: GitHub Pages にデプロイ

```bash
cd "C:\Users\PC_User\Documents\vrc-mascot-pwa"
git add model.glb icons/icon-512.png icons/icon-192.png
git commit -m "update: replace avatar with new version"
git push
```

デプロイ後、`https://hasegawakasyouen.github.io/vrc-mascot-pwa/` で公開されます（ファイルとしてPushすればGitHub Pagesが自動的にServeします）。

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

### Step 6: iPhone で「ホーム画面に追加」

iPhoneのSafariで上記URLを開き、以下を確認：

1. 3Dモデルが表示される
2. タップするとバウンス演出が起こる
3. 指でつまむとドラッグでき、離すとまた自律的に動き出す
4. Safari右下のシェアボタン → 「ホーム画面に追加」
5. ホーム画面のアイコンをタップして起動 → 全画面表示 → 自律徘徊・タップ反応・ドラッグが使える

---

## 既知の制限・注意点

- **iOS Safari（PWA）専用** — Android非対応（未検証）
- **アプリを開いている間だけ動く** — OSのホーム画面や他アプリの上に常駐して動き回ることはできません（iOSのサードパーティアプリには許可されていない領域のため）。あくまで「このPWAを開いている画面の中で」アバターが自律的に動き回ります
- **タップは毎回ランダムなリアクション** — タップするたびに、待機アニメーション以外のクリップからランダムに1つ再生し、終わるとまた自律徘徊に戻ります。選択メニュー等のUIはありません
- **初回起動のみネットワーク接続が必要** — `sw.js` によるService Workerキャッシュを導入済み。2回目以降はオフラインでも起動できます（Step 5参照）
- **キャッシュ更新には最短でも2回の起動が必要** — Service Workerの仕組み上、アバターを差し替えた直後の1回目の起動ではまだ古いキャッシュが使われることがあります

---

## 実装メモ（開発中に判明した注意点）

### アイコン生成プロセス（実装時の具体的手順）

Step 2-3の画像キャプチャは以下の細部に注意してください：

1. **`<canvas id="stage">`の`toDataURL`取得**  
   three.js化により、WebGLを描画しているのは通常のDOM要素である`<canvas id="stage">`そのものです（model-viewer時代のようなシャドウDOM越しのアクセスは不要）。`document.getElementById('stage').toDataURL('image/png')`を直接呼び出せます。ただし、この画像は透明背景でレンダリングされるため、結果は **背景なしの透明PNGです**。これをそのままアイコンにすると、背景が見えず見栄えが悪くなります。

2. **Pillow で不透明背景への合成**  
   取得した透明PNGの下に不透明な背景（`#eeeeee`）を敷いてから合成する必要があります。Pillow の `background.paste(canvas_img, (0, 0), canvas_img)`（第3引数に同じ画像をアルファマスクとして渡す方式）で透明度マスク合成します（上記スクリプト参照）。

3. **クロップ・リサイズの順序**  
   一度合成してから **正方形にクロップ** → **512x512 と 192x192 にリサイズ**（`Image.LANCZOS` 推奨）という順序自体は検証済みです（逆順や複数回のリサイズは品質が落ちます）。ただし、**クロップ座標（left, top, right, bottom）に汎用的な正解はありません**。カメラ角度やポーズによって画角内のキャラクターの位置は変わるため、必ず一度 `canvas_img` を画像ファイルとして保存し、実際に開いて目視確認した上で、そのスクリーンショットに合わせた座標を都度決めてください。

### タップ反応中の状態管理

three.js化に伴い、タップ反応は「カメラのFOVを操作する」旧実装から「`state`を`STATE.REACTING`にし、再生したクリップの`duration`分だけ`setTimeout`で待ってから`STATE.IDLE`に戻す」方式に変更した。クリップの長さに応じて反応時間が自動的に決まるため、アニメーションを差し替えても待ち時間を手動調整する必要がない。

### manifest.json の `scope` 指定

`manifest.json` には明示的に `"scope": "./"` を指定しています。これは PWA のスコープを定義し、ブラウザキャッシュ・Cookie 分離・ナビゲーション範囲を正確に制御するため、ブラウザ互換性向上の防御コード です。

---

## ライセンス・クレジット

- **Blender**: GPL-3.0（無料・オープンソース）
- **Mixamo**: Adobe Inc.（無料アニメーション提供）
- **three.js**: three.js authors（MIT、`vendor/`にローカル同梱）
- **GitHub Pages**: GitHub Inc.（無料ホスティング）

---

**更新日:** 2026-07-08  
**作成者:** hasegawakasyouen
