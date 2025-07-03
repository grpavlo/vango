const { Expo } = require('expo-server-sdk');
const User = require('../models/user');

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

async function sendNotification(userId, message, data = {}) {
  try {
    const user = await User.findByPk(userId);
    if (!user || !user.pushToken) return;
    if (!Expo.isExpoPushToken(user.pushToken)) return;
    const messages = [{
      to: user.pushToken,
      sound: 'default',
      body: message,
      data,
    }];
    await expo.sendPushNotificationsAsync(messages);
  } catch (err) {
    console.log('sendNotification error', err.message);
  }
}

module.exports = { sendNotification };
