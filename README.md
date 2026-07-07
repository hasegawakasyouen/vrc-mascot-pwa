# VRCデスクトップマスコットPWA

VRChat改変アバターをiPhoneのホーム画面アイコンから全画面起動できるPWA。`ar-avatar-demo`の資産を流用している。

**ステータス:** iPhone実機での動作確認済み（GitHub Pages上でライブ運用）

---

## 仕組み

このプロジェクトはサーバーレスのモバイル全画面アプリ実装です。

```
ar-avatar-demo で準備した model.glb / model.usdz
    ↓
Google model-viewer Web コンポーネント
    ↓
manifest.json (PWA設定)
    ↓
iPhone Safari「ホーム画面に追加」
    ↓
ホーム画面のアイコンから起動 → 全画面表示 → タップでバウンド反応 + AR Quick Look対応
```

### ファイル構成

```
vrc-mascot-pwa/
├── index.html              # model-viewer + タップ反応スクリプト
├── manifest.json           # PWA設定（scope・display等）
├── model.glb               # 通常3D表示用（全ブラウザ対応）
├── model.usdz              # iOS AR Quick Look用
├── icons/
│   ├── icon-192.png        # ホーム画面アイコン（192x192）
│   └── icon-512.png        # スプラッシュ画面等用（512x512）
└── README.md               # このファイル
```

---

## 自分のアバターに差し替える手順

### 前提条件

- `ar-avatar-demo` のREADME通りにステップ1〜5が完了している（`model.glb` / `model.usdz` の準備できている状態）
- Pillow（Python画像ライブラリ）がインストール済み: `pip install Pillow`
- ローカルプレビュー用にPythonのHTTPサーバーが動かせる環境

### Step 1: アバターモデルの入れ替え

1. `ar-avatar-demo` からこのプロジェクトの `model.glb` / `model.usdz` を上書きコピーする

```bash
cp "C:\Users\PC_User\Documents\ar-avatar-demo\model.glb" "C:\Users\PC_User\Documents\vrc-mascot-pwa\model.glb"
cp "C:\Users\PC_User\Documents\ar-avatar-demo\model.usdz" "C:\Users\PC_User\Documents\vrc-mascot-pwa\model.usdz"
```

### Step 2: ローカルプレビューでアイコン用画像をキャプチャ

```bash
cd "C:\Users\PC_User\Documents\vrc-mascot-pwa"
python -m http.server 8080
```

ブラウザで `http://localhost:8080` を開き、以下の手順でアイコン用の画像をキャプチャします。

**ブラウザデベロッパーツール（F12）のコンソールで以下を実行:**

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

**コンソール出力の長い `data:image/png;base64,` で始まる文字列をすべてコピーします。**

### Step 3: Pillowでアイコン生成

以下のPythonスクリプトを実行してアイコンを生成します（`model-viewer` キャンバスは透明背景なので、不透明な背景に合成する必要があります）。

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
git add model.glb model.usdz icons/icon-512.png icons/icon-192.png
git commit -m "update: replace avatar with new version"
git push
```

デプロイ後、`https://hasegawakasyouen.github.io/vrc-mascot-pwa/` で公開されます（ファイルとしてPushすればGitHub Pagesが自動的にServeします）。

### Step 5: iPhone で「ホーム画面に追加」

iPhoneのSafariで上記URLを開き、以下を確認：

1. 3Dモデルが表示される
2. タップするとスケール変化（バウンド反応）が起こる
3. 「ARで見る」ボタンをタップ → AR Quick Lookが起動 → 床に配置してアニメーション確認
4. Safari右下のシェアボタン → 「ホーム画面に追加」
5. ホーム画面のアイコンをタップして起動 → 全画面表示 → タップ反応・AR機能が使える

---

## 既知の制限・注意点

- **iOS Safari（PWA / AR Quick Look）専用** — Android非対応
- **真のシステム壁紙ではない** — Appleの制約上、サードパーティアプリによるライブ壁紙は不可能。あくまで「ホーム画面のアイコンから開くと全画面表示されるWebアプリ」です
- **アニメーション切り替え非対応** — `model.glb` 内に複数のアニメーションクリップがある場合でも、このPWAでは最初の1つだけが再生されます。切り替えUIはありません
- **オフラインキャッシュ未実装** — 毎回ネットワーク接続が必要です。Service Workerは実装されていません

---

## 実装メモ（開発中に判明した注意点）

### アイコン生成プロセス（実装時の具体的手順）

Step 2-3の画像キャプチャは以下の細部に注意してください：

1. **`model-viewer`要素自身の`toDataURL`取得**  
   `model-viewer`の実際のWebGL canvasはシャドウDOM内にあるため、`document.getElementById('mascot').querySelector('canvas')` では取得できません（`querySelector`はシャドウDOM境界を貫通しないため `null` が返ります）。`model-viewer`要素が公開している `toDataURL()` を直接呼び出してください。また、この画像は透明背景でレンダリングされるため、結果は **背景なしの透明PNGです**。これをそのままアイコンにすると、背景が見えず見栄えが悪くなります。

2. **Pillow で不透明背景への合成**  
   必ず `Image.alpha_composite()` を使って、取得した透明PNG上に不透明な背景（`#eeeeee`）を下敷きにしてください。Pillow の `paste(img, pos, img)` で透明度マスク合成します（上記スクリプト参照）。

3. **クロップ・リサイズの順序**  
   一度合成してから **正方形にクロップ** → **512x512 と 192x192 にリサイズ**（`Image.LANCZOS` 推奨）という順序自体は検証済みです（逆順や複数回のリサイズは品質が落ちます）。ただし、**クロップ座標（left, top, right, bottom）に汎用的な正解はありません**。カメラ角度やポーズによって画角内のキャラクターの位置は変わるため、必ず一度 `canvas_img` を画像ファイルとして保存し、実際に開いて目視確認した上で、そのスクリーンショットに合わせた座標を都度決めてください。

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

### `reacting` フラグの確実なリセット

タップ反応時のFOV操作（ズーム）で予期しないエラーが発生した場合、マスコットが永続的に反応不能になるのを防ぐため、以下を実装しました：

- タップハンドラーの FOV 操作を `try/finally` で囲み、`finally` ブロック内で **必ず** `setTimeout` をスケジュール
- この `setTimeout` 内で `reacting` フラグをリセット、CSS の `.tapped` クラスを削除
- `getFieldOfView()` / `fieldOfView` setter がエラーを投げても、フラグリセットは発火するため、UI が固まらない

### manifest.json の `scope` 指定

`manifest.json` には明示的に `"scope": "./"` を指定しています。これは PWA のスコープを定義し、ブラウザキャッシュ・Cookie 分離・ナビゲーション範囲を正確に制御するため、ブラウザ互換性向上の防御コード です。

---

## ライセンス・クレジット

- **Blender**: GPL-3.0（無料・オープンソース）
- **Mixamo**: Adobe Inc.（無料アニメーション提供）
- **model-viewer**: Google（Apache 2.0）
- **GitHub Pages**: GitHub Inc.（無料ホスティング）

---

**更新日:** 2026-07-08  
**作成者:** hasegawakasyouen
