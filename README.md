# bsky-bridge

Blueskyの特定アカウントのポストをThreadsおよびMisskey.ioに自動投稿するBot（マルチユーザー対応）

## 機能

- 複数ユーザーの登録・管理
- ユーザーごとのBluesky、Threads、Misskey.io連携設定
- 各SNS認証情報の暗号化保存
- 自動投稿処理（5分間隔）

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

5. マスターキーとThreadsアプリ情報をCloudflare Secretsに設定

   ```bash
   # 256bit (32バイト) のランダムキーを生成
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   # 出力された値をSecretに設定
   wrangler secret put MASTER_KEY

   # Threads OAuthアプリの設定
   wrangler secret put THREADS_APP_ID      # Meta for DevelopersのアプリID
   wrangler secret put THREADS_APP_SECRET  # Meta for Developersのアプリシークレット
   ```

6. `wrangler.toml` の `[vars]` にWorkerのURLを設定

   ```toml
   [vars]
   APP_URL = "https://<your-worker>.workers.dev"
   ```

7. `wrangler deploy` でデプロイ

8. ブラウザでWorkerのURLにアクセスし、アカウント登録と設定を実施

## 使い方

1. デプロイ後、WorkerのURLにアクセス
2. 「新規登録」からメールアドレスとパスワードでアカウントを作成
3. 自動的に設定画面に遷移するので、以下を設定：
   - **Bluesky**: アカウント名（例: `user.bsky.social`）とアプリパスワード
   - **Misskey.io**: APIトークン（オプション）
   - **Threads**: 「Threadsに接続」ボタンからOAuth認証（詳細は下記）
4. 設定保存後、5分ごとに自動的に新規ポストをチェックして投稿開始

### Meta for Developersの設定（Threads）

Threads APIを使用するためにはMeta for Developersでアプリを作成する必要があります：

1. [Meta for Developers](https://developers.facebook.com/)にアクセスし、アカウントでログイン
2. 「マイアプリ」→「アプリを作成」をクリック
3. アプリ名は任意で設定し、「アプリを作成」をクリック
4. ユースケースは「Threads APIにアクセス」を選択
5. ビジネスは「現時点ではビジネスポートフォリオをリンクしない。」を選択
6. アプリが作成されたら、「ユースケース」→「Threads APIにアクセス」→「カスタマイズ」を選択
   - `threads_basic`, `threads_content_publish` を追加
7. 「アプリ設定」→「基本設定」からアプリIDとアプリシークレットを取得
8. 「Threadsの設定」→「コールバックURL」に `https://<your-worker>.workers.dev/auth/threads/callback` を登録
9. 取得したアプリIDとシークレットを `wrangler secret` に設定（前述のセットアップ手順参照）
10. 設定画面の「Threadsに接続」ボタンからOAuth認証を実施

### Misskey.ioの設定

1. Misskey.ioにログインし、「設定」→「APIキー」からAPIトークンを作成
2. 必要な権限: ノートの作成（`write:notes`）、ドライブの管理（`write:drive`）
3. 取得したトークンを設定画面の「Misskey.io」欄に入力

## 構成

- src/worker.js: Cloudflare Worker本体
- src/auth.js: 認証ハンドラー
- src/settings.js: SNS設定ハンドラー
- src/crypto.js: 暗号化ユーティリティ
- src/html.js: フロントエンドHTMLテンプレート
- src/blueskyClient.js: Bluesky APIクライアント
- src/threadsClient.js: Threads APIクライアント
- src/misskeyClient.js: Misskey.io APIクライアント
- src/kvStore.js: KV/D1管理
- src/formatPost.js: 投稿整形ロジック
- migrations/: D1マイグレーションファイル

## セキュリティ

- ユーザーパスワードはSHA-256でハッシュ化して保存
- SNS認証情報はAES-GCMで暗号化してD1に保存
- マスターキーはCloudflare Secretsで管理
- Threads OAuthのアプリIDとシークレットはCloudflare Secretsで管理
- セッショントークンはKVに保存（30日有効）

## 注意

- KVの書き込み回数制限に注意
- マスターキー（MASTER_KEY）は必ずCloudflare Secretsで管理してください
- Threads OAuthのアプリID（THREADS_APP_ID）とシークレット（THREADS_APP_SECRET）もCloudflare Secretsで管理してください
- `APP_URL` は `wrangler.toml` の `[vars]` セクションにWorkerの公開URLを設定してください
- Threads APIは1日250件の投稿制限があります
- 過去のポストは遡らず、ユーザー登録日時以降のポストのみ処理します

