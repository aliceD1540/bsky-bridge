// Cloudflare Worker entry point

import { fetchBlueskyPostByUri, verifyBlueskyCredentials } from './blueskyClient.js';
import { refreshThreadsToken, buildThreadsAuthUrl, exchangeCodeForToken, exchangeForLongLivedToken } from './threadsClient.js';
import { fetchMixi2AccessToken } from './mixi2Client.js';
import { isPosted, markPosted, isPostedToPlatform, markPostedToPlatform, getLastPostedAt, setLastPostedAt } from './kvStore.js';
import { formatPost } from './formatPost.js';
import { register, login, logout, verifySession, changePassword, deleteAccount, verifyEmail, requestPasswordReset, resetPassword } from './auth.js';
import { saveSettings, getSettings, getPublicSettings, getAllUserSettings } from './settings.js';
import { SOURCE_ADAPTERS, DEST_ADAPTERS, getDestinationsForUser } from './adapters.js';
import { HTML_INDEX, HTML_LOGIN, HTML_REGISTER, HTML_SETTINGS, HTML_VERIFY_EMAIL, HTML_FORGOT_PASSWORD, HTML_RESET_PASSWORD } from './html.js';
import { serveProxiedImage } from './mediaProxy.js';
import { sendReplyNotification } from './notificationService.js';

const DAILY_POST_LIMIT = 20;

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

function constantTimeEquals(a, b) {
  if (!a || !b) return false;
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  const len = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < len; i++) diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  return diff === 0;
}

