-- Threads ユーザーID保存（Webhook のルーティングに使用）
ALTER TABLE user_settings ADD COLUMN threads_user_id TEXT;
