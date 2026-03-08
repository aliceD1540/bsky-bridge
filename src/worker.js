// Cloudflare Worker entry point

import { fetchBlueskyPosts, fetchBlueskyPostByUri } from './blueskyClient.js';
import { postToThreads, refreshThreadsToken, buildThreadsAuthUrl, exchangeCodeForToken, exchangeForLongLivedToken } from './threadsClient.js';
import { postToMisskey } from './misskeyClient.js';
import {
  isPosted,
  markPosted,
  getLastPostedAt,
  setLastPostedAt,
} from './kvStore.js';
import { formatPost } from './formatPost.js';
import { register, login, logout, verifySession, changePassword, deleteAccount } from './auth.js';
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

function generateOAuthState() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

// IPごとの試行回数をKVで管理（5回失敗で15分ロックアウト）
async function checkRateLimit(env, key) {
  const kvKey = `rate_limit:${key}`;
  const raw = await env.KV.get(kvKey);
  const attempts = raw ? parseInt(raw, 10) : 0;
  if (attempts >= 5) return false;
  await env.KV.put(kvKey, String(attempts + 1), { expirationTtl: 15 * 60 });
  return true;
}

async function resetRateLimit(env, key) {
  await env.KV.delete(`rate_limit:${key}`);
}

function buildSessionCookie(token) {
  return `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`;
}

