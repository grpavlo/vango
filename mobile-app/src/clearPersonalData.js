import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import { DELETION_STORAGE_KEY } from './accountDeletionFlow';
import { drainPersonalStorage } from './personalStorage';
import { resetNotificationCenter } from './notificationCenter';
import { clearCallbacks } from './callbackRegistry';

export async function clearPersonalData() {
  // Writers are paused before the operation; finish writes already queued by old screens.
  await drainPersonalStorage();
  resetNotificationCenter();
  clearCallbacks();
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
  if (Notifications.clearLastNotificationResponseAsync) await Notifications.clearLastNotificationResponseAsync();
  if (FileSystem.cacheDirectory && (await FileSystem.getInfoAsync(FileSystem.cacheDirectory)).exists) {
    const files = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
    for (const file of files) await FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${file}`, {idempotent: true});
  }
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter(key => key !== DELETION_STORAGE_KEY));
}
