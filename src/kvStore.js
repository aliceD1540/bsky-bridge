// KV/D1スキーマ設計・初期化
// KV: 投稿済みポストIDの保存
// D1: 必要に応じて詳細情報保存（今回はKVのみで十分）

export async function isPosted(env, postId) {
  return (await env.KV.get(`posted:${postId}`)) !== null;
}

// posted: エントリは7日後に自動削除（KV無制限肥大化を防ぐ）
const POSTED_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function markPosted(env, postId, createdAt) {
  await env.KV.put(`posted:${postId}`, createdAt, { expirationTtl: POSTED_TTL_SECONDS });
}

// 宛先プラットフォームごとの投稿済みフラグ（部分失敗時のリトライで重複投稿を防ぐ）
export async function isPostedToPlatform(env, destPlatform, postId) {
  return (await env.KV.get(`posted:dest:${destPlatform}:${postId}`)) !== null;
}

export async function markPostedToPlatform(env, destPlatform, postId, createdAt) {
  await env.KV.put(`posted:dest:${destPlatform}:${postId}`, createdAt, { expirationTtl: POSTED_TTL_SECONDS });
}

// D1: ユーザー・プラットフォームごとの前回チェック時刻管理
export async function getLastPostedAt(env, userId, platform = 'bluesky') {
  const row = await env.DB.prepare(
    'SELECT last_posted_at FROM last_checked WHERE user_id = ? AND source_platform = ?'
  )
    .bind(userId, platform)
    .first();
  return row?.last_posted_at || null;
}

export async function setLastPostedAt(env, userId, lastPostedAt, platform = 'bluesky') {
  await env.DB.prepare(
    'INSERT OR REPLACE INTO last_checked (user_id, source_platform, last_posted_at) VALUES (?, ?, ?)'
  )
    .bind(userId, platform, lastPostedAt)
    .run();
}

// ソースプラットフォームのユーザー識別子キャッシュ（API コール削減のため24時間保持）
const SOURCE_IDENTITY_CACHE_TTL = 24 * 60 * 60;

export async function getCachedSourceIdentity(env, platform, userId) {
  const raw = await env.KV.get(`source_cache:${platform}:${userId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function setCachedSourceIdentity(env, platform, userId, identity) {
  await env.KV.put(`source_cache:${platform}:${userId}`, JSON.stringify(identity), {
    expirationTtl: SOURCE_IDENTITY_CACHE_TTL,
  });
}

