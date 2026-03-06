-- マルチユーザー対応のためのテーブル追加

-- ユーザー認証情報
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ユーザーごとのSNS設定（暗号化して保存）
CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER PRIMARY KEY,
  bluesky_handle TEXT,
  bluesky_password_encrypted TEXT,
  bluesky_password_iv TEXT,
  misskey_token_encrypted TEXT,
  misskey_token_iv TEXT,
  threads_token_encrypted TEXT,
  threads_token_iv TEXT,
  threads_token_expires_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- last_checkedテーブルをマルチユーザー対応に拡張
-- handleの代わりにuser_idを使用するよう変更
ALTER TABLE last_checked ADD COLUMN user_id INTEGER;

-- 既存データがある場合は削除（移行不要のため）
-- DELETE FROM last_checked;
