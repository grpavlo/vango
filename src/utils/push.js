const { Expo } = require('expo-server-sdk');
const expo = new Expo();
const PUSH_CHANNEL_ID = 'orders_v2';
const PUSH_SOUND_FILE = 'notification_sound.mp3';

function normalizePushTokens(to) {
  if (!to) return [];
  if (Array.isArray(to)) {
    return [...new Set(to.flatMap(normalizePushTokens))];
  }
  if (typeof to === 'string') {
    const trimmed = to.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return normalizePushTokens(parsed);
      } catch {
        return [trimmed];
      }
    }
    return [trimmed];
  }
  return [];
}

async function sendPush(to, title, body, data = {}) {
  const tokens = normalizePushTokens(to);
  const validTokens = tokens.filter((token) => Expo.isExpoPushToken(token));
  const invalidTokens = tokens.filter((token) => !Expo.isExpoPushToken(token));
  if (invalidTokens.length > 0) {
    console.log('Push skipped invalid tokens', invalidTokens);
  }
  if (validTokens.length === 0) {
    console.log('Push not sent: no valid tokens', to);
    return;
  }
  try {
    console.log('Sending push', { to: validTokens, title, body, data });
    const messages = validTokens.map((token) => ({
      to: token,
      title,
      body,
      data,
      sound: PUSH_SOUND_FILE,
      channelId: PUSH_CHANNEL_ID,
      priority: 'high',
    }));
    const receipts = await expo.sendPushNotificationsAsync(messages);
    console.log('Push receipts', receipts);
  } catch (err) {
    console.error('Failed to send push', err);
  }
}

module.exports = { sendPush, normalizePushTokens };
