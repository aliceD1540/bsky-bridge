// SNS設定ハンドラー

import { encrypt, decrypt } from './crypto.js';

// 設定保存
export async function saveSettings(env, userId, settings) {
  const {
    blueskyHandle,
    blueskyPassword,
    misskeyToken,
    threadsToken,
    threadsTokenExpiresAt,
  } = settings;

  // 暗号化
  const blueskyPasswordEnc = blueskyPassword
    ? await encrypt(blueskyPassword, env)
    : { cipherText: null, iv: null };
  const misskeyTokenEnc = misskeyToken
    ? await encrypt(misskeyToken, env)
    : { cipherText: null, iv: null };
  const threadsTokenEnc = threadsToken
    ? await encrypt(threadsToken, env)
    : { cipherText: null, iv: null };

  const now = new Date().toISOString();

  // 既存設定の確認
  const existing = await env.DB.prepare('SELECT user_id FROM user_settings WHERE user_id = ?')
    .bind(userId)
    .first();

  if (existing) {
    // 更新
    await env.DB.prepare(`
      UPDATE user_settings SET
        bluesky_handle = ?,
        bluesky_password_encrypted = ?,
        bluesky_password_iv = ?,
        misskey_token_encrypted = ?,
        misskey_token_iv = ?,
        threads_token_encrypted = ?,
        threads_token_iv = ?,
        threads_token_expires_at = ?,
        updated_at = ?
      WHERE user_id = ?
    `)
      .bind(
        blueskyHandle || null,
        blueskyPasswordEnc.cipherText,
        blueskyPasswordEnc.iv,
        misskeyTokenEnc.cipherText,
        misskeyTokenEnc.iv,
        threadsTokenEnc.cipherText,
        threadsTokenEnc.iv,
        threadsTokenExpiresAt || null,
        now,
        userId
      )
      .run();
  } else {
    // 新規作成
    await env.DB.prepare(`
      INSERT INTO user_settings (
        user_id,
        bluesky_handle,
        bluesky_password_encrypted,
        bluesky_password_iv,
        misskey_token_encrypted,
        misskey_token_iv,
        threads_token_encrypted,
        threads_token_iv,
        threads_token_expires_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        userId,
        blueskyHandle || null,
        blueskyPasswordEnc.cipherText,
        blueskyPasswordEnc.iv,
        misskeyTokenEnc.cipherText,
        misskeyTokenEnc.iv,
        threadsTokenEnc.cipherText,
        threadsTokenEnc.iv,
        threadsTokenExpiresAt || null,
        now
      )
      .run();
  }

  return { success: true };
}

// 設定取得
export async function getSettings(env, userId) {
  const row = await env.DB.prepare(`
    SELECT
      bluesky_handle,
      bluesky_password_encrypted,
      bluesky_password_iv,
      misskey_token_encrypted,
      misskey_token_iv,
      threads_token_encrypted,
      threads_token_iv,
      threads_token_expires_at
    FROM user_settings
    WHERE user_id = ?
  `)
    .bind(userId)
    .first();

  if (!row) {
    return null;
  }

  // 復号化
  const blueskyPassword = row.bluesky_password_encrypted
    ? await decrypt(row.bluesky_password_encrypted, row.bluesky_password_iv, env)
    : null;
  const misskeyToken = row.misskey_token_encrypted
    ? await decrypt(row.misskey_token_encrypted, row.misskey_token_iv, env)
    : null;
  const threadsToken = row.threads_token_encrypted
    ? await decrypt(row.threads_token_encrypted, row.threads_token_iv, env)
    : null;

  return {
    blueskyHandle: row.bluesky_handle,
    blueskyPassword,
    misskeyToken,
    threadsToken,
    threadsTokenExpiresAt: row.threads_token_expires_at,
  };
}

// 公開用設定取得（パスワード等を含まない）
export async function getPublicSettings(env, userId) {
  const row = await env.DB.prepare(`
    SELECT
      bluesky_handle,
      threads_token_expires_at
    FROM user_settings
    WHERE user_id = ?
  `)
    .bind(userId)
    .first();

  if (!row) {
    return null;
  }

  return {
    blueskyHandle: row.bluesky_handle,
    hasBlueskyPassword: !!(row.bluesky_password_encrypted),
    hasMisskeyToken: !!(row.misskey_token_encrypted),
    hasThreadsToken: !!(row.threads_token_encrypted),
    threadsTokenExpiresAt: row.threads_token_expires_at,
  };
}

// 全ユーザーの設定を取得（cron処理用）
export async function getAllUserSettings(env) {
  const rows = await env.DB.prepare(`
    SELECT
      u.id as user_id,
      u.created_at as user_created_at,
      s.bluesky_handle,
      s.bluesky_password_encrypted,
      s.bluesky_password_iv,
      s.misskey_token_encrypted,
      s.misskey_token_iv,
      s.threads_token_encrypted,
      s.threads_token_iv,
      s.threads_token_expires_at
    FROM users u
    LEFT JOIN user_settings s ON u.id = s.user_id
    WHERE s.bluesky_handle IS NOT NULL
  `).all();

  const settings = [];
  for (const row of rows.results || []) {
    const blueskyPassword = row.bluesky_password_encrypted
      ? await decrypt(row.bluesky_password_encrypted, row.bluesky_password_iv, env)
      : null;
    const misskeyToken = row.misskey_token_encrypted
      ? await decrypt(row.misskey_token_encrypted, row.misskey_token_iv, env)
      : null;
    const threadsToken = row.threads_token_encrypted
      ? await decrypt(row.threads_token_encrypted, row.threads_token_iv, env)
      : null;

    settings.push({
      userId: row.user_id,
      userCreatedAt: row.user_created_at,
      blueskyHandle: row.bluesky_handle,
      blueskyPassword,
      misskeyToken,
      threadsToken,
      threadsTokenExpiresAt: row.threads_token_expires_at,
    });
  }

  return settings;
}
