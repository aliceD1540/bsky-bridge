-- user_settings に転記元プラットフォームと Bluesky 転記先用アプリパスワードを追加
ALTER TABLE user_settings ADD COLUMN source_platform TEXT NOT NULL DEFAULT 'bluesky';
ALTER TABLE user_settings ADD COLUMN bluesky_app_password_encrypted TEXT;
ALTER TABLE user_settings ADD COLUMN bluesky_app_password_iv TEXT;

-- last_checked を (user_id, source_platform) 複合主キーに再作成
-- 旧スキーマ: handle TEXT PK, last_posted_at TEXT, user_id INTEGER
CREATE TABLE last_checked_new (
  user_id INTEGER NOT NULL,
  source_platform TEXT NOT NULL DEFAULT 'bluesky',
  last_posted_at TEXT NOT NULL,
  PRIMARY KEY (user_id, source_platform)
);

INSERT INTO last_checked_new (user_id, source_platform, last_posted_at)
  SELECT user_id, 'bluesky', last_posted_at
  FROM last_checked
  WHERE user_id IS NOT NULL;

DROP TABLE last_checked;
ALTER TABLE last_checked_new RENAME TO last_checked;
