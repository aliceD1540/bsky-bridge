// 画像URLをWorker経由でプロキシする
// Misskey等のCDN画像をThreadsが直接取得できない場合の対策

const PROXY_TTL = 300; // 5分
const KV_PREFIX = 'media_proxy:';

/**
 * 画像URLの配列をWorkerプロキシURLに変換して返す。
 * 取得できなかった画像はスキップされる。
 */
export async function proxyImages(imageUrls, env) {
  if (!imageUrls || imageUrls.length === 0) return [];
  if (!env.KV || !env.APP_URL) return imageUrls;

  const proxied = [];
  for (const url of imageUrls) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`Media proxy: fetch failed for ${url} (${res.status}), skipping`);
        continue;
      }
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const buffer = await res.arrayBuffer();
      const key = crypto.randomUUID().replace(/-/g, '');
      await env.KV.put(`${KV_PREFIX}${key}`, buffer, {
        expirationTtl: PROXY_TTL,
        metadata: { contentType },
      });
      proxied.push(`${env.APP_URL}/media/${key}`);
    } catch (e) {
      console.warn(`Media proxy: error for ${url}:`, e.message);
    }
  }
  return proxied;
}

/**
 * KVに保存されたプロキシ画像を返すレスポンスを生成する。
 * `/media/:key` ルートから呼び出す。
 */
export async function serveProxiedImage(key, env) {
  const { value, metadata } = await env.KV.getWithMetadata(`${KV_PREFIX}${key}`, { type: 'arrayBuffer' });
  if (!value) {
    return new Response('Not found', { status: 404 });
  }
  return new Response(value, {
    headers: { 'Content-Type': metadata?.contentType || 'image/jpeg' },
  });
}
