// 投稿判定・整形ロジック
// DESIGN.mdの仕様に基づく

const MAX_TEXT_LENGTH = 400;

export function formatPost({ post, sourceUrl, sourcePlatform = 'bluesky', blueskyUrl }) {
  // 後方互換: blueskyUrl は sourceUrl として扱う
  const url = sourceUrl || blueskyUrl || '';

  let text = post.text || '';
  let cardUrl = post.cardUrl;
  let images = post.images || [];
  const labels = post.labels || [];
  let type = post.type || '';
  let quotedUrl = post.quotedUrl;
  let repostUrl = post.repostUrl;

  // Misskey: CW（コンテンツ警告）付き投稿はスキップ
  if (sourcePlatform === 'misskey' && post.cw) return null;

  // Misskey: 公開範囲がpublic以外はスキップ
  if (sourcePlatform === 'misskey' && post.visibility && post.visibility !== 'public') return null;

  // リプライは無視
  if (post.reply) return null;

  // 文字数制限（500文字超の場合は切り詰めてソースURLを付与）
  if (text.length > 500) {
    text = text.slice(0, MAX_TEXT_LENGTH) + `...\n全文はこちら：${url}`;
    cardUrl = undefined;
  } else if (cardUrl) {
    text += `\n${cardUrl}`;
  }

  // リポスト
  if (type === 'repost' && repostUrl) {
    text = `Repost ${repostUrl}`;
    images = [];
  }

  // 引用
  if (type === 'quote' && quotedUrl) {
    text = `${text} ${quotedUrl}`;
  }

  // センシティブラベルがある場合、画像を転載せずソースポストへのリンクに差し替え
  if (labels.length > 0 && images.length > 0) {
    text = `${text}\n⚠️ このポストにはセンシティブなラベル（${labels.join(', ')}）が付いています。\n画像は転載されません。元ポスト: ${url}`.trim();
    images = [];
  }

  // 画像は最大4枚（Bluesky仕様に合わせた共通上限）
  images = images.slice(0, 4);

  return { text, images };
}
