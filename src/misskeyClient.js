// Misskey.io APIクライアント
// https://misskey.io/api-doc

const MISSKEY_API = 'https://misskey.io/api';

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
    : [];

  const body = JSON.stringify({ i: token, text, fileIds });
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
