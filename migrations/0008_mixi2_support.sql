-- mixi2対応のためのフィールド追加
-- mixi2は「自動投稿できるのはBotアカウントのみ」という制約があるため、
-- 転記元アカウントIDと投稿用Botアカウントの認証情報を分けて保持する

ALTER TABLE user_settings ADD COLUMN mixi2_source_user_id TEXT;
ALTER TABLE user_settings ADD COLUMN mixi2_client_id_encrypted TEXT;
ALTER TABLE user_settings ADD COLUMN mixi2_client_id_iv TEXT;
ALTER TABLE user_settings ADD COLUMN mixi2_client_secret_encrypted TEXT;
ALTER TABLE user_settings ADD COLUMN mixi2_client_secret_iv TEXT;
ALTER TABLE user_settings ADD COLUMN mixi2_access_token_encrypted TEXT;
ALTER TABLE user_settings ADD COLUMN mixi2_access_token_iv TEXT;
ALTER TABLE user_settings ADD COLUMN mixi2_token_expires_at TEXT;
