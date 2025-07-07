const { Expo } = require('expo-server-sdk');
const expo = new Expo();

async function sendPush(to, title, body, data = {}) {
  if (!to || !Expo.isExpoPushToken(to)) {
    console.log('Push not sent: invalid token', to);
    return;
  }
  try {
    console.log('Sending push', { to, title, body, data });
    await expo.sendPushNotificationsAsync([
      { to, sound: 'default', title, body, data },
    ]);
  } catch (err) {
    console.error('Failed to send push', err);
  }
}

module.exports = { sendPush };

