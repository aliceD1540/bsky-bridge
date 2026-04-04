// 通知送信サービス

import { postToBluesky } from './blueskyPostClient.js';
import { postToMisskey } from './misskeyClient.js';
import { postToThreads } from './threadsClient.js';
import { postToMixi2 } from './mixi2Client.js';

async function sendBlueskyNotification(userSettings, message) {
  if (!userSettings.blueskyHandle || !userSettings.blueskyAppPassword) {
    console.error('Bluesky credentials not configured for notification');
    return { success: false, error: 'Bluesky credentials not configured' };
  }

  try {
    const mentionText = `@${userSettings.blueskyHandle} ${message}`;
    await postToBluesky({
      handle: userSettings.blueskyHandle,
      appPassword: userSettings.blueskyAppPassword,
      text: mentionText,
      images: [],
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to send Bluesky notification:', error);
    return { success: false, error: error.message };
  }
}

async function sendMisskeyNotification(userSettings, message) {
  if (!userSettings.misskeyToken) {
    console.error('Misskey token not configured for notification');
    return { success: false, error: 'Misskey token not configured' };
  }

  try {
    await postToMisskey({
      token: userSettings.misskeyToken,
      text: message,
      images: [],
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to send Misskey notification:', error);
    return { success: false, error: error.message };
  }
}

async function sendThreadsNotification(userSettings, message) {
  if (!userSettings.threadsToken) {
    console.error('Threads token not configured for notification');
    return { success: false, error: 'Threads token not configured' };
  }

  try {
    await postToThreads({
      accessToken: userSettings.threadsToken,
      text: message,
      images: [],
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to send Threads notification:', error);
    return { success: false, error: error.message };
  }
}

async function sendMixi2Notification(userSettings, message) {
  if (!userSettings.mixi2AccessToken) {
    console.error('mixi2 access token not configured for notification');
    return { success: false, error: 'mixi2 access token not configured' };
  }

  try {
    await postToMixi2({
      accessToken: userSettings.mixi2AccessToken,
      text: message,
      images: [],
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to send mixi2 notification:', error);
    return { success: false, error: error.message };
  }
}

export async function sendReplyNotification(sourcePlatform, userSettings, replyPlatform, postUrl) {
  const platformNames = {
    bluesky: 'Bluesky',
    misskey: 'Misskey.io',
    threads: 'Threads',
    mixi2: 'mixi2',
  };

  const message = `bsky-bridgeからの連絡です。${platformNames[replyPlatform] || replyPlatform}に新規のリプライが届きました！${postUrl ? ' ' + postUrl : ''}`;

  console.log(`Sending notification to ${sourcePlatform} about reply from ${replyPlatform}`);

  switch (sourcePlatform) {
    case 'bluesky':
      return sendBlueskyNotification(userSettings, message);
    case 'misskey':
      return sendMisskeyNotification(userSettings, message);
    case 'threads':
      return sendThreadsNotification(userSettings, message);
    case 'mixi2':
      return sendMixi2Notification(userSettings, message);
    default:
      console.error(`Unknown source platform: ${sourcePlatform}`);
      return { success: false, error: 'Unknown source platform' };
  }
}
