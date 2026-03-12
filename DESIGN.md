# Bluesky Bridge

## 概要

Bluesky・Misskey.io・Threads のいずれかを転記元として選択し、認証情報を設定した他プラットフォームへ自動転記するサービス（マルチユーザー対応）

## 動作環境

Cloudflare Worker, KV, D1, Queues

## データベース構造（D1）

- `users`: ユーザー認証情報（メールアドレス、パスワードハッシュ、メール確認トークン、パスワードリセットトークン）
- `user_settings`: ユーザーごとのSNS設定（暗号化された認証情報、転記元プラットフォーム）
- `last_checked`: ユーザー・プラットフォームごとの前回チェック時刻（複合主キー: `user_id + source_platform`）

## KVデータ構造

| キー | 内容 | TTL |
|------|------|-----|
| `session:{token}` | セッション情報 | 30日 |
| `posted:{platform}:{postId}` | 投稿済みフラグ（冪等性） | 設定あり |
| `daily_post_count:{YYYY-MM-DD}:{userId}` | 本日の転記回数 | 翌日UTC0時+1時間 |
| `rate_limit:{action}:{ip}` | ログイン/登録の試行回数 | 15分 |
| `oauth_state:{state}` | Threads OAuth stateとuserId | 10分 |
| `source_identity:{platform}:{userId}` | ソースアカウントのIDキャッシュ | 設定あり |

## セキュリティ

- パスワードはPBKDF2+saltでハッシュ化して保存
- SNS認証情報はAES-GCMで暗号化してD1に保存
- マスターキーはCloudflare Secretsで管理
- セッショントークンはKVに保存（30日有効）
- ログイン・新規登録はIPごとに5回失敗で15分ロックアウト
- POSTリクエストはOriginヘッダーでCSRF対策
- メール確認トークン（24時間有効）・パスワードリセットトークン（1時間有効）は暗号的に安全なランダム値

## アダプターパターン

`src/adapters.js` で各プラットフォームの処理を抽象化。

**ソースアダプター (`SOURCE_ADAPTERS`)**: `bluesky` / `misskey` / `threads`
- `isConfigured(userSettings)`: 認証情報の設定確認
- `getIdentity(env, userSettings)`: アカウント情報取得（Misskey・Threadsはキャッシュあり）
- `pollNewPosts(env, userSettings, since)`: 新規ポスト取得
- `fetchAndNormalizePost(env, userSettings, postIdOrPost)`: ポスト取得・正規化

**デスティネーションアダプター (`DEST_ADAPTERS`)**: `bluesky` / `misskey` / `threads`
- `isConfigured(userSettings)`: 認証情報の設定確認
- `post(env, userSettings, formatted)`: 投稿実行

転記元プラットフォームは転記先から自動的に除外される（`getDestinationsForUser`）。

## 処理の流れ

### cron（5分おき）

1. メール確認済み・かつ転記元の認証情報が設定済みの全ユーザーを取得
2. ユーザーごとに以下の処理を実行：
   - メンテナンスモード中は管理者以外スキップ
   - 本日の転記回数が上限（`DAILY_POST_LIMIT = 20`）に達している場合はスキップ（管理者は無制限）
   - D1から前回チェック時刻を取得（未設定の場合はユーザー登録日時）
   - ソースアダプターで前回チェック時刻以降の新規ポストを取得
   - KVで投稿済みチェックを行い、未投稿のポストのみを対象にする
   - 新規ポストを古い順にCloudflare Queuesへ追加（5秒間隔で遅延）
   - キュー追加成功後、本日の転記回数をインクリメント
   - 最新ポストの作成時刻をD1に「前回チェック時刻」として保存

### queue（キュー消費）

1. キューからポストIDとユーザーID・転記元プラットフォームを取得
2. KVで投稿済みチェック（冪等性保証）
3. メンテナンスモード中は管理者以外 retry（メンテナンス終了後に処理）
4. ユーザー設定を取得し、認証情報を復号化
5. Threadsトークンが7日以内に期限切れの場合は自動リフレッシュ
6. `getDestinationsForUser` で転記先プラットフォームを決定
7. ソースアダプターでポストを取得・正規化
8. `formatPost` で各プラットフォーム向けに整形
9. 転記先アダプターへ並行投稿（`Promise.allSettled`）
10. 全成功時のみ KV に投稿済みとして記録し ack、一部失敗時は retry

### fetch（HTTPリクエスト）

フロントエンドとAPIエンドポイントを提供：

**ページ**
- `/`: `/login` へリダイレクト
- `/login`: ログイン画面
- `/register`: 新規登録画面
- `/settings`: 設定画面（ログイン中のメールアドレス・本日の転記回数を表示）
- `/verify-email`: メールアドレス確認画面
- `/forgot-password`: パスワードリセット要求画面
- `/reset-password`: パスワードリセット画面

**認証API**
- `POST /api/register`: アカウント登録（IPレートリミット: 5回/15分）
- `POST /api/login`: ログイン（IPレートリミット: 5回/15分）
- `POST /api/logout`: ログアウト
- `POST /api/change-password`: パスワード変更
- `POST /api/delete-account`: アカウント削除
- `POST /api/verify-email`: メールアドレス確認
- `POST /api/forgot-password`: パスワードリセットメール送信
- `POST /api/reset-password`: パスワードリセット

**設定API**
- `GET /api/settings`: 設定取得（メールアドレス・転記回数・上限を含む）
- `POST /api/settings`: 設定保存（Bluesky認証検証・転記元変更時の last_checked リセットを含む）

**Threads OAuth**
- `POST /auth/threads/start`: OAuth認可URL生成（stateをKVに保存）
- `GET /auth/threads/callback`: OAuthコールバック（短期→長期トークン交換）
- `POST /api/threads/disconnect`: Threads連携解除

**その他**
- `GET /media/{key}`: 画像プロキシ（Threads CDNが外部CDN画像を取得できないための中継）

## ポスト整形（`formatPost`）

転記元プラットフォームに関わらず、以下の共通ルールで整形する：

- リプライは転記しない
- リポストは「Repost {元ポストのURL}」で投稿
- 引用ポストは「{本文} {引用ポストのURL}」で投稿
- テキストが500文字を超える場合は400文字に切り詰め、末尾に「全文はこちら：{ソースURL}」を付加
  - 切り詰め時はカードURLを含めない
- カード付きポストはURLを本文末尾に付加
- 画像は最大4枚（Bluesky仕様の上限）
- CW（コンテンツ警告）付きMisskeyノートは転記しない

## Threads固有の制約

- 24時間で250件まで投稿可能（上限到達時はエラーログのみ）
- Threads CDNは外部CDN画像を直接取得できないため、画像は `/media/` プロキシ経由で配信
- OAuthトークンの有効期限は60日。期限7日前に自動リフレッシュ。期限切れの場合はトークンを削除し設定画面に再連携を促す

## 補足

- Cloudflare Queues は At-Least-Once デリバリーのため、KVの投稿済みチェックによる冪等性処理が必須
- 過去のポストは遡らず、ユーザー登録日時以降のポストのみ処理する
- 転記元プラットフォームを切り替えた場合、切り替え時点の時刻を新プラットフォームの `last_checked` に設定し、遡り転記を防ぐ
- KVへの書き込み回数はなるべく抑えること

