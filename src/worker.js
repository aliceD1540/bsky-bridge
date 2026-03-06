// Cloudflare Worker entry point

import { fetchBlueskyPosts, fetchBlueskyPostByUri } from './blueskyClient.js';
import { postToThreads, refreshThreadsToken } from './threadsClient.js';
import { postToMisskey } from './misskeyClient.js';
import {
  isPosted,
  markPosted,
  getStoredThreadsToken,
  storeThreadsToken,
  getLastPostedAt,
  setLastPostedAt,
} from './kvStore.js';
import { formatPost } from './formatPost.js';

export default {
  async fetch(request, env) {
    return handleRequest(env);
  },

  async scheduled(event, env) {
    await checkAndEnqueue(env);
  },

  async queue(batch, env) {
    await handleQueue(batch, env);
  },
};

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

async function handleRequest(env) {
  if (!env?.BLUESKY_HANDLE) {
    return new Response('BLUESKY_HANDLE is not set', { status: 500 });
  }
  if (!env?.THREADS_TOKEN) {
    return new Response('THREADS_TOKEN is not set. Set it via wrangler secret.', { status: 500 });
  }
  if (!env?.MISSKEY_TOKEN) {
    return new Response('MISSKEY_TOKEN is not set. Set it via wrangler secret.', { status: 500 });
  }
  return checkAndEnqueue(env);
}

// cronハンドラ: 新規ポストを検出してキューに追加する
async function checkAndEnqueue(env) {
  const BLUESKY_HANDLE = env?.BLUESKY_HANDLE;

  // D1から前回チェック時刻を取得（未設定の場合は24時間前にフォールバック）
  const lastPostedAt = await getLastPostedAt(env, BLUESKY_HANDLE);
  const since = lastPostedAt || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let posts;
  try {
    posts = await fetchBlueskyPosts({ handle: BLUESKY_HANDLE, since });
  } catch (e) {
    console.error('Bluesky fetch error:', e);
    return new Response('Bluesky fetch error', { status: 500 });
  }

  // 投稿済みのポストを除外
  const newPosts = [];
  for (const post of posts) {
    if (!post.uri) continue;
    if (!(await isPosted(env, post.uri))) {
      newPosts.push(post);
    }
  }

  if (newPosts.length === 0) {
    console.log('No new posts to enqueue');
    return new Response('No new posts to enqueue', { status: 200 });
  }

  // 古い順にキューへ追加（fetchBlueskyPostsは昇順ソート済み）
  for (const post of newPosts) {
    await env.QUEUE.send({ postUri: post.uri, handle: BLUESKY_HANDLE });
  }

  // 最新ポストの作成時刻をD1に保存（次回cronのsince基準点）
  const newestPost = newPosts[newPosts.length - 1];
  await setLastPostedAt(env, BLUESKY_HANDLE, newestPost.createdAt);

  console.log(`Enqueued ${newPosts.length} posts, last_posted_at: ${newestPost.createdAt}`);
  return new Response(`Enqueued ${newPosts.length} posts`, { status: 200 });
}

// queueハンドラ: キューからポストを取り出してThreads/Misskeyに投稿する
async function handleQueue(batch, env) {
  const MISSKEY_TOKEN = env?.MISSKEY_TOKEN;
  const THREADS_TOKEN = await getEffectiveThreadsToken(env);

  if (!THREADS_TOKEN) {
    console.error('THREADS_TOKEN is not set');
    // メッセージを全てretryして次回に再試行
    for (const message of batch.messages) message.retry();
    return;
  }

  for (const message of batch.messages) {
    const { postUri, handle } = message.body;

    // 冪等性チェック（キューのat-least-once配信に対応）
    if (await isPosted(env, postUri)) {
      console.log('Already posted, skipping:', postUri);
      message.ack();
      continue;
    }

    // Blueskyからポスト内容を取得
    let post;
    try {
      post = await fetchBlueskyPostByUri(postUri);
    } catch (e) {
      console.error('Bluesky fetch error for post:', postUri, e);
      message.retry();
      continue;
    }

    if (!post) {
      console.warn('Post not found on Bluesky, skipping:', postUri);
      message.ack();
      continue;
    }

    const rkey = postUri.split('/').pop();
    const blueskyUrl = `https://bsky.app/profile/${handle}/post/${rkey}`;
    const formatted = formatPost({ post, blueskyUrl });

    if (!formatted) {
      // リプライや無効なポストはスキップ
      console.log('Post skipped (reply or unsupported type):', postUri);
      message.ack();
      continue;
    }

    try {
      const [threadsRes] = await Promise.all([
        postToThreads({ text: formatted.text, images: formatted.images, accessToken: THREADS_TOKEN }),
        postToMisskey({ text: formatted.text, images: formatted.images, token: MISSKEY_TOKEN }),
      ]);

      if (threadsRes.success) {
        await markPosted(env, postUri, post.createdAt);
        console.log('Posted to Threads and Misskey:', postUri);
        message.ack();
      } else {
        console.error('Threads post failed:', threadsRes);
        message.retry();
      }
    } catch (e) {
      console.error('Post error:', e);
      message.retry();
    }
  }
}