async function authenticateWebhook(env, userId, token) {
  if (!userId || !token) return null;
  const settings = await getSettings(env, userId);
  if (!settings) return null;
  if (!constantTimeEquals(settings.webhookToken || '', token)) return null;
  return settings;
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
      console.error(`User ${userId}: Threads token has expired, clearing token`);
      // トークンのみ削除。threadsTokenExpiresAtは残し、設定画面で期限切れを検出できるようにする
      await saveSettings(env, userId, { threadsToken: null });
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

// mixi2アクセストークンの有効性を確認し、期限切れの場合は再取得する
async function getEffectiveMixi2Token(env, user) {
  const { userId, mixi2AccessToken, mixi2TokenExpiresAt, mixi2ClientId, mixi2ClientSecret } = user;

  if (!mixi2AccessToken) return null;
  if (!mixi2ClientId || !mixi2ClientSecret) return mixi2AccessToken;

  const now = new Date();
  const expiresAt = mixi2TokenExpiresAt ? new Date(mixi2TokenExpiresAt) : null;

  if (expiresAt && expiresAt <= now) {
    // 期限切れ → clientId/clientSecret で再取得
    try {
      const { accessToken: newToken, expiresIn } = await fetchMixi2AccessToken(mixi2ClientId, mixi2ClientSecret);
      const newExpiry = new Date(now.getTime() + expiresIn * 1000);
      await saveSettings(env, userId, {
        mixi2AccessToken: newToken,
        mixi2TokenExpiresAt: newExpiry.toISOString(),
      });
      console.log(`User ${userId}: mixi2 token refreshed, expires:`, newExpiry.toISOString());
      return newToken;
    } catch (e) {
      console.error(`User ${userId}: Failed to refresh mixi2 token:`, e);
      return null;
    }
  }

  return mixi2AccessToken;
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

  if (path === '/api/verify-email' && request.method === 'POST') {
    const { token } = await request.json();
    const result = await verifyEmail(env, token);
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (path === '/api/forgot-password' && request.method === 'POST') {
    const { email } = await request.json();
    const result = await requestPasswordReset(env, email);
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (path === '/api/reset-password' && request.method === 'POST') {
    const { token, password } = await request.json();
    const result = await resetPassword(env, token, password);
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Webhook: Misskey.io リプライ通知
  // Misskey.io のWebhook設定で:
  //   URL      = /api/webhook/misskey/{userId}?token={webhookToken}
  //   シークレット = 任意（設定する場合は webhookToken と同じ値を使用）
  const misskeyWebhookMatch = path.match(/^\/api\/webhook\/misskey\/([^/]+)$/);
  if (misskeyWebhookMatch && request.method === 'POST') {
    const userId = misskeyWebhookMatch[1];
    const urlToken = url.searchParams.get('token') || '';

    const settings = await authenticateWebhook(env, userId, urlToken);
    if (!settings) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // X-Misskey-Hook-Secret が送られてきた場合は追加検証
    const secretHeader = request.headers.get('X-Misskey-Hook-Secret');
    if (secretHeader && !constantTimeEquals(settings.webhookToken || '', secretHeader)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!settings.notifyReplyMisskey) {
      return new Response(JSON.stringify({ success: false, message: 'Notification for Misskey.io is disabled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = await request.json();
      // Misskey.io は reply イベントのみ処理
      if (body.type !== 'reply') {
        return new Response(JSON.stringify({ success: false, message: 'Not a reply event' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const note = body.body?.note;
      const postUrl = note?.url || note?.uri || '';

      const result = await sendReplyNotification(settings.sourcePlatform, settings, 'misskey', postUrl);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Misskey webhook error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Webhook: Threads リプライ通知
  // Meta Developer Console のWebhook設定で:
  //   コールバックURL = /api/webhook/threads/{userId}?token={webhookToken}
  //   確認トークン   = {webhookToken}
  const threadsWebhookMatch = path.match(/^\/api\/webhook\/threads\/([^/]+)$/);
  if (threadsWebhookMatch && request.method === 'GET') {
    // Threadsのwebhook検証リクエスト
    const userId = threadsWebhookMatch[1];
    const mode = url.searchParams.get('hub.mode');
    const challenge = url.searchParams.get('hub.challenge');
    const verifyToken = url.searchParams.get('hub.verify_token') || '';

    if (mode !== 'subscribe' || !challenge) {
      return new Response('Bad Request', { status: 400 });
    }

    const settings = await getSettings(env, userId);
    if (!settings || !constantTimeEquals(settings.webhookToken || '', verifyToken)) {
      return new Response('Forbidden', { status: 403 });
    }

    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  if (threadsWebhookMatch && request.method === 'POST') {
    const userId = threadsWebhookMatch[1];
    const token = url.searchParams.get('token') || '';
    const settings = await authenticateWebhook(env, userId, token);
    if (!settings) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!settings.notifyReplyThreads) {
      return new Response(JSON.stringify({ success: false, message: 'Notification for Threads is disabled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = await request.json();
      // Threads webhook body: { object: 'threads', entry: [{ changes: [{ field: 'replies', value: { permalink_url: '...' } }] }] }
      let postUrl = '';
      for (const entry of (body.entry || [])) {
        for (const change of (entry.changes || [])) {
          if (change.field === 'replies' && change.value?.permalink_url) {
            postUrl = change.value.permalink_url;
            break;
          }
        }
        if (postUrl) break;
      }

      const result = await sendReplyNotification(settings.sourcePlatform, settings, 'threads', postUrl);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Threads webhook error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Webhook: mixi2 リプライ通知
  // mixi2 のWebhook設定で: URL = /api/webhook/mixi2/{userId}?token={webhookToken}
  const mixi2WebhookMatch = path.match(/^\/api\/webhook\/mixi2\/([^/]+)$/);
  if (mixi2WebhookMatch && request.method === 'POST') {
    const userId = mixi2WebhookMatch[1];
    const token = url.searchParams.get('token') || '';
    const settings = await authenticateWebhook(env, userId, token);
    if (!settings) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!settings.notifyReplyMixi2) {
      return new Response(JSON.stringify({ success: false, message: 'Notification for mixi2 is disabled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = await request.json();
      const postUrl = body.url || body.replyUrl || body.postUrl || body.permalink_url || '';

      const result = await sendReplyNotification(settings.sourcePlatform, settings, 'mixi2', postUrl);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('mixi2 webhook error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // お知らせ取得（全ユーザー向け・認証不要）
  if (path === '/api/announcement' && request.method === 'GET') {
    const row = await env.DB.prepare('SELECT content FROM announcements WHERE id = 1').first();
    return new Response(JSON.stringify({ content: row?.content || '' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // お知らせ更新（管理者のみ）
  if (path === '/api/announcement' && request.method === 'POST') {
    const sessionToken = getSessionToken(request);
    const session = await verifySession(env, sessionToken);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const userRow = await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(session.userId).first();
    const isAdmin = env.ADMIN_EMAIL && userRow?.email === env.ADMIN_EMAIL;
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const { content } = await request.json();
    await env.DB.prepare(
      "INSERT OR REPLACE INTO announcements (id, content, updated_at) VALUES (1, ?, datetime('now'))"
    ).bind(content || '').run();
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // メディアプロキシ: Threads CDN が直接取得できない画像を配信する
  if (path.startsWith('/media/') && request.method === 'GET') {
    const key = path.slice(7);
    return serveProxiedImage(key, env);
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
    return new Response(JSON.stringify({ ...(settings || {}), dailyLimit: DAILY_POST_LIMIT }), {
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

    // 転記元変更チェック用に保存前の設定を取得
    const existingBeforeSave = await getPublicSettings(env, session.userId);

    // Bluesky認証検証:
    // - ハンドルが変更される場合はアプリパスワード必須
    // - アプリパスワードが指定された場合は検証してから保存
    if (settings.blueskyHandle) {
      const handleChanged = settings.blueskyHandle !== existingBeforeSave?.blueskyHandle;

      if (handleChanged && !settings.blueskyAppPassword) {
        return new Response(JSON.stringify({ error: 'ハンドルを変更する場合はアプリパスワードの入力が必要です。' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (settings.blueskyAppPassword) {
        try {
          await verifyBlueskyCredentials(settings.blueskyHandle, settings.blueskyAppPassword);
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Bluesky認証に失敗しました。ハンドルとアプリパスワードを確認してください。' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // mixi2設定は管理者のみ変更可能（なりすまし防止）
    const mixi2SettingKeys = ['mixi2ClientId', 'mixi2ClientSecret', 'mixi2AccessToken'];
    if (mixi2SettingKeys.some(k => k in settings)) {
      // ユーザーが存在しない・ADMIN_EMAILが未設定・メールが一致しない場合はすべて403
      const adminUserRow = await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(session.userId).first();
      if (!(env.ADMIN_EMAIL && adminUserRow?.email === env.ADMIN_EMAIL)) {
        return new Response(JSON.stringify({ error: 'mixi2設定は管理者のみが変更できます。' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // mixi2 は転記元として使用不可（なりすましが容易なため）
    if (settings.sourcePlatform === 'mixi2') {
      return new Response(JSON.stringify({ error: 'mixi2は転記元として使用できません。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // mixi2認証情報が入力された場合、アクセストークンを自動取得して保存
    if (settings.mixi2ClientId && settings.mixi2ClientSecret) {
      // コピー時に混入しやすい前後の空白を除去
      settings.mixi2ClientId = settings.mixi2ClientId.trim();
      settings.mixi2ClientSecret = settings.mixi2ClientSecret.trim();
      try {
        const { accessToken, expiresIn } = await fetchMixi2AccessToken(settings.mixi2ClientId, settings.mixi2ClientSecret);
        settings.mixi2AccessToken = accessToken;
        settings.mixi2TokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      } catch (e) {
        console.error(`User ${session.userId}: mixi2 token fetch failed:`, e.message);
        return new Response(JSON.stringify({ error: `mixi2認証に失敗しました: ${e.message}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const result = await saveSettings(env, session.userId, settings);

    // 転記元プラットフォームが変更された場合、新しいプラットフォームの最終投稿日時を現在時刻に設定して遡り転記を防ぐ
    if (settings.sourcePlatform) {
      const prevPlatform = existingBeforeSave?.sourcePlatform || 'bluesky';
      if (prevPlatform !== settings.sourcePlatform) {
        await setLastPostedAt(env, session.userId, new Date().toISOString(), settings.sourcePlatform);
        console.log(`User ${session.userId}: sourcePlatform changed ${prevPlatform} → ${settings.sourcePlatform}, reset last_checked`);
      }
    }

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
  if (path === '/login' || path === '/register' || path === '/settings' || path === '/verify-email' || path === '/forgot-password' || path === '/reset-password') {
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
    '/verify-email': HTML_VERIFY_EMAIL,
    '/forgot-password': HTML_FORGOT_PASSWORD,
    '/reset-password': HTML_RESET_PASSWORD,
  };
  
  let html = pages[path] || pages['/'];
  
  // メンテナンスモード時はバナーを挿入
  const maintenanceMode = env.MAINTENANCE_MODE === 'true';
  if (maintenanceMode) {
    const banner = '<div style="background-color: #ff6b6b; color: white; padding: 12px; text-align: center; font-weight: bold;">🔧 現在メンテナンス中です。一部機能が制限されています。</div>';
    html = html.replace('<body>', '<body>' + banner);
  }
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// cronハンドラ: 全ユーザーの新規ポストを検出してキューに追加する
async function checkAndEnqueueAll(env) {
  const userSettings = await getAllUserSettings(env);

  if (userSettings.length === 0) {
    console.log('No configured users found');
    return;
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
}

async function checkAndEnqueueForUser(env, user) {
  const { userId, email, userCreatedAt, sourcePlatform } = user;
  const adapter = SOURCE_ADAPTERS[sourcePlatform];

  if (!adapter || !adapter.isConfigured(user)) {
    return 0;
  }

  // メンテナンスモードチェック（管理者以外はスキップ）
  const maintenanceMode = env.MAINTENANCE_MODE === 'true';
  const isAdmin = env.ADMIN_EMAIL && email === env.ADMIN_EMAIL;
  
  if (maintenanceMode && !isAdmin) {
    console.log(`User ${userId}: Skipped (maintenance mode)`);
    return 0;
  }

  // 1日の書き込み回数制限チェック（管理者は無制限）
  if (!isAdmin) {
    const dailyLimit = DAILY_POST_LIMIT;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const countKey = `daily_post_count:${today}:${userId}`;
    const currentCountStr = await env.KV.get(countKey);
    const currentCount = currentCountStr ? parseInt(currentCountStr, 10) : 0;
    
    if (currentCount >= dailyLimit) {
      console.log(`User ${userId}: Daily limit (${dailyLimit}) reached, skipping`);
      return 0;
    }
  }

  // プラットフォームごとに前回チェック時刻を管理
  const lastPostedAt = await getLastPostedAt(env, userId, sourcePlatform);
  const since = lastPostedAt || userCreatedAt;

  // ソースアダプター用に userId を userSettings に合流させる
  const userWithId = { ...user, userId };

  let posts;
  try {
    posts = await adapter.pollNewPosts(env, userWithId, since);
  } catch (e) {
    console.error(`${sourcePlatform} fetch error for user ${userId}:`, e);
    return 0;
  }

  // ポストIDのキーはプラットフォームごとに異なる
  const getPostId = (post) => post.uri || post.id;

  // 投稿済みのポストを除外
  const newPosts = [];
  for (const post of posts) {
    const id = getPostId(post);
    if (!id) continue;
    if (!(await isPosted(env, `${sourcePlatform}:${id}`))) {
      newPosts.push(post);
    }
  }

  if (newPosts.length === 0) return 0;

  // ハンドル取得（URL構築とログ用）
  let handle = user.blueskyHandle || '';
  try {
    const identity = await adapter.getIdentity(env, userWithId);
    handle = identity.handle || identity.username || handle;
  } catch (e) {
    console.warn(`Could not get identity for user ${userId} on ${sourcePlatform}:`, e);
  }

  // 古い順にキューへ追加（at-least-once配信のため5秒ずつ遅延）
  for (let i = 0; i < newPosts.length; i++) {
    const post = newPosts[i];
    await env.QUEUE.send({
      postId: getPostId(post),
      userId,
      sourcePlatform,
      handle,
      postType: post.type || 'post',
      repostUrl: post.repostUrl || null,
    }, { delaySeconds: i * 5 });
  }

  // キュー追加成功後、書き込み回数をインクリメント（管理者も含む）
  {
    const today = new Date().toISOString().split('T')[0];
    const countKey = `daily_post_count:${today}:${userId}`;
    const currentCountStr = await env.KV.get(countKey);
    const currentCount = currentCountStr ? parseInt(currentCountStr, 10) : 0;
    // TTLは翌日0時までの秒数 + 3600秒（余裕を持たせる）
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    const ttl = Math.floor((tomorrow.getTime() - now.getTime()) / 1000) + 3600;
    await env.KV.put(countKey, String(currentCount + newPosts.length), { expirationTtl: ttl });
  }

  // 最新ポストの時刻を保存（次回cronのsince基準点）
  const newestPost = newPosts[newPosts.length - 1];
  await setLastPostedAt(env, userId, newestPost.createdAt, sourcePlatform);

  console.log(`User ${userId} (${sourcePlatform}): Enqueued ${newPosts.length} posts`);
  return newPosts.length;
}

// queueハンドラ: キューからポストを取り出して各転記先に投稿する
async function handleQueue(batch, env) {
  for (const message of batch.messages) {
    const { postId, userId, sourcePlatform, handle, postType, repostUrl } = message.body;
    const kvKey = `${sourcePlatform}:${postId}`;

    // 冪等性チェック
    if (await isPosted(env, kvKey)) {
      console.log('Already posted, skipping:', kvKey);
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

    // メンテナンスモードチェック（管理者以外はスキップ）
    const maintenanceMode = env.MAINTENANCE_MODE === 'true';
    const userRow = await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(userId).first();
    const userEmail = userRow?.email || '';
    const isAdmin = env.ADMIN_EMAIL && userEmail === env.ADMIN_EMAIL;
    
    if (maintenanceMode && !isAdmin) {
      console.log(`User ${userId}: Queue processing skipped (maintenance mode)`);
      // メンテナンスが終わったら処理されるようにackせずにretry
      message.retry();
      continue;
    }

    // Threads トークンのリフレッシュ（必要な場合）
    if (userSettings.threadsToken) {
      userSettings.threadsToken = await getEffectiveThreadsToken(env, {
        userId,
        threadsToken: userSettings.threadsToken,
        threadsTokenExpiresAt: userSettings.threadsTokenExpiresAt,
      });
    }

    // mixi2 アクセストークンの有効性確認・再取得（必要な場合）
    if (userSettings.mixi2AccessToken) {
      userSettings.mixi2AccessToken = await getEffectiveMixi2Token(env, { userId, ...userSettings });
    }

    const userWithId = { ...userSettings, userId };

    // 転記先プラットフォームを決定
    const destinations = getDestinationsForUser(userWithId);
    // 設定済みだが除外されたプラットフォームをデバッグログ出力
    // mixi2は管理者専用のため、非管理者では未設定が当然なので除外
    const allPlatforms = ['bluesky', 'misskey', 'threads', ...(isAdmin ? ['mixi2'] : [])];
    for (const p of allPlatforms) {
      if (p === sourcePlatform) continue;
      if (!DEST_ADAPTERS[p].isConfigured(userWithId)) {
        console.warn(`User ${userId}: destination "${p}" skipped - not configured (missing credentials)`);
      }
    }
    if (destinations.length === 0) {
      console.error(`User ${userId}: No destinations configured`);
      message.ack();
      continue;
    }

    // ソースからポストを取得・正規化
    const sourceAdapter = SOURCE_ADAPTERS[sourcePlatform];
    let post;
    try {
      post = await sourceAdapter.fetchAndNormalizePost(env, userWithId, postId);
    } catch (e) {
      console.error(`Fetch error for post ${postId} (${sourcePlatform}):`, e);
      message.retry();
      continue;
    }

    if (!post) {
      console.warn('Post not found, skipping:', postId);
      message.ack();
      continue;
    }

    if (postType) post.type = postType;
    if (repostUrl) post.repostUrl = repostUrl;

    // プラットフォーム別のソースURL構築
    const sourceUrl = buildSourceUrl(sourcePlatform, handle, post, env);
    const formattedPost = formatPost({ post, sourceUrl, sourcePlatform });

    if (!formattedPost) {
      console.log('Post skipped (reply or unsupported type):', postId);
      message.ack();
      continue;
    }

    const formatted = { ...formattedPost, sourcePlatform };

    try {
      // 既に投稿済みの宛先を除外してリトライ時の重複投稿を防ぐ
      const pendingDestinations = (
        await Promise.all(
          destinations.map(async (p) => ({
            platform: p,
            done: await isPostedToPlatform(env, p, kvKey),
          }))
        )
      ).filter((r) => !r.done).map((r) => r.platform);

      if (pendingDestinations.length === 0) {
        await markPosted(env, kvKey, post.createdAt);
        message.ack();
        continue;
      }

      const results = await Promise.allSettled(
        pendingDestinations.map((platform) =>
          DEST_ADAPTERS[platform].post(env, userWithId, formatted)
        )
      );

      // 成功した宛先は即座にKVへ記録
      await Promise.all(
        results.map((r, i) =>
          r.status === 'fulfilled'
            ? markPostedToPlatform(env, pendingDestinations[i], kvKey, post.createdAt)
            : Promise.resolve()
        )
      );

      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        failed.forEach((r) => console.error(`Post failed for user ${userId}:`, r.reason));
        // 失敗した宛先のみ次回リトライ（成功済みは markPostedToPlatform で除外される）
        message.retry();
      } else {
        await markPosted(env, kvKey, post.createdAt);
        console.log(`User ${userId}: Posted to [${pendingDestinations.join(', ')}]:`, postId);
        message.ack();
      }
    } catch (e) {
      console.error(`User ${userId}: Post error:`, e);
      message.retry();
    }
  }
}

function buildSourceUrl(sourcePlatform, handle, post, env) {
  switch (sourcePlatform) {
    case 'bluesky': {
      const rkey = (post.uri || '').split('/').pop();
      return `https://bsky.app/profile/${handle}/post/${rkey}`;
    }
    case 'misskey': {
      const instance = env.MISSKEY_INSTANCE || 'misskey.io';
      return `https://${instance}/@${handle}/${post.uri || post.id}`;
    }
    case 'threads':
      return post.permalink || `https://www.threads.net/@${handle}`;
    default:
      return '';
  }
}
