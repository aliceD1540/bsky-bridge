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

5. マスターキー、Threadsアプリ情報、メール設定をCloudflare Secretsに設定

   ```bash
   # 256bit (32バイト) のランダムキーを生成
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   # 出力された値をSecretに設定
   wrangler secret put MASTER_KEY

   # Threads OAuthアプリの設定
   wrangler secret put THREADS_APP_ID      # Meta for DevelopersのアプリID
   wrangler secret put THREADS_APP_SECRET  # Meta for Developersのアプリシークレット

   # メール確認機能（オプション）
   wrangler secret put BREVO_API_KEY       # BrevoのAPIキー（メール確認機能を有効化する場合）
   ```

6. `wrangler.toml` の `[vars]` にWorkerのURLとメール設定を設定

   ```toml
   [vars]
   APP_URL = "https://<your-worker>.workers.dev"
   EMAIL_VERIFICATION_ENABLED = "false"  # メール確認を有効化する場合は "true"
   ```

7. `wrangler deploy` でデプロイ

8. ブラウザでWorkerのURLにアクセスし、アカウント登録と設定を実施

## メール確認機能（オプション）

アカウント登録時にメールアドレスの確認を必須にできます。メール未確認のアカウントは自動投稿が無効化されます。

### セットアップ

1. [Brevo](https://www.brevo.com/) でアカウントを作成し、APIキーを取得
2. APIキーをSecretに設定：`wrangler secret put BREVO_API_KEY`
3. `wrangler.toml` で機能を有効化：`EMAIL_VERIFICATION_ENABLED = "true"`
4. デプロイ後、新規登録時に確認メールが送信されます

### 動作

- **有効時**：アカウント登録後、確認メールが送信され、メール内のリンクをクリックするまで自動投稿は無効
- **無効時（デフォルト）**：アカウント登録後すぐに自動投稿が利用可能（従来の動作）

### パスワードリセット

メール確認機能の有効/無効に関わらず、パスワードリセット機能を利用できます。

- ログイン画面の「パスワードを忘れた場合」リンクからメールアドレスを入力
- リセット用のメールが送信されます（`BREVO_API_KEY` が設定されている場合のみ）

## 使い方

1. デプロイ後、WorkerのURLにアクセス
2. 「新規登録」からメールアドレスとパスワードでアカウントを作成
   - メール確認機能が有効な場合：登録後、確認メールが送信されます。メール内のリンクをクリックして確認を完了してください。
   - メール確認機能が無効な場合：すぐに利用可能です。
3. 自動的に設定画面に遷移するので、以下を設定：
   - **Bluesky**: アカウント名（例: `user.bsky.social`）とアプリパスワード
   - **Misskey.io**: APIトークン（オプション）
   - **Threads**: 「Threadsに接続」ボタンからOAuth認証（詳細は下記）
4. 設定保存後、5分ごとに自動的に新規ポストをチェックして投稿開始
   - メール確認機能が有効で未確認の場合：メール確認完了後に自動投稿が開始されます

**パスワードを忘れた場合**: ログイン画面の「パスワードを忘れた場合」リンクから、メールアドレスを入力してパスワードリセット用のメールを受け取れます（Brevo APIキーが設定されている場合のみ）。

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
- src/emailService.js: メール配信サービス（Brevo統合）
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

- ユーザーパスワードはPBKDF2+saltでハッシュ化して保存（従来のSHA-256ハッシュからログイン時に自動移行）
- SNS認証情報はAES-GCMで暗号化してD1に保存
- マスターキーはCloudflare Secretsで管理
- Threads OAuthのアプリIDとシークレットはCloudflare Secretsで管理
- Brevo APIキー（メール送信）はCloudflare Secretsで管理
- セッショントークンはKVに保存（30日有効）
- メール確認トークンとパスワードリセットトークンは暗号的に安全なランダム値（各24時間・1時間有効）

## 注意

- KVの書き込み回数制限に注意
- マスターキー（MASTER_KEY）は必ずCloudflare Secretsで管理してください
- Threads OAuthのアプリID（THREADS_APP_ID）とシークレット（THREADS_APP_SECRET）もCloudflare Secretsで管理してください
- Brevo APIキー（BREVO_API_KEY）を設定する場合は、必ずCloudflare Secretsで管理してください
- `APP_URL` は `wrangler.toml` の `[vars]` セクションにWorkerの公開URLを設定してください
- Threads APIは1日250件の投稿制限があります
- 過去のポストは遡らず、ユーザー登録日時以降のポストのみ処理します
- メール確認機能を有効化すると、メール未確認のユーザーは自動投稿が無効化されます

