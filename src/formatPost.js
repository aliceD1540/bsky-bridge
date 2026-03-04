// 投稿判定・整形ロジック
// DESIGN.mdの仕様に基づく

const MAX_TEXT_LENGTH = 400;

export function formatPost({ post, blueskyUrl }) {
  // post: Blueskyポストオブジェクト
  // blueskyUrl: ポストURL
  let text = post.text || '';
  let cardUrl = post.cardUrl;
  let images = post.images || [];
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

  // 画像10枚超はエラーログを出力して終了（運用上到達しない想定）
  if (images.length > 10) {
    console.error('Too many images (max 10):', images.length);
    return null;
  }

  return { text, images };
}
