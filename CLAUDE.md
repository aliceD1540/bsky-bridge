# CLAUDE.md

Bluesky・Misskey.io・Threads・mixi2 間でポストを自動転記するマルチユーザー対応サービス。Cloudflare Workers 上で動く。

## 構成

- 実行環境: Cloudflare Workers（KV, D1, Queues, Cron Trigger 5分毎）。Node.js 専用 API は使えないので、Web 標準 API（`fetch`, `crypto.subtle` など）で書く
- エントリポイント: `src/worker.js`。各 SNS クライアントは `src/*Client.js`、画面 HTML は `src/html.js`
- D1 スキーマ・KV キー設計・セキュリティ方針は `DESIGN.md` を参照。DB 変更時は `migrations/` に連番の SQL を追加し、`DESIGN.md` も更新する
- 機密情報はコードに書かず、`wrangler secret` か `[vars]` の環境変数（`env.XXX`）から読む

## コマンド

```bash
npm run dev                                      # ローカル実行（wrangler.local.toml を使用）
npx wrangler d1 migrations apply bsky-bridge     # マイグレーション適用（ローカルは --local）
for f in src/*.js; do node --check "$f"; done    # 構文チェック（自動テストは未整備のため、編集後は必ず実行）
```

デプロイ（`npx wrangler deploy`）は本番に反映されるので、明示的に頼まれない限り実行しない。

## 実装上の注意

- 外部 API（Bluesky, Threads, Misskey, mixi2）と Cloudflare の Read/Write には回数制限がある。ループ内での API 呼び出しや KV 書き込みを増やす変更は、呼び出し回数を見積もってから行う
- ファイル名は既存に合わせて camelCase（例: `blueskyClient.js`）。変数・関数は camelCase、定数は UPPER_SNAKE_CASE
- コメントは「何をしているか」ではなく「なぜそうしているか」を書く

### src/html.js

- `HTML_INDEX` などの HTML はバッククォートのテンプレートリテラルで定義されている。中の `<script>` でバッククォートを使うとテンプレートが壊れるので、文字列連結（`'...' + val + '...'`）を使う
- 「使い方」「利用規約」「プライバシーポリシー」は機能変更に合わせて更新する
- Misskey.io の認証情報の説明には `read:account`（アカウントの情報を見る）権限が必要と記載する。`/api/i` で自分のユーザーIDを取得するため

## ブランチ運用

- `master`: 開発の統合先（デフォルトブランチ）。作業ブランチからの PR はすべてここに向ける
- `release`: 本番デプロイ用。`master` から PR でマージし、マージ後にデプロイする。直接コミットしない
  - 例外: 実際にデプロイしないと動作検証できない場合（Webhook、OAuth コールバックなど）は `master` からのデプロイを許可する。ただしユーザーの明示的な指示がある場合に限る。検証後は `release` へマージしてデプロイし直すか、問題があれば `release` を再デプロイして戻し、本番と `release` の内容を一致させる
- 作業ブランチは `master` から切り、`fix/issue-<番号>` / `feature/issue-<番号>` と命名する（Issue がない場合は `fix/<内容>` など）
- `release` への PR は下記のデプロイ手順の中でのみ作成する。マージは常にユーザーが GitHub 上で行い、Claude はマージしない

## デプロイ手順

「検証のため master から」などの指定なしに「デプロイして」と頼まれた場合は、次の流れで進める。

1. `git fetch` してから `origin/master` と `origin/release` を比較する（`git log --oneline origin/release..origin/master`）。差分がなければ、その旨を伝えて終了する
2. 差分があれば `master` → `release` の PR を作成する。PR 本文には含まれるコミットの一覧を書く。`migrations/` に新しいファイルが含まれる場合は、本番 D1 に適用することを本文に明記する
3. PR の URL を伝え、ユーザーのマージを待つ。待つ間は Monitor ツールで `gh pr view <番号> --json state` を30秒ほどの間隔で確認する
   - `MERGED` になったら手順4へ進む
   - `CLOSED`（マージせずにクローズ）になったら、デプロイせずに終了する
4. リモートの最新版を取り直し、そのコードでデプロイする
   - `git fetch origin` → `git switch release` → `git reset --hard origin/release` の順で実行する。ローカルの `release` にしかないコミットや変更は破棄してよい（`release` は直接コミットしないため、本番に出すのは常に `origin/release` の内容）
   - `git log --oneline -1` が PR のマージコミットであることを確認する
   - 新しいマイグレーションがあれば、先に `npx wrangler d1 migrations apply bsky-bridge --remote` を実行する
   - `npx wrangler deploy` を実行し、結果（成否と、出力された Version ID）を報告する。`wrangler` は `package.json` の依存に含まれておらず `node_modules` もないため、`npm run deploy` は `wrangler: not found` で失敗する。必ず `npx` 経由で実行する
   - 終わったら元のブランチに戻す

## ドキュメント・コミット

- 機能追加・設定項目の変更時は `README.md`（概要、セットアップ、使い方、トラブルシューティング）も更新する
- コミットメッセージは `type: subject` 形式（feat, fix, docs, refactor, chore など）。subject は日本語で簡潔に。1コミット1論理変更
