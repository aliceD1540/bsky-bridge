// Cloudflare Worker entry point

import { fetchBlueskyPosts } from './blueskyClient.js';
import { postToThreads, refreshThreadsToken } from './threadsClient.js';
import { postToMisskey } from './misskeyClient.js';
import { isPosted, markPosted, getStoredThreadsToken, storeThreadsToken } from './kvStore.js';
import { formatPost } from './formatPost.js';

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event));
});

addEventListener('scheduled', (event) => {
  event.waitUntil(sync(globalThis));
});

// KVに保存されたトークンを優先し、期限が7日以内なら自動リフレッシュする
async function getEffectiveThreadsToken(env) {
  const secretToken = env?.THREADS_TOKEN;
  const { token: kvToken, expiresAt } = await getStoredThreadsToken(env);

  const now = new Date();
  const activeToken = kvToken || secretToken;

  if (kvToken && expiresAt) {
    const daysUntilExpiry = (expiresAt - now) / (1000 * 60 * 60 * 24);

    if (daysUntilExpiry <= 0) {
      // 期限切れ：secretTokenにフォールバックしつつ警告
      console.error('Stored Threads token has expired. Please set a new THREADS_TOKEN secret.');
      return secretToken;
    }

    if (daysUntilExpiry <= 7) {
      // 7日以内に失効するためリフレッシュ
      try {
        const { accessToken: newToken, expiresIn } = await refreshThreadsToken(kvToken);
        const newExpiry = new Date(now.getTime() + expiresIn * 1000);
        await storeThreadsToken(env, newToken, newExpiry);
        console.log('Threads token refreshed, expires:', newExpiry.toISOString());
        return newToken;
      } catch (e) {
        console.error('Failed to refresh Threads token:', e);
        return kvToken;
      }
    }

    return kvToken;
  }

  // KVにトークンがない場合はsecretを初期登録（60日の有効期限を仮定）
  if (secretToken) {
    const initialExpiry = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    await storeThreadsToken(env, secretToken, initialExpiry).catch(() => {});
  }
  return activeToken;
}

async function handleRequest(event) {
  const env = event?.env || globalThis;
  const BLUESKY_HANDLE = env?.BLUESKY_HANDLE;
  const MISSKEY_TOKEN = env?.MISSKEY_TOKEN;
  if (!BLUESKY_HANDLE) {
    return new Response('BLUESKY_HANDLE is not set', { status: 500 });
  }
  if (!env?.THREADS_TOKEN) {
    return new Response('THREADS_TOKEN is not set. Set it via wrangler secret.', { status: 500 });
  }
  if (!MISSKEY_TOKEN) {
    return new Response('MISSKEY_TOKEN is not set. Set it via wrangler secret.', { status: 500 });
  }
  return sync(env);
}

async function sync(env) {
  const BLUESKY_HANDLE = env?.BLUESKY_HANDLE;
  const MISSKEY_TOKEN = env?.MISSKEY_TOKEN;
  // 24時間前のISO文字列
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const THREADS_TOKEN = await getEffectiveThreadsToken(env);
  if (!THREADS_TOKEN) {
    return new Response('THREADS_TOKEN is not set. Set it via wrangler secret.', { status: 500 });
  }

  let posts;
  try {
    posts = await fetchBlueskyPosts({ handle: BLUESKY_HANDLE, since });
  } catch (e) {
    console.error('Bluesky fetch error:', e);
    return new Response('Bluesky fetch error', { status: 500 });
  }
  for (const post of posts) {
    const postId = post.uri;
    if (!postId) continue;
    if (await isPosted(env, postId)) continue;
    const blueskyUrl = `https://bsky.app/profile/${BLUESKY_HANDLE}/post/${postId.split('/').pop()}`;
    const formatted = formatPost({ post, blueskyUrl });
    if (!formatted) continue;
    // ThreadsとMisskeyに並行投稿
    try {
      const [threadsRes] = await Promise.all([
        postToThreads({ text: formatted.text, images: formatted.images, accessToken: THREADS_TOKEN }),
        postToMisskey({ text: formatted.text, images: formatted.images, token: MISSKEY_TOKEN }),
      ]);
      if (threadsRes.success) {
        await markPosted(env, postId, post.createdAt);
        console.log('Posted to Threads and Misskey:', postId);
        return new Response('Posted 1 item to Threads and Misskey', { status: 200 });
      } else {
        console.error('Threads post failed:', threadsRes);
        return new Response('Threads post failed', { status: 500 });
      }
    } catch (e) {
      console.error('Post error:', e);
      return new Response('Post error', { status: 500 });
    }
  }
  console.log('No new posts to publish');
  return new Response('No new posts to publish', { status: 200 });
}
