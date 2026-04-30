const { Expo } = require('expo-server-sdk');
const expo = new Expo();
const PUSH_CHANNEL_ID = 'orders_v2';
const PUSH_SOUND_FILE = 'notification_sound.mp3';

async function sendPush(to, title, body, data = {}) {
  if (!to || !Expo.isExpoPushToken(to)) {
    console.log('Push not sent: invalid token', to);
    return;
  }
  try {
    console.log('Sending push', { to, title, body, data });
    const receipts = await expo.sendPushNotificationsAsync([
      {
        to,
        title,
        body,
        data,
        sound: PUSH_SOUND_FILE,
        channelId: PUSH_CHANNEL_ID,
        priority: 'high',
      },
    ]);
    console.log('Push receipts', receipts);
  } catch (err) {
    console.error('Failed to send push', err);
  }
}

module.exports = { sendPush };

