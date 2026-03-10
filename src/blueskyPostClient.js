// Bluesky への投稿クライアント（転記先として使用）
// https://atproto.com/lexicons/com-atproto-repo

const BLUESKY_PDS = 'https://bsky.social/xrpc';

async function createSession(identifier, appPassword) {
  const res = await fetch(`${BLUESKY_PDS}/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password: appPassword }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Bluesky createSession failed: ${res.status} - ${body}`);
  }
  const data = await res.json();
  return { did: data.did, accessJwt: data.accessJwt };
}

async function uploadBlob(imageUrl, accessJwt) {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status} ${imageUrl}`);
  const blob = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get('content-type') || 'image/jpeg';

  const res = await fetch(`${BLUESKY_PDS}/com.atproto.repo.uploadBlob`, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      'Authorization': `Bearer ${accessJwt}`,
    },
    body: blob,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Bluesky uploadBlob failed: ${res.status} - ${text}`);
  }
  const data = await res.json();
  return data.blob;
}

export async function postToBluesky({ text, images = [], handle, appPassword }) {
  const { did, accessJwt } = await createSession(handle, appPassword);

  let embed;
  if (images.length > 0) {
    // Bluesky は最大 4 枚
    const slicedImages = images.slice(0, 4);
    const blobs = await Promise.all(slicedImages.map((url) => uploadBlob(url, accessJwt)));
    embed = {
      $type: 'app.bsky.embed.images',
      images: blobs.map((blob) => ({ image: blob, alt: '' })),
    };
  }

  const record = {
    $type: 'app.bsky.feed.post',
    text,
    createdAt: new Date().toISOString(),
    ...(embed ? { embed } : {}),
  };

  const res = await fetch(`${BLUESKY_PDS}/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessJwt}`,
    },
    body: JSON.stringify({ repo: did, collection: 'app.bsky.feed.post', record }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Bluesky createRecord failed: ${res.status} - ${body}`);
  }
  const data = await res.json();
  return { success: true, uri: data.uri };
}
