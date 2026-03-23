-- お知らせ機能用テーブル（単一レコード設計）
CREATE TABLE IF NOT EXISTS announcements (
  id      INTEGER PRIMARY KEY DEFAULT 1,
  content TEXT    NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 初期レコードを挿入（id=1 固定で常に1件のみ管理）
INSERT OR IGNORE INTO announcements (id, content) VALUES (1, '');
