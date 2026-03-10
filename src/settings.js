// SNS設定ハンドラー

import { encrypt, decrypt } from './crypto.js';

// 設定保存
export async function saveSettings(env, userId, settings) {
  const {
    sourcePlatform,
    blueskyHandle,
    blueskyAppPassword,
    misskeyToken,
    threadsToken,
    threadsTokenExpiresAt,
  } = settings;

  const now = new Date().toISOString();

  // 既存設定の確認（空欄フィールドは既存値を維持するために全カラム取得）
  const existing = await env.DB.prepare(`
    SELECT
      source_platform,
      bluesky_handle,
      bluesky_app_password_encrypted,
      bluesky_app_password_iv,
      misskey_token_encrypted,
      misskey_token_iv,
      threads_token_encrypted,
      threads_token_iv,
      threads_token_expires_at
    FROM user_settings WHERE user_id = ?
  `)
    .bind(userId)
    .first();

  // undefinedまたは空文字は既存値を維持、nullは明示クリア、文字列は再暗号化
  const encryptOrKeep = async (newVal, encField, ivField) => {
    if (newVal) return encrypt(newVal, env);
    if (newVal === null) return { cipherText: null, iv: null };
    return { cipherText: existing?.[encField] ?? null, iv: existing?.[ivField] ?? null };
  };

  const blueskyAppPasswordEnc = await encryptOrKeep(
    blueskyAppPassword,
    'bluesky_app_password_encrypted',
    'bluesky_app_password_iv'
  );
  const misskeyTokenEnc = await encryptOrKeep(
    misskeyToken,
    'misskey_token_encrypted',
    'misskey_token_iv'
  );
  const threadsTokenEnc = await encryptOrKeep(
    threadsToken,
    'threads_token_encrypted',
    'threads_token_iv'
  );

  const newThreadsExpiresAt = threadsTokenExpiresAt === undefined
    ? (existing?.threads_token_expires_at ?? null)
    : threadsTokenExpiresAt;
  const newSourcePlatform = sourcePlatform || existing?.source_platform || 'bluesky';
  const newBlueskyHandle = blueskyHandle || existing?.bluesky_handle || null;

  if (existing) {
    await env.DB.prepare(`
      UPDATE user_settings SET
        source_platform = ?,
        bluesky_handle = ?,
        bluesky_app_password_encrypted = ?,
        bluesky_app_password_iv = ?,
        misskey_token_encrypted = ?,
        misskey_token_iv = ?,
        threads_token_encrypted = ?,
        threads_token_iv = ?,
        threads_token_expires_at = ?,
        updated_at = ?
      WHERE user_id = ?
    `)
      .bind(
        newSourcePlatform,
        newBlueskyHandle,
        blueskyAppPasswordEnc.cipherText,
        blueskyAppPasswordEnc.iv,
        misskeyTokenEnc.cipherText,
        misskeyTokenEnc.iv,
        threadsTokenEnc.cipherText,
        threadsTokenEnc.iv,
        newThreadsExpiresAt,
        now,
        userId
      )
      .run();
  } else {
    await env.DB.prepare(`
      INSERT INTO user_settings (
        user_id,
        source_platform,
        bluesky_handle,
        bluesky_app_password_encrypted,
        bluesky_app_password_iv,
        misskey_token_encrypted,
        misskey_token_iv,
        threads_token_encrypted,
        threads_token_iv,
        threads_token_expires_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        userId,
        newSourcePlatform,
        newBlueskyHandle,
        blueskyAppPasswordEnc.cipherText,
        blueskyAppPasswordEnc.iv,
        misskeyTokenEnc.cipherText,
        misskeyTokenEnc.iv,
        threadsTokenEnc.cipherText,
        threadsTokenEnc.iv,
        threadsTokenExpiresAt ?? null,
        now
      )
      .run();
  }

  return { success: true };
}

// 設定取得（復号済み）
export async function getSettings(env, userId) {
  const row = await env.DB.prepare(`
    SELECT
      source_platform,
      bluesky_handle,
      bluesky_app_password_encrypted,
      bluesky_app_password_iv,
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

  if (!row) return null;

  const blueskyAppPassword = row.bluesky_app_password_encrypted
    ? await decrypt(row.bluesky_app_password_encrypted, row.bluesky_app_password_iv, env)
    : null;
  const misskeyToken = row.misskey_token_encrypted
    ? await decrypt(row.misskey_token_encrypted, row.misskey_token_iv, env)
    : null;
  const threadsToken = row.threads_token_encrypted
    ? await decrypt(row.threads_token_encrypted, row.threads_token_iv, env)
    : null;

  return {
    sourcePlatform: row.source_platform || 'bluesky',
    blueskyHandle: row.bluesky_handle,
    blueskyAppPassword,
    misskeyToken,
    threadsToken,
    threadsTokenExpiresAt: row.threads_token_expires_at,
  };
}

// 公開用設定取得（トークン有無のみ、値は含まない）
export async function getPublicSettings(env, userId) {
  const row = await env.DB.prepare(`
    SELECT
      source_platform,
      bluesky_handle,
      bluesky_app_password_encrypted,
      misskey_token_encrypted,
      threads_token_encrypted,
      threads_token_expires_at
    FROM user_settings
    WHERE user_id = ?
  `)
    .bind(userId)
    .first();

  if (!row) return null;

  return {
    sourcePlatform: row.source_platform || 'bluesky',
    blueskyHandle: row.bluesky_handle,
    hasBlueskyAppPassword: !!(row.bluesky_app_password_encrypted),
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
      s.source_platform,
      s.bluesky_handle,
      s.bluesky_app_password_encrypted,
      s.bluesky_app_password_iv,
      s.misskey_token_encrypted,
      s.misskey_token_iv,
      s.threads_token_encrypted,
      s.threads_token_iv,
      s.threads_token_expires_at
    FROM users u
    LEFT JOIN user_settings s ON u.id = s.user_id
    WHERE
      (s.source_platform = 'bluesky' AND s.bluesky_handle IS NOT NULL)
      OR (s.source_platform = 'misskey' AND s.misskey_token_encrypted IS NOT NULL)
      OR (s.source_platform = 'threads' AND s.threads_token_encrypted IS NOT NULL)
  `).all();

  const settings = [];
  for (const row of rows.results || []) {
    const blueskyAppPassword = row.bluesky_app_password_encrypted
      ? await decrypt(row.bluesky_app_password_encrypted, row.bluesky_app_password_iv, env)
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
      sourcePlatform: row.source_platform || 'bluesky',
      blueskyHandle: row.bluesky_handle,
      blueskyAppPassword,
      misskeyToken,
      threadsToken,
      threadsTokenExpiresAt: row.threads_token_expires_at,
    });
  }

  return settings;
}

