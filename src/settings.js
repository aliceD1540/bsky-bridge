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
  const userRow = await env.DB.prepare(`
    SELECT email, email_verified
    FROM users
    WHERE id = ?
  `)
    .bind(userId)
    .first();

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

  const isAdmin = !!(env.ADMIN_EMAIL && userRow?.email === env.ADMIN_EMAIL);

  if (!row) {
    const today = new Date().toISOString().split('T')[0];
    const countKey = `daily_post_count:${today}:${userId}`;
    const countStr = await env.KV.get(countKey);
    return {
      email: userRow?.email || '',
      emailVerified: userRow ? (userRow.email_verified === 1) : false,
      isAdmin,
      sourcePlatform: 'bluesky',
      blueskyHandle: null,
      hasBlueskyAppPassword: false,
      hasMisskeyToken: false,
      hasThreadsToken: false,
      threadsTokenExpiresAt: null,
      todayPostCount: countStr ? parseInt(countStr, 10) : 0,
    };
  }

  const today = new Date().toISOString().split('T')[0];
  const countKey = `daily_post_count:${today}:${userId}`;
  const countStr = await env.KV.get(countKey);

  return {
    email: userRow?.email || '',
    emailVerified: userRow ? (userRow.email_verified === 1) : false,
    isAdmin,
    sourcePlatform: row.source_platform || 'bluesky',
    blueskyHandle: row.bluesky_handle,
    hasBlueskyAppPassword: !!(row.bluesky_app_password_encrypted),
    hasMisskeyToken: !!(row.misskey_token_encrypted),
    hasThreadsToken: !!(row.threads_token_encrypted),
    threadsTokenExpiresAt: row.threads_token_expires_at,
    todayPostCount: countStr ? parseInt(countStr, 10) : 0,
  };
}

// 全ユーザーの設定を取得（cron処理用）
export async function getAllUserSettings(env) {
  const rows = await env.DB.prepare(`
    SELECT
      u.id as user_id,
      u.email as user_email,
      u.created_at as user_created_at,
      u.email_verified,
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
      u.email_verified = 1
      AND (
        (s.source_platform = 'bluesky' AND s.bluesky_handle IS NOT NULL)
        OR (s.source_platform = 'misskey' AND s.misskey_token_encrypted IS NOT NULL)
        OR (s.source_platform = 'threads' AND s.threads_token_encrypted IS NOT NULL)
      )
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
      email: row.user_email,
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

