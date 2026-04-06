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
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    throw new Error(`Threads code exchange failed: ${res.status} - ${text}`);
  }
  // user_id は Number.MAX_SAFE_INTEGER を超える大きな整数のため、
  // JSON.parse で精度が失われる。正規表現で文字列として抽出する。
  const userIdMatch = text.match(/"user_id"\s*:\s*"?(\d+)"?/);
  const userId = userIdMatch ? userIdMatch[1] : null;
  const data = JSON.parse(text);
  return { accessToken: data.access_token, userId };
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

  // Threads が取得できる有効な HTTPS URL のみ使用
  const validImages = images.filter((url) => typeof url === 'string' && url.startsWith('http'));
  if (validImages.length !== images.length) {
    console.warn(`postToThreads: ${images.length - validImages.length} image(s) skipped due to invalid URL`);
  }

  let creationId;

  if (validImages.length === 0) {
    // テキストのみ
    creationId = await createContainer({
      userId,
      params: { media_type: 'TEXT', text },
      accessToken,
    });
  } else if (validImages.length === 1) {
    // 画像1枚（失敗時はテキストのみにフォールバック）
    try {
      creationId = await createContainer({
        userId,
        params: { media_type: 'IMAGE', image_url: validImages[0], text },
        accessToken,
      });
    } catch (e) {
      console.warn('Threads image upload failed, falling back to text-only:', e.message);
      creationId = await createContainer({
        userId,
        params: { media_type: 'TEXT', text },
        accessToken,
      });
    }
  } else {
    // カルーセル（複数画像）失敗時はテキストのみにフォールバック
    try {
      const childIds = await Promise.all(
        validImages.map((url) =>
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
    } catch (e) {
      console.warn('Threads carousel upload failed, falling back to text-only:', e.message);
      creationId = await createContainer({
        userId,
        params: { media_type: 'TEXT', text },
        accessToken,
      });
    }
  }

  const threadId = await publishContainer({ userId, creationId, accessToken });
  if (threadId === null) return { success: false, limitReached: true };
  return { success: true, threadId };
}

// 転記元：認証ユーザーの識別情報を取得（ユーザーIDとユーザー名）
export async function fetchThreadsIdentity(accessToken) {
  const res = await fetch(`${THREADS_API}/me?fields=id,username&access_token=${accessToken}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Threads /me failed: ${res.status} - ${body}`);
  }
  return await res.json(); // { id, username }
}

// 転記元：認証ユーザーの新着投稿をポーリング（古い順で返す）
export async function fetchThreadsPostsSince({ accessToken, userId, since }) {
  const fields = 'id,text,media_type,media_url,timestamp,permalink,is_spoiler_media,children{media_url}';
  const sinceUnix = since
    ? Math.floor(new Date(since).getTime() / 1000)
    : Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
  const url = `${THREADS_API}/${userId}/threads?fields=${encodeURIComponent(fields)}&since=${sinceUnix}&limit=50&access_token=${accessToken}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Threads /${userId}/threads failed: ${res.status} - ${text}`);
  }
  const data = await res.json();
  // timestamp で古い順に揃える
  return (data.data || []).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

// 転記元：単一投稿を取得して正規化する
export async function fetchThreadsPost(mediaId, accessToken) {
  const fields = 'id,text,media_type,media_url,timestamp,permalink,is_spoiler_media,children{media_url}';
  const res = await fetch(
    `${THREADS_API}/${mediaId}?fields=${encodeURIComponent(fields)}&access_token=${accessToken}`
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Threads fetchPost failed: ${res.status} - ${body}`);
  }
  return await res.json();
}

// Threads 投稿を formatPost が扱える共通フォーマットに変換
export function normalizeThreadsPost(post) {
  const images = [];
  if (post.media_type === 'IMAGE' && post.media_url) {
    images.push(post.media_url);
  } else if (post.media_type === 'CAROUSEL' && post.children?.data) {
    for (const child of post.children.data) {
      if (child.media_url) images.push(child.media_url);
    }
  }

  return {
    uri: post.id,
    createdAt: post.timestamp,
    text: post.text || '',
    reply: null,
    type: 'post',
    images,
    labels: post.is_spoiler_media ? ['spoiler'] : [],
    permalink: post.permalink,
  };
}
