# VRCデスクトップマスコットPWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ar-avatar-demo`のアバター資産を流用し、iPhoneのホーム画面に追加できる「デスクトップマスコット」PWA（タップでバウンド＋ズームのリアクション、AR Quick Look起動可）を作り、GitHub Pagesで無料公開する。

**Architecture:** 既存の`model.glb`/`model.usdz`を流用し、`<model-viewer>`ベースの1枚のHTMLページに`manifest.json`とApple用metaタグを足してPWA化する。バックエンドサーバーは持たない。

**Tech Stack:** `<model-viewer>`（Google, CDN読み込み）, PWA manifest, Python 3.12 + Pillow（アイコン生成）, GitHub Pages, gh CLI

**確認済みの環境:**
- Python: `python`コマンドで起動可（PATH通り）、Pillow 12.2.0インストール済み
- gh CLI: 認証済み（アカウント `hasegawakasyouen`）
- プロジェクトルート: `C:\Users\PC_User\Documents\vrc-mascot-pwa`（git初期化済み、design specをコミット済み）
- 参照元プロジェクト: `C:\Users\PC_User\Documents\ar-avatar-demo`（`model.glb`/`model.usdz`をここからコピーする）

---

### Task 1: プロジェクトの骨組み作成・アセットのコピー

**Files:**
- Create: `C:\Users\PC_User\Documents\vrc-mascot-pwa\model.glb`（コピー）
- Create: `C:\Users\PC_User\Documents\vrc-mascot-pwa\model.usdz`（コピー）
- Create: `C:\Users\PC_User\Documents\vrc-mascot-pwa\.gitignore`
- Create: `C:\Users\PC_User\Documents\vrc-mascot-pwa\icons\.gitkeep`

- [ ] **Step 1: `ar-avatar-demo`から完成済みのモデルをコピーする**

```bash
cd "C:\Users\PC_User\Documents\vrc-mascot-pwa"
cp "C:\Users\PC_User\Documents\ar-avatar-demo\model.glb" .
cp "C:\Users\PC_User\Documents\ar-avatar-demo\model.usdz" .
```

- [ ] **Step 2: コピーしたファイルを検証**

```bash
ls -la "C:\Users\PC_User\Documents\vrc-mascot-pwa\model.glb" "C:\Users\PC_User\Documents\vrc-mascot-pwa\model.usdz"
```

Expected: `model.glb` が約6.4MB、`model.usdz` が約8.4MB（`ar-avatar-demo`の現行公開版と同じサイズ）。

- [ ] **Step 3: iconsフォルダと.gitignoreを作成**

```bash
mkdir -p "C:\Users\PC_User\Documents\vrc-mascot-pwa\icons"
touch "C:\Users\PC_User\Documents\vrc-mascot-pwa\icons\.gitkeep"
```

`.gitignore`:
```
icon_screenshot_raw.png
```

- [ ] **Step 4: コミット**

```bash
cd "C:\Users\PC_User\Documents\vrc-mascot-pwa"
git add model.glb model.usdz .gitignore icons/.gitkeep
git commit -m "chore: scaffold project and copy avatar assets from ar-avatar-demo"
```

---

### Task 2: model-viewerベースのindex.html作成（タップリアクション付き）

**Files:**
- Create: `C:\Users\PC_User\Documents\vrc-mascot-pwa\index.html`

- [ ] **Step 1: index.htmlを書く**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>VRCマスコット</title>
  <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"></script>
  <style>
    html, body { margin: 0; height: 100%; background-color: #eee; }
    model-viewer {
      width: 100vw;
      height: 100vh;
      background-color: #eee;
      transition: transform 0.15s ease;
    }
    model-viewer.tapped {
      transform: scale(1.05);
    }
    #ar-button {
      background-color: #fff;
      border-radius: 8px;
      border: none;
      padding: 12px 20px;
      position: absolute;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 16px;
    }
  </style>
</head>
<body>
  <model-viewer
    id="mascot"
    src="model.glb"
    ios-src="model.usdz"
    alt="改変アバター"
    ar
    ar-modes="quick-look"
    camera-controls
    autoplay
    shadow-intensity="1">
    <button id="ar-button" slot="ar-button">ARで見る</button>
  </model-viewer>

  <script>
    const mascot = document.getElementById('mascot');
    let reacting = false;

    mascot.addEventListener('click', (event) => {
      if (event.target.closest('#ar-button')) return;
      if (reacting) return;
      reacting = true;

      mascot.classList.add('tapped');

      let baseFov = null;
      if (mascot.loaded) {
        baseFov = mascot.getFieldOfView();
        mascot.fieldOfView = `${baseFov * 0.92}deg`;
      }

      setTimeout(() => {
        mascot.classList.remove('tapped');
        if (baseFov !== null) {
          mascot.fieldOfView = `${baseFov}deg`;
        }
        reacting = false;
      }, 300);
    });
  </script>
