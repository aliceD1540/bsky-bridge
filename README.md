# bsky-bridge

Bluesky・Misskey.io・Threads・mixi2 のいずれかを転記元として選択し、認証情報を設定した他プラットフォームへ自動転記するサービス（マルチユーザー対応）

## 機能

- 複数ユーザーの登録・管理
- 転記元プラットフォームの選択（Bluesky / Misskey.io / Threads / mixi2）
- 転記元以外の認証済みプラットフォームへ自動転記（5分間隔）
- ユーザーごとのBluesky・Threads・Misskey.io・mixi2連携設定
- 各SNS認証情報の暗号化保存
- メールアドレス確認・パスワードリセット機能（オプション）
- メンテナンスモード
- 設定画面でログイン中のメールアドレスと本日の転記回数を表示
- **リプライ通知機能（Webhook経由で転記先のリプライを転記元に通知）**

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
   MAX_ACCOUNTS = "50"                   # アカウント作成上限（デフォルト: 50）
   MAINTENANCE_MODE = "false"            # メンテナンスモード（"true"で有効化）
   ADMIN_EMAIL = ""                      # 管理者のメールアドレス（制限を受けない）
   ```

7. `wrangler deploy` でデプロイ

8. ブラウザでWorkerのURLにアクセスし、アカウント登録と設定を実施

## 負荷対策とメンテナンス機能

### 書き込み回数制限

各ユーザーの1日あたりの転記処理回数は **20回** に制限されています。この制限により、Cloudflareの無料枠を効率的に利用できます。

- カウント対象: キューの実行回数（例: Blueskyの1投稿をMisskey.ioとThreadsに転記 = 1回）
- リセット: 毎日UTC 0:00にカウントがリセット
- 管理者: `ADMIN_EMAIL` で指定されたユーザーは無制限

上限に達した場合、翌日まで新しいキューは作成されません。

### アカウント作成上限

環境変数 `MAX_ACCOUNTS` で設定された数までアカウントを作成できます（デフォルト: 50）。上限に達すると新規登録が制限されます。

### メンテナンスモード

`MAINTENANCE_MODE = "true"` に設定すると、メンテナンスモードが有効になります。

- **一般ユーザー**: キューの作成と処理がスキップされる（メンテナンス終了後にまとめて処理）
- **管理者** (`ADMIN_EMAIL` 指定): 制限なく動作
- **UI**: 全ページの上部にメンテナンス中のバナーが表示される

アップデートや不具合調査時に利用してください。

#### メンテナンスモードを維持したままデプロイする

`wrangler.toml` の `MAINTENANCE_MODE` は `"false"`（デフォルト）のまま管理し、デプロイ時だけ `--var` フラグで一時的に上書きすることで、メンテナンスモードを維持したままデプロイできます。

```bash
wrangler deploy --var MAINTENANCE_MODE:true
```

動作確認が完了したら、Cloudflare Dashboard（Workers & Pages → 対象Worker → Settings → Variables）で `MAINTENANCE_MODE` を `false` に変更して解除してください（再デプロイ不要）。

> **注意**: `[vars]` の値はデプロイのたびに `wrangler.toml` の値で上書きされます。Dashboard で変更した値は次回のデプロイで元に戻るため、`wrangler.toml` は常に `"false"` を維持してください。

## メール確認機能（オプション）

アカウント登録時にメールアドレスの確認を必須にできます。メール未確認のアカウントは自動投稿が無効化されます。

### セットアップ

1. [Brevo](https://www.brevo.com/) でアカウントを作成し、APIキーを取得
2. APIキーをSecretに設定：`wrangler secret put BREVO_API_KEY`
3. `wrangler.toml` で機能を有効化：`EMAIL_VERIFICATION_ENABLED = "true"`
4. デプロイ後、新規登録時に確認メールが送信されます

### 動作

- **有効時**：アカウント登録後、確認メールが送信され、メール内のリンクをクリックするまで自動投稿は無効
- **無効時（デフォルト）**：アカウント登録後すぐに自動投稿が利用可能

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
   - **転記元の選択**: Bluesky・Misskey.io・Threads・mixi2（管理者のみ） のいずれかを転記元として選択して保存
   - **Bluesky**: アカウント名（例: `user.bsky.social`）とアプリパスワード（転記元・転記先どちらで使用する場合も設定が必要）
   - **Misskey.io**: APIトークン（オプション）
   - **Threads**: 「Threadsに接続」ボタンからOAuth認証（詳細は下記）
   - **mixi2（管理者のみ）**: 転記元アカウントID、BotアカウントのクライアントIDとシークレット（詳細は下記）
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
2. 必要な権限: アカウントの情報を見る（`read:account`）、ノートを作成・削除する（`write:notes`）、ドライブを操作する（`write:drive`）
   - `read:account` は `/api/i` で自分のユーザーIDを取得するために必要
3. 取得したトークンを設定画面の「Misskey.io」欄に入力

### mixi2の設定（管理者のみ）

mixi2は「自動投稿できるのはBotアカウントのみ」という制約があるため、特殊な設定が必要です：

1. mixi2でBotアカウントを作成し、OAuth 2.0のクライアントIDとクライアントシークレットを取得
2. 設定画面の「mixi2」セクションに以下を入力：
   - **転記元アカウントID**: 投稿を取得したいmixi2アカウントのユーザーID
   - **クライアントID**: Botアカウントの OAuth 2.0 クライアント ID
   - **クライアントシークレット**: Botアカウントの OAuth 2.0 クライアントシークレット
3. 保存後、BotアカウントがOAuth 2.0で自動的に認証され、指定した転記元アカウントの投稿を転記します

**注意**: mixi2設定は仕組み上なりすましが可能なため、管理者（`ADMIN_EMAIL` で指定されたユーザー）のみが設定可能です。

## リプライ通知機能（Webhook）

転記先のプラットフォームでリプライがあった場合、転記元アカウントに通知を送信する機能です。

### セットアップ

1. 設定画面の「リプライ通知設定」セクションで、通知を受け取りたいプラットフォームをONにする
2. 表示されている「Webhook URL」と「Webhook認証トークン」をメモする
3. 外部サービス（Zapier、IFTTT、n8n など）やカスタムスクリプトから、リプライ検知時に以下の形式でWebhookを呼び出す：

```bash
curl -X POST https://<your-worker>.workers.dev/api/webhook/reply \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "webhookToken": "your-webhook-token-here",
    "platform": "misskey",
    "postUrl": "https://misskey.io/notes/abc123"
  }'
