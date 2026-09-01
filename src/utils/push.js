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

async function storeNotifications(tokens, title, body, data) {
  try {
    const User = require('../models/user');
    const Notification = require('../models/notification');
    const normalizedRecipientId = Number(data?.recipientUserId);
    const users = Number.isInteger(normalizedRecipientId) && normalizedRecipientId > 0
      ? await User.findAll({ where: { id: normalizedRecipientId } })
      : await User.findAll({ where: { pushConsent: true } });
    const recipientIds = new Set();

    for (const user of users) {
      if (normalizedRecipientId) {
        recipientIds.add(user.id);
        continue;
      }
      const userTokens = normalizePushTokens(user.pushToken);
      if (userTokens.some((token) => tokens.includes(token))) {
        recipientIds.add(user.id);
      }
    }

    const notificationData = {
      ...(data || {}),
      recipientUserId: normalizedRecipientId || data?.recipientUserId,
    };
    const rows = [...recipientIds].map((userId) => ({
      userId,
      title: String(title || '').trim() || 'Сповіщення',
      body: String(body || '').trim(),
      data: notificationData,
      receivedAt: new Date(),
    }));
    if (rows.length > 0) await Notification.bulkCreate(rows);
  } catch (err) {
    console.error('Failed to store notification', err);
  }
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
    await storeNotifications(validTokens, title, body, data);
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
