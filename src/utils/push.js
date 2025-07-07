const { Expo } = require('expo-server-sdk');
const expo = new Expo();

async function sendPush(to, title, body, data = {}) {
  if (!to || !Expo.isExpoPushToken(to)) return;
  try {
    await expo.sendPushNotificationsAsync([
      { to, sound: 'default', title, body, data },
    ]);
  } catch (err) {
    console.error('Failed to send push', err);
  }
}

module.exports = { sendPush };

