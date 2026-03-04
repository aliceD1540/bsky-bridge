// Cloudflare Worker entry point

import { fetchBlueskyPosts } from './blueskyClient.js';
import { postToThreads } from './threadsClient.js';
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
  if (!BLUESKY_HANDLE) {
    return new Response('BLUESKY_HANDLE is not set', { status: 500 });
  }
  if (!THREADS_TOKEN) {
    return new Response('THREADS_TOKEN is not set. Set it via wrangler secret.', { status: 500 });
  }
  return sync(env);
}

async function sync(env) {
  const BLUESKY_HANDLE = env?.BLUESKY_HANDLE;
  const THREADS_TOKEN = env?.THREADS_TOKEN;
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
    // Threads投稿
    try {
      const res = await postToThreads({
        text: formatted.text,
        images: formatted.images,
        accessToken: THREADS_TOKEN,
      });
      if (res.success) {
        await markPosted(env, postId, post.createdAt);
        console.log('Posted to Threads:', postId);
        return new Response('Posted 1 item to Threads', { status: 200 });
      } else {
        console.error('Threads post failed:', res);
        return new Response('Threads post failed', { status: 500 });
      }
    } catch (e) {
      console.error('Threads post error:', e);
      return new Response('Threads post error', { status: 500 });
    }
  }
  console.log('No new posts to publish');
  return new Response('No new posts to publish', { status: 200 });
}
