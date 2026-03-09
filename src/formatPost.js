// 投稿判定・整形ロジック
// DESIGN.mdの仕様に基づく

const MAX_TEXT_LENGTH = 400;

export function formatPost({ post, blueskyUrl }) {
  // post: Blueskyポストオブジェクト
  // blueskyUrl: ポストURL
  let text = post.text || '';
  let cardUrl = post.cardUrl;
  let images = post.images || [];
  const labels = post.labels || [];
  let type = post.type || '';
  let quotedUrl = post.quotedUrl;
  let repostUrl = post.repostUrl;

  // リプライは無視
  if (post.reply) return null;

  // 文字数制限
  if (text.length > 500) {
    text = text.slice(0, MAX_TEXT_LENGTH) + `...\n全文はこちら：${blueskyUrl}`;
    cardUrl = undefined; // 仕様：切り詰め時はカードURL含めない
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

  // センシティブラベルがある場合、画像を転載せずBlueskyの元ポストへのリンクに差し替え
  if (labels.length > 0 && images.length > 0) {
    text = `${text}\n⚠️ このポストにはセンシティブなラベル（${labels.join(', ')}）が付いています。\n画像は転載されません。元ポスト: ${blueskyUrl}`.trim();
    images = [];
  }

  // Blueskyの仕様上、画像は最大4枚
  images = images.slice(0, 4);

  return { text, images };
}
