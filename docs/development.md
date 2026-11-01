# 開発ガイド

## 構成
```
index.html        画面（上画面＋下の判定画面、鳥のSVGテンプレート）
styles.css        見た目と鳥のアニメーション
src/logic.js      純粋なゲームロジック（譜面・判定・スコア・共有文）。ブラウザ/Node両対応
src/game.js       ゲーム本体（DOM、Web Audio のBGM/SE、入力、メインループ）
tests/            node:test によるロジックのテスト
docs/             仕様・セキュリティ・運用メモ
Dockerfile        ローカル確認用の静的サーバー（nginx）
docker-compose.yml
.github/workflows/ci.yml     テスト用CI
.github/workflows/pages.yml  GitHub Pages デプロイ
```

## ローカルで動かす
依存ゼロです。どれかでOKです。

```bash
# Python
python3 -m http.server 8000
# Node
npx serve .        # 例。何でもよい
# Docker
docker compose up --build   # http://localhost:8080
```

## テスト
```bash
npm test           # node --test tests/logic.test.js
```
- 譜面が50判定で最大100点になること
- 判定窓（±90ms / ±180ms）と点数
- 譜面の時刻が単調増加で楽曲内に収まること
- 共有URLのエンコード

などを検証します。譜面や窓を変更したら必ずテストも更新してください。

## 譜面を変えるときの注意
- `src/logic.js` の `BAR_PATTERNS` の合計が **50** でなければ
  100点満点になりません（テストで検出します）。
- ジャンプ小節は `JUMP_BARS` で指定します。キューは自動で
  その1小節前に配置されます。

## GitHub Pages
- `main` ブランチへの push で `.github/workflows/pages.yml` が動き、
  リポジトリ直下をそのまま Pages にデプロイします。
- リポジトリ設定で Pages の Source が「GitHub Actions」になっている必要があります
  （ワークフロー側でも `configure-pages` で有効化を試みます）。
- 公開URL: `https://astail.github.io/tori-no-taigun-muse/`