</body>
</html>
```

**設計メモ（実装者向け）:**
- `event.target.closest('#ar-button')` で、ARボタンのクリックがバウンド演出と二重発火しないようにガードしている
- `mascot.loaded` が false の場合（モデル読み込み前にタップされた場合）はFOV変更をスキップし、バウンド演出のみ行う（エラーにならないようにするため）
- `reacting` フラグで連打時の多重アニメーションを防止

- [ ] **Step 2: コミット**

```bash
cd "C:\Users\PC_User\Documents\vrc-mascot-pwa"
git add index.html
git commit -m "feat: add model-viewer mascot page with tap reaction"
```

---

### Task 3: ローカルで表示・タップリアクションを確認する

**Files:**
- Modify: `C:\Users\PC_User\.claude\.claude\launch.json`（新しいサーバー設定を追加。このファイルはセッションのプレビュー機能が参照する設定で、`ar-avatar-demo`の時と同じ場所）

- [ ] **Step 1: launch.jsonに新しいサーバー設定を追加**

`C:\Users\PC_User\.claude\.claude\launch.json` の `configurations` 配列に以下を追加する（既存のエントリは変更しない）:

```json
    {
      "name": "vrc-mascot-pwa",
      "runtimeExecutable": "python",
      "runtimeArgs": ["-m", "http.server", "8768", "--directory", "C:\\Users\\PC_User\\Documents\\vrc-mascot-pwa"],
      "port": 8768
    }
```

- [ ] **Step 2: preview_startでサーバーを起動し、preview_screenshot/console_logs/evalで確認**

実行者（エージェント）は `mcp__Claude_Preview__preview_start` で `vrc-mascot-pwa` を起動し、`http://localhost:8768/index.html` を開いて以下を確認する:
- `preview_console_logs` でエラーが出ていないこと
- `preview_screenshot` でアバターの3Dモデルが表示され、アニメーションが再生されていること
- `preview_click` で画面中央（アバター）をクリックし、直後に `preview_screenshot` を撮ってバウンド演出（一瞬拡大して戻る）が起きていることを確認する。タイミングがシビアな場合は、`preview_eval` で `document.getElementById('mascot').classList.contains('tapped')` を確認してもよい
- `preview_click` で「ARで見る」ボタン自体を押しても、ページがエラーにならず、かつバウンド演出と二重発火していないこと（`event.target.closest('#ar-button')` のガードが機能しているか）を `preview_eval` で確認する: `document.getElementById('mascot').classList.contains('tapped')` が誤ってtrueのままになっていないか

- [ ] **Step 3: 問題があれば修正**

タップ演出が発火しない場合、`mascot.loaded` が期待通りtrueになっているか `preview_eval` で確認し、必要に応じて `index.html` のJSを修正する。

---

### Task 4: アプリアイコンを生成する（192×192・512×512）

**Files:**
- Create: `C:\Users\PC_User\Documents\vrc-mascot-pwa\icons\icon-192.png`
- Create: `C:\Users\PC_User\Documents\vrc-mascot-pwa\icons\icon-512.png`

- [ ] **Step 1: Task 3で起動中のプレビューからスクリーンショットを取得し、ディスクに保存する**

`mcp__Claude_Preview__preview_screenshot` を `save_to_disk: true` で実行し、保存されたパスを確認する（例: スクラッチディレクトリ内の `.jpg`/`.png` パスが返る）。

- [ ] **Step 2: スクリーンショットを確認し、アバターを中心とした正方形の切り抜き範囲を決める**

保存された画像を確認し、アバターの頭〜腰あたりが収まるように、正方形（例: 幅・高さとも同じピクセル数）の切り抜き範囲 `(left, top, right, bottom)` を目視で決定する。画像サイズやアバターの位置はスクリーンショットの実際の内容に応じて変わるため、ここでは具体的な座標を決め打ちしない。実行者は取得したスクリーンショットを実際に確認してから座標を決めること。

- [ ] **Step 3: Pillowで切り抜き・リサイズしてアイコンを生成する**

以下のPythonスクリプトの `SRC_PATH` と `CROP_BOX` を、Step 1・Step 2で確認した実際の値に置き換えて実行する:

