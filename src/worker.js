// Cloudflare Worker entry point

import { fetchBlueskyPosts, fetchBlueskyPostByUri } from './blueskyClient.js';
import { postToThreads, refreshThreadsToken } from './threadsClient.js';
import { postToMisskey } from './misskeyClient.js';
import {
  isPosted,
  markPosted,
  getLastPostedAt,
  setLastPostedAt,
} from './kvStore.js';
import { formatPost } from './formatPost.js';
import { register, login, logout, verifySession, changePassword } from './auth.js';
import { saveSettings, getSettings, getPublicSettings, getAllUserSettings } from './settings.js';
import { HTML_INDEX, HTML_LOGIN, HTML_REGISTER, HTML_SETTINGS } from './html.js';

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },

  async scheduled(event, env) {
    await checkAndEnqueueAll(env);
  },

  async queue(batch, env) {
    await handleQueue(batch, env);
  },
};

// KVに保存されたトークンを優先し、期限が7日以内なら自動リフレッシュする（マルチユーザー対応）
async function getEffectiveThreadsToken(env, user) {
  const { userId, threadsToken, threadsTokenExpiresAt } = user;

  if (!threadsToken) {
    console.error(`User ${userId}: Threads token not set`);
    return null;
  }

  const now = new Date();
  const expiresAt = threadsTokenExpiresAt ? new Date(threadsTokenExpiresAt) : null;

  if (expiresAt) {
    const daysUntilExpiry = (expiresAt - now) / (1000 * 60 * 60 * 24);

    if (daysUntilExpiry <= 0) {
      console.error(`User ${userId}: Threads token has expired`);
      return null;
    }

    if (daysUntilExpiry <= 7) {
      // 7日以内に失効するためリフレッシュ
      try {
        const { accessToken: newToken, expiresIn } = await refreshThreadsToken(threadsToken);
        const newExpiry = new Date(now.getTime() + expiresIn * 1000);
        
        // 設定を更新
        await saveSettings(env, userId, {
          threadsToken: newToken,
          threadsTokenExpiresAt: newExpiry.toISOString(),
        });
        
        console.log(`User ${userId}: Threads token refreshed, expires:`, newExpiry.toISOString());
        return newToken;
      } catch (e) {
        console.error(`User ${userId}: Failed to refresh Threads token:`, e);
        return threadsToken;
      }
    }

    return threadsToken;
  }

  return threadsToken;
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // API エンドポイント
  if (path === '/api/register' && request.method === 'POST') {
    const { email, password } = await request.json();
    const result = await register(env, email, password);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (path === '/api/login' && request.method === 'POST') {
    const { email, password } = await request.json();
    const result = await login(env, email, password);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (path === '/api/logout' && request.method === 'POST') {
    const sessionToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    const result = await logout(env, sessionToken);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (path === '/api/change-password' && request.method === 'POST') {
    const sessionToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    const { currentPassword, newPassword } = await request.json();
    const result = await changePassword(env, sessionToken, currentPassword, newPassword);
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : (result.error === 'Unauthorized' ? 401 : 400),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (path === '/api/settings' && request.method === 'GET') {
    const sessionToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    const session = await verifySession(env, sessionToken);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const settings = await getPublicSettings(env, session.userId);
    return new Response(JSON.stringify(settings || {}), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (path === '/api/settings' && request.method === 'POST') {
    const sessionToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    const session = await verifySession(env, sessionToken);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const settings = await request.json();
    const result = await saveSettings(env, session.userId, settings);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 静的ファイル配信（frontend）
  if (path === '/' || path === '/login' || path === '/register' || path === '/settings') {
    return serveHTML(env, path);
  }

  return new Response('Not Found', { status: 404 });
}

function serveHTML(env, path) {
  const pages = {
    '/': HTML_INDEX,
    '/login': HTML_LOGIN,
    '/register': HTML_REGISTER,
    '/settings': HTML_SETTINGS,
  };
  
  const html = pages[path] || pages['/'];
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// cronハンドラ: 全ユーザーの新規ポストを検出してキューに追加する
async function checkAndEnqueueAll(env) {
  const userSettings = await getAllUserSettings(env);

  if (userSettings.length === 0) {
    console.log('No users with Bluesky settings');
    return new Response('No users to check', { status: 200 });
  }

  let totalEnqueued = 0;

  for (const user of userSettings) {
    try {
      const count = await checkAndEnqueueForUser(env, user);
      totalEnqueued += count;
    } catch (e) {
      console.error(`Error checking posts for user ${user.userId}:`, e);
    }
  }

  console.log(`Total enqueued posts: ${totalEnqueued}`);
  return new Response(`Enqueued ${totalEnqueued} posts`, { status: 200 });
}

async function checkAndEnqueueForUser(env, user) {
  const { userId, userCreatedAt, blueskyHandle } = user;

  if (!blueskyHandle) {
    return 0;
  }

  // D1から前回チェック時刻を取得（未設定の場合はユーザー登録日時にフォールバック）
  const lastPostedAt = await getLastPostedAt(env, userId);
  const since = lastPostedAt || userCreatedAt;

  let posts;
  try {
    posts = await fetchBlueskyPosts({ handle: blueskyHandle, since });
  } catch (e) {
    console.error(`Bluesky fetch error for user ${userId}:`, e);
    return 0;
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
    return 0;
  }

  // 古い順にキューへ追加（fetchBlueskyPostsは昇順ソート済み）
  for (const post of newPosts) {
    await env.QUEUE.send({ 
      postUri: post.uri, 
      userId,
      handle: blueskyHandle 
    });
  }

  // 最新ポストの作成時刻をD1に保存（次回cronのsince基準点）
  const newestPost = newPosts[newPosts.length - 1];
  await setLastPostedAt(env, userId, newestPost.createdAt);

  console.log(`User ${userId}: Enqueued ${newPosts.length} posts, last_posted_at: ${newestPost.createdAt}`);
  return newPosts.length;
}

// queueハンドラ: キューからポストを取り出してThreads/Misskeyに投稿する
async function handleQueue(batch, env) {
  for (const message of batch.messages) {
    const { postUri, userId, handle } = message.body;

    // 冪等性チェック（キューのat-least-once配信に対応）
    if (await isPosted(env, postUri)) {
      console.log('Already posted, skipping:', postUri);
      message.ack();
      continue;
    }

    // ユーザー設定を取得
    const userSettings = await getSettings(env, userId);
    if (!userSettings) {
      console.error(`User ${userId}: Settings not found`);
      message.ack();
      continue;
    }

    const MISSKEY_TOKEN = userSettings.misskeyToken;
    const THREADS_TOKEN = await getEffectiveThreadsToken(env, {
      userId,
      threadsToken: userSettings.threadsToken,
      threadsTokenExpiresAt: userSettings.threadsTokenExpiresAt,
    });

    if (!THREADS_TOKEN) {
      console.error(`User ${userId}: THREADS_TOKEN is not set`);
      message.retry();
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
      const promises = [
        postToThreads({ text: formatted.text, images: formatted.images, accessToken: THREADS_TOKEN }),
      ];

      // Misskeyトークンがある場合のみ投稿
      if (MISSKEY_TOKEN) {
        promises.push(postToMisskey({ text: formatted.text, images: formatted.images, token: MISSKEY_TOKEN }));
      }

      const [threadsRes] = await Promise.all(promises);

      if (threadsRes.success) {
        await markPosted(env, postUri, post.createdAt);
        console.log(`User ${userId}: Posted to Threads${MISSKEY_TOKEN ? ' and Misskey' : ''}:`, postUri);
        message.ack();
      } else {
        console.error(`User ${userId}: Threads post failed:`, threadsRes);
        message.retry();
      }
    } catch (e) {
      console.error(`User ${userId}: Post error:`, e);
      message.retry();
    }
  }
}
