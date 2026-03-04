// Cloudflare Worker entry point

import { fetchBlueskyPosts } from './blueskyClient.js';
import { postToThreads } from './threadsClient.js';
import { postToMisskey } from './misskeyClient.js';
import { isPosted, markPosted } from './kvStore.js';
import { formatPost } from './formatPost.js';

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event));
});

addEventListener('scheduled', (event) => {
  event.waitUntil(sync(globalThis));
});

async function handleRequest(event) {
  const env = event?.env || globalThis;
  const BLUESKY_HANDLE = env?.BLUESKY_HANDLE;
  const THREADS_TOKEN = env?.THREADS_TOKEN;
  const MISSKEY_TOKEN = env?.MISSKEY_TOKEN;
  if (!BLUESKY_HANDLE) {
    return new Response('BLUESKY_HANDLE is not set', { status: 500 });
  }
  if (!THREADS_TOKEN) {
    return new Response('THREADS_TOKEN is not set. Set it via wrangler secret.', { status: 500 });
  }
  if (!MISSKEY_TOKEN) {
    return new Response('MISSKEY_TOKEN is not set. Set it via wrangler secret.', { status: 500 });
  }
  return sync(env);
}

async function sync(env) {
  const BLUESKY_HANDLE = env?.BLUESKY_HANDLE;
  const THREADS_TOKEN = env?.THREADS_TOKEN;
  const MISSKEY_TOKEN = env?.MISSKEY_TOKEN;
  // 24時間前のISO文字列
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
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
