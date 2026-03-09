// ソース・デスティネーションアダプター
// 各アダプターは (env, userSettings) を受け取り、プラットフォームごとの処理を抽象化する

import { fetchBlueskyPosts, fetchBlueskyPostByUri } from './blueskyClient.js';
import { postToBluesky } from './blueskyPostClient.js';
import {
  fetchMisskeyIdentity,
  fetchMisskeyNotesSince,
  fetchMisskeyNote,
  normalizeMisskeyNote,
  postToMisskey,
} from './misskeyClient.js';
import {
  fetchThreadsIdentity,
  fetchThreadsPostsSince,
  fetchThreadsPost,
  normalizeThreadsPost,
  postToThreads,
} from './threadsClient.js';
import { getCachedSourceIdentity, setCachedSourceIdentity } from './kvStore.js';

// ソースアダプター定義
export const SOURCE_ADAPTERS = {
  bluesky: {
    isConfigured(userSettings) {
      return !!(userSettings.blueskyHandle);
    },

    // Bluesky は公開APIなのでアプリパスワード不要
    async getIdentity(_env, userSettings) {
      return { handle: userSettings.blueskyHandle };
    },

    async pollNewPosts(_env, userSettings, since) {
      const { blueskyHandle } = userSettings;
      return fetchBlueskyPosts({ handle: blueskyHandle, since });
    },

    async fetchAndNormalizePost(_env, _userSettings, postIdOrPost) {
      if (typeof postIdOrPost === 'string') {
        return fetchBlueskyPostByUri(postIdOrPost);
      }
      return postIdOrPost;
    },
  },

  misskey: {
    isConfigured(userSettings) {
      return !!(userSettings.misskeyToken);
    },

    async getIdentity(env, userSettings) {
      const cached = await getCachedSourceIdentity(env, 'misskey', userSettings.userId);
      if (cached) return cached;
      const identity = await fetchMisskeyIdentity(userSettings.misskeyToken);
      await setCachedSourceIdentity(env, 'misskey', userSettings.userId, identity);
      return identity;
    },

    async pollNewPosts(env, userSettings, since) {
      const identity = await SOURCE_ADAPTERS.misskey.getIdentity(env, userSettings);
      // Misskey sinceDate はUnixタイムスタンプ（ミリ秒・整数）が必要
      const sinceDate = since ? new Date(since).getTime() : undefined;
      return fetchMisskeyNotesSince({
        token: userSettings.misskeyToken,
        userId: identity.userId,
        sinceDate,
      });
    },

    async fetchAndNormalizePost(_env, userSettings, note) {
      if (typeof note === 'object' && note !== null && note.id) return normalizeMisskeyNote(note);
      const raw = await fetchMisskeyNote(note, userSettings.misskeyToken);
      return normalizeMisskeyNote(raw);
    },
  },

  threads: {
    isConfigured(userSettings) {
      return !!(userSettings.threadsToken);
    },

    async getIdentity(env, userSettings) {
      const cached = await getCachedSourceIdentity(env, 'threads', userSettings.userId);
      if (cached) return cached;
      const identity = await fetchThreadsIdentity(userSettings.threadsToken);
      await setCachedSourceIdentity(env, 'threads', userSettings.userId, identity);
      return identity;
    },

    async pollNewPosts(env, userSettings, since) {
      const identity = await SOURCE_ADAPTERS.threads.getIdentity(env, userSettings);
      return fetchThreadsPostsSince({
        accessToken: userSettings.threadsToken,
        userId: identity.id,
        since,
      });
    },

    async fetchAndNormalizePost(_env, userSettings, post) {
      if (post.text !== undefined || post.media_type) return normalizeThreadsPost(post);
      const raw = await fetchThreadsPost(post.id || post, userSettings.threadsToken);
      return normalizeThreadsPost(raw);
    },
  },
};

// デスティネーションアダプター定義
export const DEST_ADAPTERS = {
  misskey: {
    isConfigured(userSettings) {
      return !!(userSettings.misskeyToken);
    },

    async post(env, userSettings, formatted) {
      return postToMisskey({ text: formatted.text, images: formatted.images, token: userSettings.misskeyToken });
    },
  },

  threads: {
    isConfigured(userSettings) {
      return !!(userSettings.threadsToken);
    },

    async post(_env, userSettings, formatted) {
      return postToThreads({ text: formatted.text, images: formatted.images, accessToken: userSettings.threadsToken });
    },
  },

  bluesky: {
    isConfigured(userSettings) {
      return !!(userSettings.blueskyHandle && userSettings.blueskyAppPassword);
    },

    async post(_env, userSettings, formatted) {
      return postToBluesky({
        handle: userSettings.blueskyHandle,
        appPassword: userSettings.blueskyAppPassword,
        text: formatted.text,
        images: formatted.images,
      });
    },
  },
};

// ユーザーの転記先プラットフォーム一覧を返す（転記元を除く全設定済みプラットフォーム）
export function getDestinationsForUser(userSettings) {
  const source = userSettings.sourcePlatform;
  return Object.entries(DEST_ADAPTERS)
    .filter(([platform, adapter]) => platform !== source && adapter.isConfigured(userSettings))
    .map(([platform]) => platform);
}
