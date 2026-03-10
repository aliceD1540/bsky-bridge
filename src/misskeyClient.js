// Misskey.io APIクライアント
// https://misskey.io/api-doc

const MISSKEY_API = 'https://misskey.io/api';

// 転記元：認証ユーザーの識別情報を取得（ユーザーIDとユーザー名）
export async function fetchMisskeyIdentity(token) {
  const res = await fetch(`${MISSKEY_API}/i`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ i: token }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Misskey /i failed: ${res.status} - ${text}`);
  }
  const data = await res.json();
  return { userId: data.id, username: data.username };
}

// 転記元：指定ユーザーの新着ノートをポーリング（新しい順で返る）
export async function fetchMisskeyNotesSince({ token, userId, sinceDate }) {
  const res = await fetch(`${MISSKEY_API}/users/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ i: token, userId, sinceDate, limit: 50 }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Misskey users/notes failed: ${res.status} - ${text}`);
  }
  return await res.json();
}

// 転記元：単一ノートを取得して正規化する
export async function fetchMisskeyNote(noteId, token) {
  const res = await fetch(`${MISSKEY_API}/notes/show`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ i: token, noteId }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Misskey notes/show failed: ${res.status} - ${text}`);
  }
  return await res.json();
}

// Misskey ノートを formatPost が扱える共通フォーマットに変換
export function normalizeMisskeyNote(note) {
  // renote（引用なし）= リポスト扱い
  if (note.renoteId && !note.text) {
    return {
      uri: note.id,
      createdAt: note.createdAt,
      text: '',
      reply: note.replyId ? true : null,
      type: 'repost',
      repostUrl: `https://misskey.io/notes/${note.renoteId}`,
      images: [],
      visibility: note.visibility,
    };
  }

  // 画像ファイルのみ抽出（動画・無効URLはスキップ）
  const images = (note.files || [])
    .filter((f) => f.type?.startsWith('image/') && typeof f.url === 'string' && f.url.startsWith('http'))
    .map((f) => f.url);

  // renote + text = 引用ノート
  let type = 'post';
  let quotedUrl;
  if (note.renoteId && note.text) {
    type = 'quote';
    quotedUrl = `https://misskey.io/notes/${note.renoteId}`;
  }

  return {
    uri: note.id,
    createdAt: note.createdAt,
    text: note.text || '',
    cw: note.cw || null,
    reply: note.replyId ? true : null,
    type,
    images,
    quotedUrl,
    visibility: note.visibility,
  };
}

async function uploadImage(imageUrl, token) {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status} ${imageUrl}`);
  const blob = await imgRes.blob();

  const form = new FormData();
  form.append('i', token);
  form.append('file', blob, 'image');

  const res = await fetch(`${MISSKEY_API}/drive/files/create`, { method: 'POST', body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Misskey uploadImage failed: ${res.status} - ${text}`);
  }
  const data = await res.json();
  return data.id;
}

export async function postToMisskey({ text, images = [], token }) {
  const fileIds = images.length > 0
    ? await Promise.all(images.map((url) => uploadImage(url, token)))
    : undefined;

  const body = JSON.stringify({ i: token, text, ...(fileIds ? { fileIds } : {}) });
  const res = await fetch(`${MISSKEY_API}/notes/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Misskey postToMisskey failed: ${res.status} - ${text}`);
  }
  const data = await res.json();
  return { success: true, noteId: data.createdNote?.id };
}
