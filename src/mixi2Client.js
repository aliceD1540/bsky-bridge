// mixi2 APIクライアント
// mixi2は自動投稿がBotアカウントのみ可能なため、OAuth 2.0を使用

const MIXI2_API = 'https://application-api.mixi.social';
const MIXI2_AUTH_URL = 'https://application-auth.mixi.social/oauth2/token';

// OAuth 2.0でアクセストークンを取得（AuthStyleInHeader: Basic認証でクライアント認証）
export async function fetchMixi2AccessToken(clientId, clientSecret) {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(MIXI2_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`mixi2 oauth/token failed: ${res.status} - ${text}`);
  }
  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

// 転記元：認証ユーザーの識別情報を取得
export async function fetchMixi2Identity(userId) {
  const res = await fetch(`${MIXI2_API}/users/${userId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`mixi2 users/${userId} failed: ${res.status} - ${text}`);
  }
  const data = await res.json();
  return { userId: data.id, username: data.nickname };
}

// 転記元：指定ユーザーの新着投稿をポーリング
export async function fetchMixi2PostsSince({ userId, since }) {
  const params = new URLSearchParams({
    user_id: userId,
    limit: '50',
  });
  if (since) {
    params.set('since', new Date(since).toISOString());
  }
  
  const res = await fetch(`${MIXI2_API}/statuses?${params}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`mixi2 statuses failed: ${res.status} - ${text}`);
  }
  return await res.json();
}

// 転記元：単一投稿を取得
export async function fetchMixi2Post(postId) {
  const res = await fetch(`${MIXI2_API}/statuses/${postId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`mixi2 statuses/${postId} failed: ${res.status} - ${text}`);
  }
  return await res.json();
}

// mixi2投稿を共通フォーマットに変換
export function normalizeMixi2Post(post) {
  // リツイート（引用なし）= リポスト扱い
  if (post.retweeted_status && !post.text) {
    return {
      uri: post.id,
      createdAt: post.created_at,
      text: '',
      reply: post.in_reply_to_status_id ? true : null,
      type: 'repost',
      repostUrl: `https://mixi.jp/view_diary.pl?id=${post.retweeted_status.id}`,
      images: [],
    };
  }

  // 画像のみ抽出
  const images = (post.entities?.media || [])
    .filter((m) => m.type === 'photo' && typeof m.media_url === 'string')
    .map((m) => m.media_url);

  // 引用投稿
  let type = 'post';
  let quotedUrl;
  if (post.quoted_status) {
    type = 'quote';
    quotedUrl = `https://mixi.jp/view_diary.pl?id=${post.quoted_status.id}`;
  }

  return {
    uri: post.id,
    createdAt: post.created_at,
    text: post.text || '',
    reply: post.in_reply_to_status_id ? true : null,
    type,
    images,
    quotedUrl,
  };
}

// 画像アップロード
async function uploadImage(imageUrl, accessToken) {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status} ${imageUrl}`);
  const blob = await imgRes.blob();

  const form = new FormData();
  form.append('media', blob);

  const res = await fetch(`${MIXI2_API}/media/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`mixi2 media/upload failed: ${res.status} - ${text}`);
  }
  const data = await res.json();
  return data.media_id;
}

// 転記先：投稿実行
export async function postToMixi2({ text, images = [], accessToken }) {
  const mediaIds = images.length > 0
    ? await Promise.all(images.map((url) => uploadImage(url, accessToken)))
    : undefined;

  const body = JSON.stringify({
    status: text,
    ...(mediaIds && mediaIds.length > 0 ? { media_ids: mediaIds } : {}),
  });

  const res = await fetch(`${MIXI2_API}/statuses/update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`mixi2 statuses/update failed: ${res.status} - ${text}`);
  }
  const data = await res.json();
  return { success: true, postId: data.id };
}
