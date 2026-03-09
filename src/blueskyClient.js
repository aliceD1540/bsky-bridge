// Bluesky APIクライアント
// 参考: https://github.com/bluesky-social/atproto

const BLUESKY_API_ENDPOINT = 'https://public.api.bsky.app/xrpc';
const BLUESKY_AUTH_ENDPOINT = 'https://bsky.social/xrpc';

// アプリパスワードでログインし、ハンドルの所有確認を行う
// 認証失敗時は例外をスロー
export async function verifyBlueskyCredentials(handle, password) {
  const res = await fetch(`${BLUESKY_AUTH_ENDPOINT}/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password }),
  });
  if (!res.ok) {
    throw new Error(`Bluesky authentication failed: ${res.status}`);
  }
  const data = await res.json();
  // レスポンスのhandleと入力のhandleを照合してなりすましを防ぐ
  if (data.handle !== handle) {
    throw new Error(`Handle mismatch: expected ${handle}, got ${data.handle}`);
  }
}

function normalizePost(item, selfHandle) {
  const post = item.post;
  const record = post.record || {};
  const embed = post.embed || {};
  const reason = item.reason;

  // リポスト（reasonによる判定 + authorが自分でない場合も補完）
  const isRepost = reason?.$type === 'app.bsky.feed.defs#reasonRepost'
    || (selfHandle && post.author?.handle !== selfHandle);
  if (isRepost) {
    const repostHandle = post.author?.handle;
    const repostRkey = post.uri?.split('/').pop();
    return {
      uri: post.uri,
      // リポストした日時（reason.indexedAt）を優先。元投稿のcreatedAtは古い場合がある
      createdAt: reason?.indexedAt || record.createdAt,
      text: record.text || '',
      reply: record.reply || null,
      type: 'repost',
      repostUrl: `https://bsky.app/profile/${repostHandle}/post/${repostRkey}`,
      images: [],
    };
  }

  // 画像
  let images = [];
  if (embed.$type === 'app.bsky.embed.images#view') {
    images = (embed.images || []).map((img) => img.fullsize || img.thumb).filter(Boolean);
  } else if (embed.$type === 'app.bsky.embed.recordWithMedia#view') {
    const media = embed.media || {};
    if (media.$type === 'app.bsky.embed.images#view') {
      images = (media.images || []).map((img) => img.fullsize || img.thumb).filter(Boolean);
    }
  }

  // 外部リンクカード
  let cardUrl;
  if (embed.$type === 'app.bsky.embed.external#view') {
    cardUrl = embed.external?.uri;
  }

  // 引用
  let type = 'post';
  let quotedUrl;
  if (embed.$type === 'app.bsky.embed.record#view' || embed.$type === 'app.bsky.embed.recordWithMedia#view') {
    const quotedRecord = embed.record?.record || embed.record;
    if (quotedRecord?.uri) {
      type = 'quote';
      const handle = quotedRecord.author?.handle;
      const rkey = quotedRecord.uri?.split('/').pop();
      quotedUrl = `https://bsky.app/profile/${handle}/post/${rkey}`;
    }
  }

  // センシティブラベル
  const SENSITIVE_LABELS = new Set(['porn', 'sexual', 'nudity', 'graphic-media', 'gore']);
  const labels = (post.labels || []).map((l) => l.val).filter((v) => SENSITIVE_LABELS.has(v));

  return {
    uri: post.uri,
    createdAt: record.createdAt,
    text: record.text || '',
    reply: record.reply || null,
    type,
    images,
    labels,
    cardUrl,
    quotedUrl,
  };
}

export async function fetchBlueskyPosts({ handle, since }) {
  // handle: Blueskyのユーザー名
  // since: ISO8601文字列（24時間前）
  const url = `${BLUESKY_API_ENDPOINT}/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(handle)}&limit=50`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Bluesky API fetch failed: ${res.status} ${res.statusText} - ${body}`);
  }
  const data = await res.json();
  return (data.feed || [])
    .map((item) => normalizePost(item, handle))
    .filter((post) => post.createdAt && new Date(post.createdAt) > new Date(since))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export async function fetchBlueskyPostByUri(uri) {
  const url = `${BLUESKY_API_ENDPOINT}/app.bsky.feed.getPosts?uris[]=${encodeURIComponent(uri)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Bluesky fetch post failed: ${res.status} ${res.statusText} - ${body}`);
  }
  const data = await res.json();
  const posts = data.posts || [];
  if (posts.length === 0) return null;
  return normalizePost({ post: posts[0] });
}
