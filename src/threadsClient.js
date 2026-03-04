// Threads APIクライアント
// https://developers.facebook.com/docs/threads/posts

const THREADS_API = 'https://graph.threads.net/v1.0';

async function getUserId(accessToken) {
  const res = await fetch(`${THREADS_API}/me?fields=id&access_token=${accessToken}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Threads getUserId failed: ${res.status} - ${body}`);
  }
  const data = await res.json();
  return data.id;
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
