# VRCデスクトップマスコットPWA 設計書

- 日付: 2026-07-07
- ステータス: 承認済み（brainstormingフェーズ完了）

## 背景・目的

iOSは第三者アプリによるシステム壁紙（ホーム画面・ロック画面）のライブ描画を許可しておらず、Androidのライブ壁紙APIに相当する仕組みが存在しない。この制約の代替として、「開くとVRChat改変アバターが全画面で動く」デスクトップマスコット型のPWA（Progressive Web App）を作る。既存の `ar-avatar-demo` プロジェクトで確立したパイプライン（Blender変換・model-viewer表示・GitHub Pages無料ホスティング）をそのまま再利用し、Macなし・追加コストなしで実現する。

## 前提・制約

- 開発環境はWindows。Mac/Xcodeは一切使用しない
- 対象は iPhone（Safari）のみ。Android対応は今回のスコープ外
- `ar-avatar-demo` とは別プロジェクトとして管理する
- アニメーションは既存の `model.glb`/`model.usdz`（Ririka + Hip Hop Dancingアニメ、1本のみ）をそのまま流用する。新規アニメーションの追加はスコープ外
- ネイティブアプリ化・App Store配信は行わない

## 採用アプローチ

**既存WebARページをPWA化して流用する。** SwiftUI/RealityKitによるネイティブアプリや、Unity書き出し経由のアプリはいずれも最終的にXcode（Mac）でのビルドが必須になるため、Macなし環境では不採用とする。PWA（`manifest.json` + Apple用metaタグ）であれば、Safariの「ホーム画面に追加」だけでアプリらしいアイコン起動・全画面表示（Safari UIなし）が実現でき、追加コストもゼロで完結する。

## ファイル構成

```
vrc-mascot-pwa/
├── index.html          # マスコット表示ページ（model-viewer + タップリアクション）
├── manifest.json        # PWA設定（アイコン・アプリ名・display: standalone）
├── model.glb            # ar-avatar-demoからコピー（Ririka + Hip Hop Dancing）
├── model.usdz            # 同上（AR Quick Look用）
├── icons/
│   ├── icon-192.png      # ホーム画面アイコン用（Ririkaの静止画から生成）
│   └── icon-512.png
└── README.md
```

## インタラクション設計

- `<model-viewer>` を全画面表示し、Hip Hop Dancingアニメーションを常時ループ再生する
- 画面タップで軽いリアクション演出を行う:
  - CSSの `transform: scale()` によるバウンド（0.3秒程度で拡大→縮小）
  - `model-viewer` の `cameraOrbit`/`fieldOfView` を一瞬変化させる軽いズームイン→戻し
  - アニメーション自体は止めず、演出だけを重ねる
- 今回はアニメーション1本のみのため「切り替え」ロジックは実装しないが、`model-viewer` は `availableAnimations` から複数クリップを取得し `animation-name` で切り替えられる構造のため、将来アニメーションを追加した際はタップ時に「反応→次のアニメへ切り替え」の分岐を足すだけで拡張できる（今回は拡張ポイントとしてのみ意識し、実装はしない）
- 前回同様の「ARで見る」ボタン（AR Quick Look起動）も画面内に残す

## PWA化

- `manifest.json` を作成し `index.html` から `<link rel="manifest">` で参照
  - `display: "standalone"`（Safari UIなしで全画面起動）
  - `name` / `short_name` / `theme_color` / `background_color`
  - `icons` 配列（192px・512px）
- iOS Safariの「ホーム画面に追加」には `manifest.json` に加えて `<meta name="apple-mobile-web-app-capable" content="yes">` 等のApple用metaタグも必要なため、`index.html` 側にも追加する
- アイコン画像は、ブラウザで `model-viewer` の正面ショットをスクリーンショットし、192×512にリサイズ・加工して作成する
- オフラインキャッシュ（Service Worker）は今回スコープ外とする（`model.glb` が6MB程度あり、キャッシュ戦略の設計が別途必要になるため。将来必要になれば追加検討）

## 動作確認方法

1. ローカルで `python -m http.server` を起動し、PC上のブラウザで表示・タップリアクションを確認
2. GitHub Pagesにデプロイ（`ar-avatar-demo` と同様、新規publicリポジトリ）
3. iPhoneのSafariで開き、共有ボタン→「ホーム画面に追加」でアイコンを作成
4. ホーム画面のアイコンをタップして、Safari UIなしで全画面起動することを確認
5. 画面をタップしてバウンド＋ズームのリアクションを確認
6. 「ARで見る」ボタンからAR Quick Lookが従来通り起動することを確認

## 既知の制限

- iOS Safari（PWA / AR Quick Look）専用。Android非対応
- 真のシステム壁紙・ロック画面表示ではない（Appleの制約上不可能）。あくまで「開くと全画面表示されるアプリ」
- アニメーションは1本のみ（切り替えUIは将来の拡張ポイントとしてのみ設計）
- オフラインキャッシュなし。開くたびにネットワーク接続が必要

## スコープ外（今回やらないこと）

- 複数アニメーションの切り替え機能
- Service Workerによるオフラインキャッシュ
- ネイティブアプリ化・App Store配信
- Android対応
