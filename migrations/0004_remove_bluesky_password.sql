-- Blueskyアプリパスワードはハンドル所有確認時のみ使用し保存不要なため削除
ALTER TABLE user_settings DROP COLUMN bluesky_password_encrypted;
ALTER TABLE user_settings DROP COLUMN bluesky_password_iv;