```python
from PIL import Image

SRC_PATH = "（Step 1で保存されたスクリーンショットの実際のパスに置き換える）"
CROP_BOX = (0, 0, 100, 100)  # (left, top, right, bottom) — Step 2で決めた実際の正方形範囲に置き換える

img = Image.open(SRC_PATH).convert("RGBA")
cropped = img.crop(CROP_BOX)

cropped.resize((512, 512), Image.LANCZOS).save(
    r"C:\Users\PC_User\Documents\vrc-mascot-pwa\icons\icon-512.png"
)
cropped.resize((192, 192), Image.LANCZOS).save(
    r"C:\Users\PC_User\Documents\vrc-mascot-pwa\icons\icon-192.png"
)
print("ICON_OK")
```

Run: `python icon_script.py`（一時スクリプトとして保存して実行。コミット不要）
Expected: `ICON_OK` が出力され、`icons/icon-512.png` と `icons/icon-192.png` が生成される

- [ ] **Step 4: 生成されたアイコンを検証**

```bash
python -c "from PIL import Image; im = Image.open(r'C:\Users\PC_User\Documents\vrc-mascot-pwa\icons\icon-512.png'); print(im.size, im.mode)"
python -c "from PIL import Image; im = Image.open(r'C:\Users\PC_User\Documents\vrc-mascot-pwa\icons\icon-192.png'); print(im.size, im.mode)"
```

Expected: それぞれ `(512, 512)` と `(192, 192)` が出力される

- [ ] **Step 5: コミット**

```bash
cd "C:\Users\PC_User\Documents\vrc-mascot-pwa"
git add icons/icon-192.png icons/icon-512.png
git commit -m "asset: generate app icons from mascot screenshot"
```

---

### Task 5: manifest.json作成とPWA用metaタグの追加

**Files:**
- Create: `C:\Users\PC_User\Documents\vrc-mascot-pwa\manifest.json`
- Modify: `C:\Users\PC_User\Documents\vrc-mascot-pwa\index.html`

- [ ] **Step 1: manifest.jsonを書く**

```json
{
  "name": "VRCマスコット",
  "short_name": "マスコット",
  "display": "standalone",
  "start_url": "./index.html",
  "background_color": "#eeeeee",
  "theme_color": "#eeeeee",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: index.htmlの`<head>`にPWA用のタグを追加する**

`index.html` の `<title>VRCマスコット</title>` の直後に、以下を追加する:

```html
  <link rel="manifest" href="manifest.json">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="マスコット">
  <link rel="apple-touch-icon" href="icons/icon-192.png">
```

- [ ] **Step 3: コミット**

```bash
cd "C:\Users\PC_User\Documents\vrc-mascot-pwa"
git add manifest.json index.html
git commit -m "feat: add PWA manifest and Apple home screen meta tags"
```

---

### Task 6: ローカルでPWA設定を再確認する

**Files:** なし

- [ ] **Step 1: preview_startでサーバーを再起動（またはリロード）し、以下を確認**

- `preview_network` で `manifest.json` へのリクエストが200で返っていること
- `preview_eval` で `fetch('manifest.json').then(r => r.json())` を実行し、正しいJSONがパースできること（構文エラーがないこと）
- `preview_console_logs` で新たなエラーが出ていないこと
- Task 3で確認したタップリアクションが引き続き動作していること（回帰確認）

- [ ] **Step 2: 問題があれば修正**

`manifest.json` の構文エラーや、`index.html` に追加したタグのtypoがあれば修正する。

---

### Task 7: GitHub Pagesへデプロイする

**Files:** なし（GitHubリポジトリ作成とPages設定のみ）

**注意:** このタスクは新しいpublicリポジトリを作成し公開する操作です。実行前にユーザーに実行してよいか確認すること（`ar-avatar-demo`のときと同様、アバターの利用規約を確認済みであることが前提）。

- [ ] **Step 1: デフォルトブランチ名を確認**

```bash
cd "C:\Users\PC_User\Documents\vrc-mascot-pwa"
git branch --show-current
```

- [ ] **Step 2: GitHubリポジトリを作成してpush**

```bash
gh repo create vrc-mascot-pwa --public --source=. --remote=origin --push
```

- [ ] **Step 3: GitHub Pagesを有効化**

Step 1で確認したブランチ名を使う:

```bash
gh api -X POST /repos/hasegawakasyouen/vrc-mascot-pwa/pages -f "source[branch]=master" -f "source[path]=/"
```

- [ ] **Step 4: 公開URLを確認**

```bash
gh api /repos/hasegawakasyouen/vrc-mascot-pwa/pages --jq .html_url
```

Expected: `https://hasegawakasyouen.github.io/vrc-mascot-pwa/` が返る。反映まで数分かかることがある。