function getSessionToken(request) {
  // httpOnly Cookie を優先し、後方互換としてBearerトークンにも対応
  const cookie = request.headers.get('Cookie');
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);
    if (match) return match[1];
  }
  return request.headers.get('Authorization')?.replace('Bearer ', '') || null;
}

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

  // CSRF対策：POSTリクエストのOriginを検証（ブラウザからの正規リクエストのみ許可）
  if (request.method === 'POST' && path.startsWith('/api/')) {
    const origin = request.headers.get('Origin');
    if (origin && env.APP_URL && origin !== env.APP_URL) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // API エンドポイント
  if (path === '/api/register' && request.method === 'POST') {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!await checkRateLimit(env, `register:${ip}`)) {
      return new Response(JSON.stringify({ error: 'Too many attempts. Please try again later.' }), {
        status: 429, headers: { 'Content-Type': 'application/json' },
      });
    }
    const { email, password } = await request.json();
    const result = await register(env, email, password);
    const headers = { 'Content-Type': 'application/json' };
    if (result.success) {
      headers['Set-Cookie'] = buildSessionCookie(result.sessionToken);
    }
    return new Response(JSON.stringify(result), { headers });
  }

  if (path === '/api/login' && request.method === 'POST') {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!await checkRateLimit(env, `login:${ip}`)) {
      return new Response(JSON.stringify({ error: 'Too many attempts. Please try again later.' }), {
        status: 429, headers: { 'Content-Type': 'application/json' },
      });
    }
    try {
      const { email, password } = await request.json();
      const result = await login(env, email, password);
      if (result.success) await resetRateLimit(env, `login:${ip}`);
      const headers = { 'Content-Type': 'application/json' };
      if (result.success) {
        headers['Set-Cookie'] = buildSessionCookie(result.sessionToken);
      }
      return new Response(JSON.stringify(result), { headers });
    } catch (err) {
      console.error('Login error:', err);
      // サーバー側エラーはユーザーの責任ではないためカウントをリセット
      await resetRateLimit(env, `login:${ip}`);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (path === '/api/logout' && request.method === 'POST') {
    const sessionToken = getSessionToken(request);
    const result = await logout(env, sessionToken);
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
      },
    });
  }

  if (path === '/api/change-password' && request.method === 'POST') {
    const sessionToken = getSessionToken(request);
    const { currentPassword, newPassword } = await request.json();
    const result = await changePassword(env, sessionToken, currentPassword, newPassword);
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : (result.error === 'Unauthorized' ? 401 : 400),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (path === '/api/delete-account' && request.method === 'POST') {
    const sessionToken = getSessionToken(request);
    const { password } = await request.json();
    const result = await deleteAccount(env, sessionToken, password);
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : (result.error === 'Unauthorized' ? 401 : 400),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (path === '/api/settings' && request.method === 'GET') {
    const sessionToken = getSessionToken(request);
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
    const sessionToken = getSessionToken(request);
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

  // Threads OAuth: 認可開始（POSTでセッション検証→一時URLを返す）
  if (path === '/auth/threads/start' && request.method === 'POST') {
    if (!env.THREADS_APP_ID || !env.THREADS_APP_SECRET || !env.APP_URL) {
      return new Response(JSON.stringify({ error: 'Threads OAuth is not configured.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const sessionToken = getSessionToken(request);
    const session = await verifySession(env, sessionToken);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // state に userId を紐付けてKVに10分間保存
    const state = generateOAuthState();
    await env.KV.put(`oauth_state:${state}`, String(session.userId), { expirationTtl: 600 });

    const redirectUri = `${env.APP_URL}/auth/threads/callback`;
    const authUrl = buildThreadsAuthUrl({
      clientId: env.THREADS_APP_ID,
      redirectUri,
      state,
    });

    return new Response(JSON.stringify({ authUrl }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Threads OAuth: コールバック
  if (path === '/auth/threads/callback' && request.method === 'GET') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    const settingsUrl = new URL('/settings', request.url);

    if (error || !code || !state) {
      settingsUrl.searchParams.set('threads_error', error || 'invalid_callback');
      return Response.redirect(settingsUrl.toString(), 302);
    }

    // stateを検証してuserIdを取得
    const userId = await env.KV.get(`oauth_state:${state}`);
    if (!userId) {
      settingsUrl.searchParams.set('threads_error', 'invalid_state');
      return Response.redirect(settingsUrl.toString(), 302);
    }

    // 使用済みstateを即座に削除（リプレイ攻撃防止）
    await env.KV.delete(`oauth_state:${state}`);

    try {
      const redirectUri = `${env.APP_URL}/auth/threads/callback`;

      // 短期トークンに交換
      const { accessToken: shortLivedToken } = await exchangeCodeForToken({ code, redirectUri, env });

      // 長期トークン（60日）に交換
      const { accessToken: longLivedToken, expiresIn } = await exchangeForLongLivedToken({
        shortLivedToken,
        env,
      });

      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      await saveSettings(env, Number(userId), {
        threadsToken: longLivedToken,
        threadsTokenExpiresAt: expiresAt,
      });

      settingsUrl.searchParams.set('threads_connected', '1');
    } catch (e) {
      console.error('Threads OAuth callback error:', e);
      settingsUrl.searchParams.set('threads_error', 'token_exchange_failed');
    }

    return Response.redirect(settingsUrl.toString(), 302);
  }

  // Threads 連携解除
  if (path === '/api/threads/disconnect' && request.method === 'POST') {
    const sessionToken = getSessionToken(request);
    const session = await verifySession(env, sessionToken);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    await saveSettings(env, session.userId, {
      threadsToken: null,
      threadsTokenExpiresAt: null,
    });
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }


  // 静的ファイル配信（frontend）
  if (path === '/') {
    return Response.redirect(new URL('/login', request.url).toString(), 302);
  }
  if (path === '/login' || path === '/register' || path === '/settings') {
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
      handle: blueskyHandle,
      postType: post.type,
      repostUrl: post.repostUrl || null,
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
    const { postUri, userId, handle, postType, repostUrl } = message.body;

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

    if (!THREADS_TOKEN && !MISSKEY_TOKEN) {
      console.error(`User ${userId}: No SNS tokens configured`);
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

    // fetchBlueskyPostByUri は reason を持たないため、キューに保存したtype/repostUrlで補完
    if (postType) post.type = postType;
    if (repostUrl) post.repostUrl = repostUrl;

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
      const promises = [];

      if (THREADS_TOKEN) {
        promises.push(postToThreads({ text: formatted.text, images: formatted.images, accessToken: THREADS_TOKEN }));
      }
      if (MISSKEY_TOKEN) {
        promises.push(postToMisskey({ text: formatted.text, images: formatted.images, token: MISSKEY_TOKEN }));
      }

      const results = await Promise.all(promises);
      const threadsRes = THREADS_TOKEN ? results[0] : null;
      const misskeyRes = MISSKEY_TOKEN ? results[THREADS_TOKEN ? 1 : 0] : null;

      const threadsOk = !THREADS_TOKEN || threadsRes?.success;
      const misskeyOk = !MISSKEY_TOKEN || misskeyRes !== undefined;

      if (threadsOk && misskeyOk) {
        await markPosted(env, postUri, post.createdAt);
        const targets = [THREADS_TOKEN && 'Threads', MISSKEY_TOKEN && 'Misskey'].filter(Boolean).join(' and ');
        console.log(`User ${userId}: Posted to ${targets}:`, postUri);
        message.ack();
      } else {
        console.error(`User ${userId}: Post failed - Threads: ${threadsRes?.success}, Misskey: ${misskeyOk}`);
        message.retry();
      }
    } catch (e) {
      console.error(`User ${userId}: Post error:`, e);
      message.retry();
    }
  }
}
