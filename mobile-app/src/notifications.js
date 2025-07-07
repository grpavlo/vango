import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

export async function getPushToken() {
  if (!Device.isDevice) return null;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;
  const { data } = await Notifications.getExpoPushTokenAsync();
  return data;
}