- [ ] **Step 5: 公開URLが実際にモデル込みで正しく配信されているか確認**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://hasegawakasyouen.github.io/vrc-mascot-pwa/
curl -s -o /dev/null -w "%{http_code}\n" https://hasegawakasyouen.github.io/vrc-mascot-pwa/model.glb
curl -s -o /dev/null -w "%{http_code}\n" https://hasegawakasyouen.github.io/vrc-mascot-pwa/manifest.json
```

Expected: いずれも200

---

### Task 8: iPhone実機でPWA・タップリアクション・ARを確認する（手動）

この工程はWindows環境からは実行できないため、実機での確認手順のみ示す。

**Files:** なし

- [ ] **Step 1: iPhoneのSafariで公開URLを開く**

`https://hasegawakasyouen.github.io/vrc-mascot-pwa/` をSafariで開く

- [ ] **Step 2: 「ホーム画面に追加」でアイコンを作成**

共有ボタン → 「ホーム画面に追加」 → アイコン・名前を確認して追加

- [ ] **Step 3: ホーム画面のアイコンをタップして起動確認**

Safari UIなしで全画面起動することを確認

- [ ] **Step 4: タップリアクションを確認**

画面（アバター部分）をタップし、バウンド＋ズームの演出が起きることを確認

- [ ] **Step 5: 「ARで見る」ボタンを確認**

ボタンをタップし、AR Quick Lookが従来通り起動することを確認。また、ARボタンをタップしたときにバウンド演出が誤って同時発火していないことも確認する

- [ ] **Step 6: 問題があれば記録**

うまくいかない場合、症状（アイコンが追加できない/全画面にならない/タップ反応がない等）をメモする

---

### Task 9: README.md を書く

**Files:**
- Create: `C:\Users\PC_User\Documents\vrc-mascot-pwa\README.md`

- [ ] **Step 1: README.mdを書く**

```markdown
# VRCデスクトップマスコットPWA

VRChat改変アバターをiPhoneのホーム画面アイコンから全画面起動できるPWA。`ar-avatar-demo`の資産を流用している。

## 仕組み

- `model.glb` / `model.usdz`: `ar-avatar-demo` からコピーしたアバターの3Dモデル＋アニメーション
- `index.html`: `<model-viewer>` を使った表示ページ。タップでバウンド＋ズームのリアクション演出、ARボタンからAR Quick Look起動も可能
- `manifest.json`: PWA設定。Safariの「ホーム画面に追加」でアプリらしく起動できる

## 自分のアバターに差し替える手順

1. `ar-avatar-demo` のREADMEの手順で自分のアバターの `model.glb` / `model.usdz` を用意する
2. このプロジェクトの `model.glb` / `model.usdz` を上書きする
3. アイコン（`icons/icon-192.png` / `icons/icon-512.png`）も、新しいアバターの見た目に合わせて作り直すことを推奨（ローカルプレビューのスクリーンショットをPillowで切り抜き・リサイズする方法は実装時のTask 4を参照）
4. GitHub Pages等の静的ホスティングにアップロードすれば、iPhoneのSafari「ホーム画面に追加」で使える

## 既知の制限

- iOS Safari（PWA / AR Quick Look）専用。Android非対応
- 真のシステム壁紙・ロック画面表示ではない（Appleの制約上、サードパーティアプリによるライブ壁紙は不可能）。あくまで「ホーム画面のアイコンから開くと全画面表示されるアプリ」
- アニメーションは1本のみ。タップ時はバウンド＋ズームのリアクション演出のみで、アニメーションの切り替えは行わない
- オフラインキャッシュ（Service Worker）は未実装。開くたびにネットワーク接続が必要
```

- [ ] **Step 2: コミット**

```bash
cd "C:\Users\PC_User\Documents\vrc-mascot-pwa"
git add README.md
git commit -m "docs: add README"
git push
```

---

## Self-Review メモ

- **Spec網羅性**: design spec の各セクション（アプローチ/ファイル構成/インタラクション/PWA化/動作確認/制限/スコープ外）に対応するTaskをすべて用意した
- **プレースホルダ**: 「TBD」「後で」は含まない。Task 4のアイコン切り抜き座標のみ、スクリーンショットを実際に見てから決める必要があるため意図的に決め打ちを避けているが、これは「未定」ではなく「実行時に実データを見て決定する」という明示的な指示であり、手順自体は具体的に書かれている
- **型/名称の一貫性**: `index.html` の `id="mascot"` / `id="ar-button"` はTask 2で定義し、Task 3・Task 6の確認手順でも同じidを参照している
