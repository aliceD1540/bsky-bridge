-- メール確認とパスワードリセット機能用のカラム追加

ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN email_verification_token TEXT;
ALTER TABLE users ADD COLUMN email_verification_expires_at TEXT;
ALTER TABLE users ADD COLUMN password_reset_token TEXT;
ALTER TABLE users ADD COLUMN password_reset_expires_at TEXT;

-- 既存ユーザーはすべてメール確認済みとして扱う
UPDATE users SET email_verified = 1;
