-- ユーザーごとの前回投稿時刻を管理するテーブル
CREATE TABLE IF NOT EXISTS last_checked (
  handle TEXT PRIMARY KEY,
  last_posted_at TEXT NOT NULL
);
