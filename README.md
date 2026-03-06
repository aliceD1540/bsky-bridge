# bsky-bridge

Blueskyの特定アカウントのポストをThreadsおよびMisskey.ioに自動投稿するBot

## セットアップ

1. CloudflareアカウントでKVを作成し、`wrangler.toml` の `kv_namespaces` にIDを設定
2. D1データベースを作成し、`wrangler.toml` の `database_id` を更新

   ```bash
   wrangler d1 create bsky-bridge
   ```

3. D1マイグレーションを実行

   ```bash
   wrangler d1 migrations apply bsky-bridge
   ```

4. Cloudflare Queuesを作成

   ```bash
   wrangler queues create bsky-bridge-queue
   ```

5. `wrangler.toml` の `BLUESKY_HANDLE` を自身の値に変更
6. Threads認証トークンはCloudflare Secretsで設定（`wrangler secret put THREADS_TOKEN`）
7. Misskey.ioのAPIトークンはCloudflare Secretsで設定（`wrangler secret put MISSKEY_TOKEN`）
8. `wrangler deploy` でデプロイ

### Meta for Developersの設定

Threads APIを使用するためにはMeta for Developersでアプリを作成し、アクセストークンを取得する必要があります。以下の手順で設定してください：

1. [Meta for Developers](https://developers.facebook.com/)にアクセスし、アカウントでログイン
2. 「マイアプリ」→「アプリを作成」をクリック
3. アプリ名は任意で設定し、「アプリを作成」をクリック
4. ユースケースは「Threads APIにアクセス」を選択
5. ビジネスは「現時点ではビジネスポートフォリオをリンクしない。」を選択
6. アプリが作成されたら、「ユースケース」→「Threads APIにアクセス」→「カスタマイズ」を選択
  - threads_basic, threads_content_publishを追加（basicはデフォルトで追加済かも）
7. 「設定」→「ユーザートークン生成ツール」で対象Threadsアカウントを設定してアクセストークンを取得

### Misskey.ioの設定

1. Misskey.ioにログインし、「設定」→「APIキー」からAPIトークンを作成
2. 必要な権限: ノートの作成（`write:notes`）、ドライブの管理（`write:drive`）

## 構成
- src/worker.js: Cloudflare Worker本体
- src/blueskyClient.js: Bluesky APIクライアント
- src/threadsClient.js: Threads APIクライアント
- src/misskeyClient.js: Misskey.io APIクライアント
- src/kvStore.js: KV/D1管理
- src/formatPost.js: 投稿整形ロジック
- migrations/: D1マイグレーションファイル

## テスト
- 各モジュールは個別にテスト可能
- Worker本体はCloudflareのdev環境で動作確認

## 注意
- KVの書き込み回数制限に注意
- シークレット情報（THREADS_TOKEN、MISSKEY_TOKENなど）はwrangler.tomlに記載せず、Cloudflare Secretsで管理してください
