-- リプライ通知機能の追加（0009_reply_notification.sql 適用済み・未適用どちらにも対応）
-- Blueskyはwebhook非対応のため notify_reply_bluesky は含めない
-- テーブル再作成により、既存カラムの有無に関わらず安全に適用できる

CREATE TABLE user_settings_new (
  user_id INTEGER PRIMARY KEY,
  bluesky_handle TEXT,
  misskey_token_encrypted TEXT,
  misskey_token_iv TEXT,
  threads_token_encrypted TEXT,
  threads_token_iv TEXT,
  threads_token_expires_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  source_platform TEXT NOT NULL DEFAULT 'bluesky',
  bluesky_app_password_encrypted TEXT,
  bluesky_app_password_iv TEXT,
  mixi2_client_id_encrypted TEXT,
  mixi2_client_id_iv TEXT,
  mixi2_client_secret_encrypted TEXT,
  mixi2_client_secret_iv TEXT,
  mixi2_access_token_encrypted TEXT,
  mixi2_access_token_iv TEXT,
  mixi2_token_expires_at TEXT,
  notify_reply_misskey INTEGER NOT NULL DEFAULT 0,
  notify_reply_threads INTEGER NOT NULL DEFAULT 0,
  notify_reply_mixi2 INTEGER NOT NULL DEFAULT 0,
  webhook_token TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 通知カラムはデフォルト値でコピー（旧0009適用済みでも未適用でも安全）
INSERT INTO user_settings_new (
  user_id, bluesky_handle,
  misskey_token_encrypted, misskey_token_iv,
  threads_token_encrypted, threads_token_iv, threads_token_expires_at,
  updated_at, source_platform,
  bluesky_app_password_encrypted, bluesky_app_password_iv,
  mixi2_client_id_encrypted, mixi2_client_id_iv,
  mixi2_client_secret_encrypted, mixi2_client_secret_iv,
  mixi2_access_token_encrypted, mixi2_access_token_iv,
  mixi2_token_expires_at,
  notify_reply_misskey, notify_reply_threads, notify_reply_mixi2,
  webhook_token
)
SELECT
  user_id, bluesky_handle,
  misskey_token_encrypted, misskey_token_iv,
  threads_token_encrypted, threads_token_iv, threads_token_expires_at,
  updated_at, source_platform,
  bluesky_app_password_encrypted, bluesky_app_password_iv,
  mixi2_client_id_encrypted, mixi2_client_id_iv,
  mixi2_client_secret_encrypted, mixi2_client_secret_iv,
  mixi2_access_token_encrypted, mixi2_access_token_iv,
  mixi2_token_expires_at,
  0, 0, 0,
  NULL
FROM user_settings;

DROP TABLE user_settings;
ALTER TABLE user_settings_new RENAME TO user_settings;
