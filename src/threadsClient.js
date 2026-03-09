// Threads APIクライアント
// https://developers.facebook.com/docs/threads/posts

const THREADS_API = 'https://graph.threads.net/v1.0';
const THREADS_AUTH_URL = 'https://threads.net/oauth/authorize';
const THREADS_TOKEN_URL = 'https://graph.threads.net/oauth/access_token';
const THREADS_LONG_LIVED_TOKEN_URL = 'https://graph.threads.net/access_token';

// OAuth認可URLを生成する
export function buildThreadsAuthUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'threads_basic,threads_content_publish',
    response_type: 'code',
    state,
  });
  return `${THREADS_AUTH_URL}?${params}`;
}

// 認可コードを短期トークンに交換する
export async function exchangeCodeForToken({ code, redirectUri, env }) {
  const body = new URLSearchParams({
    client_id: env.THREADS_APP_ID,
    client_secret: env.THREADS_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(THREADS_TOKEN_URL, { method: 'POST', body });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Threads code exchange failed: ${res.status} - ${text}`);
  }
  const data = await res.json();
  // data.access_token (短期, 1時間), data.user_id
  return { accessToken: data.access_token, userId: data.user_id };
}

// 短期トークンを長期トークン（60日）に交換する
export async function exchangeForLongLivedToken({ shortLivedToken, env }) {
  const params = new URLSearchParams({
    grant_type: 'th_exchange_token',
    client_secret: env.THREADS_APP_SECRET,
    access_token: shortLivedToken,
  });
  const res = await fetch(`${THREADS_LONG_LIVED_TOKEN_URL}?${params}`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Threads long-lived token exchange failed: ${res.status} - ${text}`);
  }
  const data = await res.json();
  // data.access_token, data.expires_in (seconds)
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

async function getUserId(accessToken) {
  const res = await fetch(`${THREADS_API}/me?fields=id&access_token=${accessToken}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Threads getUserId failed: ${res.status} - ${body}`);
  }
  const data = await res.json();
  return data.id;
}

// 長期トークンのリフレッシュ（有効期限が近い場合に呼び出す）
export async function refreshThreadsToken(accessToken) {
  const res = await fetch(
    `${THREADS_API}/refresh_access_token?grant_type=th_refresh_token&access_token=${accessToken}`
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Threads token refresh failed: ${res.status} - ${body}`);
  }
  const data = await res.json();
  // data.access_token, data.expires_in (seconds)
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

async function createContainer({ userId, params, accessToken }) {
  const url = `${THREADS_API}/${userId}/threads`;
  const body = new URLSearchParams({ ...params, access_token: accessToken });
  const res = await fetch(url, { method: 'POST', body });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Threads createContainer failed: ${res.status} - ${text}`);
  }
  const data = await res.json();
  return data.id;
}

async function publishContainer({ userId, creationId, accessToken }) {
  const url = `${THREADS_API}/${userId}/threads_publish`;
  const body = new URLSearchParams({ creation_id: creationId, access_token: accessToken });
  const res = await fetch(url, { method: 'POST', body });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const data = (() => { try { return JSON.parse(text); } catch { return {}; } })();
    // 250件/日制限
    if (res.status === 429 || data?.error?.code === 32) {
      console.error('Threads daily limit reached (250/day):', text);
      return null;
    }
    throw new Error(`Threads publishContainer failed: ${res.status} - ${text}`);
  }
  const data = await res.json();
  return data.id;
}

export async function postToThreads({ text, images = [], accessToken }) {
  const userId = await getUserId(accessToken);

  let creationId;

  if (images.length === 0) {
    // テキストのみ
    creationId = await createContainer({
      userId,
      params: { media_type: 'TEXT', text },
      accessToken,
    });
  } else if (images.length === 1) {
    // 画像1枚
    creationId = await createContainer({
      userId,
      params: { media_type: 'IMAGE', image_url: images[0], text },
      accessToken,
    });
  } else {
    // カルーセル（複数画像）
    const childIds = await Promise.all(
      images.map((url) =>
        createContainer({
          userId,
          params: { media_type: 'IMAGE', image_url: url, is_carousel_item: 'true' },
          accessToken,
        })
      )
    );
    creationId = await createContainer({
      userId,
      params: { media_type: 'CAROUSEL', children: childIds.join(','), text },
      accessToken,
    });
  }

  const threadId = await publishContainer({ userId, creationId, accessToken });
  if (threadId === null) return { success: false, limitReached: true };
  return { success: true, threadId };
}
