// KV/D1スキーマ設計・初期化
// KV: 投稿済みポストIDの保存
// D1: 必要に応じて詳細情報保存（今回はKVのみで十分）

// KVのキー例: 'posted:{bluesky_post_id}'

export async function isPosted(env, postId) {
  // env: Cloudflare Workerのenv
  // postId: BlueskyポストID
  return (await env.KV.get(`posted:${postId}`)) !== null;
}

// posted: エントリは7日後に自動削除（KV無制限肥大化を防ぐ）
const POSTED_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function markPosted(env, postId, createdAt) {
  await env.KV.put(`posted:${postId}`, createdAt, { expirationTtl: POSTED_TTL_SECONDS });
}

// Threads アクセストークンのKVストレージ
const THREADS_TOKEN_KEY = 'threads:access_token';
const THREADS_TOKEN_EXPIRY_KEY = 'threads:token_expiry';

export async function getStoredThreadsToken(env) {
  const [token, expiry] = await Promise.all([
    env.KV.get(THREADS_TOKEN_KEY),
    env.KV.get(THREADS_TOKEN_EXPIRY_KEY),
  ]);
  return { token, expiresAt: expiry ? new Date(expiry) : null };
}

export async function storeThreadsToken(env, token, expiresAt) {
  await Promise.all([
    env.KV.put(THREADS_TOKEN_KEY, token),
    env.KV.put(THREADS_TOKEN_EXPIRY_KEY, expiresAt.toISOString()),
  ]);
}

// D1: ユーザーごとの前回チェック時刻管理（マルチユーザー対応）
export async function getLastPostedAt(env, userId) {
  const row = await env.DB.prepare('SELECT last_posted_at FROM last_checked WHERE user_id = ?')
    .bind(userId)
    .first();
  return row?.last_posted_at || null;
}

export async function setLastPostedAt(env, userId, lastPostedAt) {
  await env.DB.prepare('INSERT OR REPLACE INTO last_checked (user_id, handle, last_posted_at) VALUES (?, ?, ?)')
    .bind(userId, '', lastPostedAt)
    .run();
}
