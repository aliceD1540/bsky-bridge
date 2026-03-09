-- パスワードハッシュのバージョン管理カラム追加
-- 1: SHA-256（旧）, 2: PBKDF2+salt（新）
ALTER TABLE users ADD COLUMN password_hash_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN password_salt TEXT;
