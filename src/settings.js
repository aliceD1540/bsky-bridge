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
    threadsUserId,
    mixi2ClientId,
    mixi2ClientSecret,
    mixi2AccessToken,
    mixi2TokenExpiresAt,
    mixi2WebhookPublicKey,
    notifyReplyMisskey,
    notifyReplyThreads,
    notifyReplyMixi2,
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
      threads_token_expires_at,
      threads_user_id,
      mixi2_client_id_encrypted,
      mixi2_client_id_iv,
      mixi2_client_secret_encrypted,
      mixi2_client_secret_iv,
      mixi2_access_token_encrypted,
      mixi2_access_token_iv,
      mixi2_token_expires_at,
      mixi2_webhook_public_key,
      notify_reply_misskey,
      notify_reply_threads,
      notify_reply_mixi2,
      webhook_token
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
  const mixi2ClientIdEnc = await encryptOrKeep(
    mixi2ClientId,
    'mixi2_client_id_encrypted',
    'mixi2_client_id_iv'
  );
  const mixi2ClientSecretEnc = await encryptOrKeep(
    mixi2ClientSecret,
    'mixi2_client_secret_encrypted',
    'mixi2_client_secret_iv'
  );
  const mixi2AccessTokenEnc = await encryptOrKeep(
    mixi2AccessToken,
    'mixi2_access_token_encrypted',
    'mixi2_access_token_iv'
  );

  const newThreadsExpiresAt = threadsTokenExpiresAt === undefined
    ? (existing?.threads_token_expires_at ?? null)
    : threadsTokenExpiresAt;
  const newThreadsUserId = threadsUserId !== undefined ? (threadsUserId || null) : (existing?.threads_user_id ?? null);
  const newMixi2TokenExpiresAt = mixi2TokenExpiresAt === undefined
    ? (existing?.mixi2_token_expires_at ?? null)
    : mixi2TokenExpiresAt;
  const newSourcePlatform = sourcePlatform || existing?.source_platform || 'bluesky';
  const newBlueskyHandle = blueskyHandle || existing?.bluesky_handle || null;

  const newMixi2WebhookPublicKey = mixi2WebhookPublicKey !== undefined ? (mixi2WebhookPublicKey || null) : (existing?.mixi2_webhook_public_key ?? null);

  const newNotifyReplyMisskey = notifyReplyMisskey !== undefined ? (notifyReplyMisskey ? 1 : 0) : (existing?.notify_reply_misskey ?? 0);
  const newNotifyReplyThreads = notifyReplyThreads !== undefined ? (notifyReplyThreads ? 1 : 0) : (existing?.notify_reply_threads ?? 0);
  const newNotifyReplyMixi2 = notifyReplyMixi2 !== undefined ? (notifyReplyMixi2 ? 1 : 0) : (existing?.notify_reply_mixi2 ?? 0);

  let webhookToken = existing?.webhook_token;
  if (!webhookToken) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    webhookToken = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  }

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
        threads_user_id = ?,
        mixi2_client_id_encrypted = ?,
        mixi2_client_id_iv = ?,
        mixi2_client_secret_encrypted = ?,
        mixi2_client_secret_iv = ?,
        mixi2_access_token_encrypted = ?,
        mixi2_access_token_iv = ?,
        mixi2_token_expires_at = ?,
        mixi2_webhook_public_key = ?,
        notify_reply_misskey = ?,
        notify_reply_threads = ?,
        notify_reply_mixi2 = ?,
        webhook_token = ?,
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
        newThreadsUserId,
        mixi2ClientIdEnc.cipherText,
        mixi2ClientIdEnc.iv,
        mixi2ClientSecretEnc.cipherText,
        mixi2ClientSecretEnc.iv,
        mixi2AccessTokenEnc.cipherText,
        mixi2AccessTokenEnc.iv,
        newMixi2TokenExpiresAt,
        newMixi2WebhookPublicKey,
        newNotifyReplyMisskey,
        newNotifyReplyThreads,
        newNotifyReplyMixi2,
        webhookToken,
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
        threads_user_id,
        mixi2_client_id_encrypted,
        mixi2_client_id_iv,
        mixi2_client_secret_encrypted,
        mixi2_client_secret_iv,
        mixi2_access_token_encrypted,
        mixi2_access_token_iv,
        mixi2_token_expires_at,
        mixi2_webhook_public_key,
        notify_reply_misskey,
        notify_reply_threads,
        notify_reply_mixi2,
        webhook_token,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        newThreadsUserId,
        mixi2ClientIdEnc.cipherText,
        mixi2ClientIdEnc.iv,
        mixi2ClientSecretEnc.cipherText,
        mixi2ClientSecretEnc.iv,
        mixi2AccessTokenEnc.cipherText,
        mixi2AccessTokenEnc.iv,
        mixi2TokenExpiresAt ?? null,
        newMixi2WebhookPublicKey,
        newNotifyReplyMisskey,
        newNotifyReplyThreads,
        newNotifyReplyMixi2,
        webhookToken,
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
      threads_token_expires_at,
      threads_user_id,
      mixi2_client_id_encrypted,
      mixi2_client_id_iv,
      mixi2_client_secret_encrypted,
      mixi2_client_secret_iv,
      mixi2_access_token_encrypted,
      mixi2_access_token_iv,
      mixi2_token_expires_at,
      mixi2_webhook_public_key,
      notify_reply_misskey,
      notify_reply_threads,
      notify_reply_mixi2,
      webhook_token
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
  const mixi2ClientId = row.mixi2_client_id_encrypted
    ? await decrypt(row.mixi2_client_id_encrypted, row.mixi2_client_id_iv, env)
    : null;
  const mixi2ClientSecret = row.mixi2_client_secret_encrypted
    ? await decrypt(row.mixi2_client_secret_encrypted, row.mixi2_client_secret_iv, env)
    : null;
  const mixi2AccessToken = row.mixi2_access_token_encrypted
    ? await decrypt(row.mixi2_access_token_encrypted, row.mixi2_access_token_iv, env)
    : null;

  return {
    sourcePlatform: row.source_platform || 'bluesky',
    blueskyHandle: row.bluesky_handle,
    blueskyAppPassword,
    misskeyToken,
    threadsToken,
    threadsTokenExpiresAt: row.threads_token_expires_at,
    threadsUserId: row.threads_user_id || null,
    mixi2ClientId,
    mixi2ClientSecret,
    mixi2AccessToken,
    mixi2TokenExpiresAt: row.mixi2_token_expires_at,
    mixi2WebhookPublicKey: row.mixi2_webhook_public_key || null,
    notifyReplyMisskey: row.notify_reply_misskey === 1,
    notifyReplyThreads: row.notify_reply_threads === 1,
    notifyReplyMixi2: row.notify_reply_mixi2 === 1,
    webhookToken: row.webhook_token,
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
      threads_token_expires_at,
      mixi2_client_id_encrypted,
      mixi2_client_secret_encrypted,
      mixi2_access_token_encrypted,
      mixi2_token_expires_at,
      mixi2_webhook_public_key,
      notify_reply_misskey,
      notify_reply_threads,
      notify_reply_mixi2,
      webhook_token
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
      userId,
      email: userRow?.email || '',
      emailVerified: userRow ? (userRow.email_verified === 1) : false,
      isAdmin,
      sourcePlatform: 'bluesky',
      blueskyHandle: null,
      hasBlueskyAppPassword: false,
      hasMisskeyToken: false,
      hasThreadsToken: false,
      threadsTokenExpiresAt: null,
      hasMixi2Config: false,
      mixi2TokenExpiresAt: null,
      mixi2WebhookPublicKey: null,
      todayPostCount: countStr ? parseInt(countStr, 10) : 0,
      notifyReplyMisskey: false,
      notifyReplyThreads: false,
      notifyReplyMixi2: false,
      webhookToken: null,
    };
  }

  const today = new Date().toISOString().split('T')[0];
  const countKey = `daily_post_count:${today}:${userId}`;
  const countStr = await env.KV.get(countKey);

  return {
    userId,
    email: userRow?.email || '',
    emailVerified: userRow ? (userRow.email_verified === 1) : false,
    isAdmin,
    sourcePlatform: row.source_platform || 'bluesky',
    blueskyHandle: row.bluesky_handle,
    hasBlueskyAppPassword: !!(row.bluesky_app_password_encrypted),
    hasMisskeyToken: !!(row.misskey_token_encrypted),
    hasThreadsToken: !!(row.threads_token_encrypted),
    threadsTokenExpiresAt: row.threads_token_expires_at,
    hasMixi2Config: !!(row.mixi2_client_id_encrypted && row.mixi2_client_secret_encrypted),
    mixi2TokenExpiresAt: row.mixi2_token_expires_at,
    mixi2WebhookPublicKey: row.mixi2_webhook_public_key || null,
    todayPostCount: countStr ? parseInt(countStr, 10) : 0,
    notifyReplyMisskey: row.notify_reply_misskey === 1,
    notifyReplyThreads: row.notify_reply_threads === 1,
    notifyReplyMixi2: row.notify_reply_mixi2 === 1,
    webhookToken: row.webhook_token,
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
      s.threads_token_expires_at,
      s.mixi2_client_id_encrypted,
      s.mixi2_client_id_iv,
      s.mixi2_client_secret_encrypted,
      s.mixi2_client_secret_iv,
      s.mixi2_access_token_encrypted,
      s.mixi2_access_token_iv,
      s.mixi2_token_expires_at
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
    const mixi2ClientId = row.mixi2_client_id_encrypted
      ? await decrypt(row.mixi2_client_id_encrypted, row.mixi2_client_id_iv, env)
      : null;
    const mixi2ClientSecret = row.mixi2_client_secret_encrypted
      ? await decrypt(row.mixi2_client_secret_encrypted, row.mixi2_client_secret_iv, env)
      : null;
    const mixi2AccessToken = row.mixi2_access_token_encrypted
      ? await decrypt(row.mixi2_access_token_encrypted, row.mixi2_access_token_iv, env)
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
      mixi2ClientId,
      mixi2ClientSecret,
      mixi2AccessToken,
      mixi2TokenExpiresAt: row.mixi2_token_expires_at,
    });
  }

  return settings;
}

// Threads ユーザーID でbsky-bridgeのユーザーIDを検索（Webhook ルーティング用）
export async function findUserByThreadsUserId(env, threadsUserId) {
  const row = await env.DB.prepare(
    'SELECT user_id FROM user_settings WHERE threads_user_id = ?'
  )
    .bind(threadsUserId)
    .first();
  return row?.user_id ?? null;
}

// webhookToken でbsky-bridgeのユーザーIDを検索（Threads Webhook GET 検証用）
export async function findUserByWebhookToken(env, webhookToken) {
  const row = await env.DB.prepare(
    'SELECT user_id FROM user_settings WHERE webhook_token = ?'
  )
    .bind(webhookToken)
    .first();
  return row?.user_id ?? null;
}
