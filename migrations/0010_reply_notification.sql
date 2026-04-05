-- リプライ通知機能の追加

-- user_settings テーブルに各プラットフォームごとの通知ON/OFFフラグを追加
-- Blueskyはwebhook非対応のため対象外
ALTER TABLE user_settings ADD COLUMN notify_reply_misskey INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN notify_reply_threads INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN notify_reply_mixi2 INTEGER NOT NULL DEFAULT 0;

-- Webhook認証トークン（各ユーザーごとに自動生成）
ALTER TABLE user_settings ADD COLUMN webhook_token TEXT;
