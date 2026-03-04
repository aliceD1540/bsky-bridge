// テスト例: Bluesky APIクライアント
import { fetchBlueskyPosts } from './blueskyClient.js';

(async () => {
  const posts = await fetchBlueskyPosts({
    handle: 'test-handle',
    since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  });
  console.log(posts);
})();
