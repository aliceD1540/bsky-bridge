-- mixi2 Webhook署名検証用公開鍵（Ed25519、base64エンコード）
ALTER TABLE user_settings ADD COLUMN mixi2_webhook_public_key TEXT;
