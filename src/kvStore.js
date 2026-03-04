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
