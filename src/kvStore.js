// KV/D1スキーマ設計・初期化
// KV: 投稿済みポストIDの保存
// D1: 必要に応じて詳細情報保存（今回はKVのみで十分）

// KVのキー例: 'posted:{bluesky_post_id}'

export async function isPosted(env, postId) {
  // env: Cloudflare Workerのenv
  // postId: BlueskyポストID
  return (await env.KV.get(`posted:${postId}`)) !== null;
}

export async function markPosted(env, postId, createdAt) {
  // 投稿済みとしてKVに保存
  await env.KV.put(`posted:${postId}`, createdAt);
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