```

### パラメータ

- `userId`: ユーザーID（設定画面のWebhook URLに表示されている数値）
- `webhookToken`: 設定画面に表示されているWebhook認証トークン
- `platform`: リプライがあったプラットフォーム（`bluesky` / `misskey` / `threads` / `mixi2`）
- `postUrl`: リプライ元の投稿URL（オプション）

### 注意事項

- Webhook機能は基盤を提供するのみで、実際のリプライ検知は外部サービスやカスタムスクリプトで実装する必要があります
- 通知がONになっているプラットフォームのみ通知が送信されます
- 転記元プラットフォームの認証情報が設定されていない場合、通知の送信に失敗します

## 構成

- src/worker.js: Cloudflare Worker本体（HTTPハンドラ・cronハンドラ・queueハンドラ）
- src/adapters.js: ソース・デスティネーションアダプター（プラットフォームごとの処理を抽象化）
- src/auth.js: 認証ハンドラー（登録・ログイン・セッション管理・パスワードリセット）
- src/emailService.js: メール配信サービス（Brevo統合）
- src/settings.js: SNS設定ハンドラー
- src/crypto.js: 暗号化ユーティリティ
- src/html.js: フロントエンドHTMLテンプレート
- src/blueskyClient.js: Bluesky APIクライアント（ポスト取得）
- src/blueskyPostClient.js: Bluesky APIクライアント（ポスト投稿）
- src/threadsClient.js: Threads APIクライアント
- src/misskeyClient.js: Misskey.io APIクライアント
- src/kvStore.js: KV/D1管理
- src/formatPost.js: 投稿整形ロジック
- src/mediaProxy.js: 画像プロキシ（Threads CDN向け）
- src/notificationService.js: リプライ通知サービス
- migrations/: D1マイグレーションファイル

## セキュリティ

- ユーザーパスワードはPBKDF2+saltでハッシュ化して保存
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

