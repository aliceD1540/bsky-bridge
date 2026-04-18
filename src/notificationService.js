// 通知送信サービス
// 通知は転記元ユーザーのアカウントではなく、固定の通知用アカウント（Secret設定）から送信する

import { resolveBlueskyHandle } from './blueskyClient.js';
import { postToBluesky } from './blueskyPostClient.js';
import { fetchMisskeyIdentity, postToMisskey } from './misskeyClient.js';
import { fetchThreadsIdentity, postToThreads } from './threadsClient.js';
import { postToMixi2 } from './mixi2Client.js';

// Bluesky のメンションファセットを構築する
// テキスト内の @handle の正確なバイト位置と対象 DID が必要
async function buildMentionFacet(text, handle, did) {
  const encoder = new TextEncoder();
  const mentionStr = `@${handle}`;
  const byteStart = encoder.encode(text.slice(0, text.indexOf(mentionStr))).length;
  const byteEnd = byteStart + encoder.encode(mentionStr).length;
  return {
    index: { byteStart, byteEnd },
    features: [{ $type: 'app.bsky.richtext.facet#mention', did }],
  };
}

// Bluesky のリンクファセットを構築する
function buildLinkFacet(text, url) {
  const encoder = new TextEncoder();
  const byteStart = encoder.encode(text.slice(0, text.indexOf(url))).length;
  const byteEnd = byteStart + encoder.encode(url).length;
  return {
    index: { byteStart, byteEnd },
    features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }],
  };
}

// 必要なSecret: NOTIFICATION_BLUESKY_HANDLE, NOTIFICATION_BLUESKY_APP_PASSWORD
async function sendBlueskyNotification(env, userSettings, message, postUrl) {
  if (!env.NOTIFICATION_BLUESKY_HANDLE || !env.NOTIFICATION_BLUESKY_APP_PASSWORD) {
    console.error('Notification Bluesky credentials not configured');
    return { success: false, error: 'Notification Bluesky credentials not configured' };
  }

  try {
    let text = `${message}\n${postUrl}`;
    const facets = [];

    if (userSettings.blueskyHandle) {
      text = `@${userSettings.blueskyHandle} ${text}`;
      try {
        const did = await resolveBlueskyHandle(userSettings.blueskyHandle);
        facets.push(await buildMentionFacet(text, userSettings.blueskyHandle, did));
      } catch (e) {
        console.warn('Could not resolve Bluesky handle for mention facet:', e.message);
      }
    }

    facets.push(buildLinkFacet(text, postUrl));

    await postToBluesky({
      handle: env.NOTIFICATION_BLUESKY_HANDLE,
      appPassword: env.NOTIFICATION_BLUESKY_APP_PASSWORD,
      text,
      images: [],
      facets,
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to send Bluesky notification:', error);
    return { success: false, error: error.message };
  }
}

// 必要なSecret: NOTIFICATION_MISSKEY_TOKEN
async function sendMisskeyNotification(env, userSettings, message, postUrl) {
  if (!env.NOTIFICATION_MISSKEY_TOKEN) {
    console.error('Notification Misskey token not configured');
    return { success: false, error: 'Notification Misskey token not configured' };
  }

  try {
    let text = `${message}\n${postUrl}`;
    if (userSettings.misskeyToken) {
      try {
        const { username } = await fetchMisskeyIdentity(userSettings.misskeyToken);
        if (username) text = `@${username} ${text}`;
      } catch (e) {
        console.warn('Could not fetch Misskey username for mention:', e.message);
      }
    }
    await postToMisskey({
      token: env.NOTIFICATION_MISSKEY_TOKEN,
      text,
      images: [],
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to send Misskey notification:', error);
    return { success: false, error: error.message };
  }
}

// 必要なSecret: NOTIFICATION_THREADS_TOKEN
async function sendThreadsNotification(env, userSettings, message, postUrl) {
  if (!env.NOTIFICATION_THREADS_TOKEN) {
    console.error('Notification Threads token not configured');
    return { success: false, error: 'Notification Threads token not configured' };
  }

  try {
    let text = `${message}\n${postUrl}`;
    if (userSettings.threadsToken) {
      try {
        const { username } = await fetchThreadsIdentity(userSettings.threadsToken);
        if (username) text = `@${username} ${text}`;
      } catch (e) {
        console.warn('Could not fetch Threads username for mention:', e.message);
      }
    }
    await postToThreads({
      accessToken: env.NOTIFICATION_THREADS_TOKEN,
      text,
      images: [],
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to send Threads notification:', error);
    return { success: false, error: error.message };
  }
}

// 必要なSecret: NOTIFICATION_MIXI2_ACCESS_TOKEN
async function sendMixi2Notification(env, _userSettings, message, postUrl) {
  if (!env.NOTIFICATION_MIXI2_ACCESS_TOKEN) {
    console.error('Notification mixi2 access token not configured');
    return { success: false, error: 'Notification mixi2 access token not configured' };
  }

  try {
    const text = `${message}\n${postUrl}`;
    await postToMixi2({
      accessToken: env.NOTIFICATION_MIXI2_ACCESS_TOKEN,
      text,
      images: [],
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to send mixi2 notification:', error);
    return { success: false, error: error.message };
  }
}

export async function sendReplyNotification(env, sourcePlatform, userSettings, replyPlatform, postUrl) {
  const platformNames = {
    bluesky: 'Bluesky',
    misskey: 'Misskey.io',
    threads: 'Threads',
    mixi2: 'mixi2',
  };

  const message = `bsky-bridgeからの連絡です。${platformNames[replyPlatform] || replyPlatform}に新規のリプライが届きました！`;

  console.log(`Sending notification to ${sourcePlatform} about reply from ${replyPlatform}`);

  switch (sourcePlatform) {
    case 'bluesky':
      return sendBlueskyNotification(env, userSettings, message, postUrl);
    case 'misskey':
      return sendMisskeyNotification(env, userSettings, message, postUrl);
    case 'threads':
      return sendThreadsNotification(env, userSettings, message, postUrl);
    case 'mixi2':
      return sendMixi2Notification(env, userSettings, message, postUrl);
    default:
      console.error(`Unknown source platform: ${sourcePlatform}`);
      return { success: false, error: 'Unknown source platform' };
  }
}
