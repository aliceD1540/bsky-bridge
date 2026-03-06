// Bluesky APIクライアント
// 参考: https://github.com/bluesky-social/atproto

const BLUESKY_API_ENDPOINT = 'https://public.api.bsky.app/xrpc';

function normalizePost(item) {
  const post = item.post;
  const record = post.record || {};
  const embed = post.embed || {};
  const reason = item.reason;

  // リポスト
  if (reason?.$type === 'app.bsky.feed.defs#reasonRepost') {
    const repostHandle = post.author?.handle;
    const repostRkey = post.uri?.split('/').pop();
    return {
      uri: post.uri,
      createdAt: record.createdAt,
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

  return {
    uri: post.uri,
    createdAt: record.createdAt,
    text: record.text || '',
    reply: record.reply || null,
    type,
    images,
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
    .map(normalizePost)
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
