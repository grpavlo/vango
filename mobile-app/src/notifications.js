import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PUSH_CHANNEL_ID = 'orders_v2';
const PUSH_SOUND_FILE = 'notification_sound.mp3';

export async function getPushToken() {
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
      name: 'Замовлення',
      importance: Notifications.AndroidImportance.MAX,
      sound: PUSH_SOUND_FILE,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  let projectId;
  try {
    projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  } catch {}

  const { data } = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  return data;
}