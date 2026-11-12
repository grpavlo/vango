import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export async function ensurePhotoPermission(source) {
  const isCamera = source === 'camera';
  const permission = isCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.granted || permission.status === 'granted' ||
      (!isCamera && permission.accessPrivileges === 'limited')) {
    return true;
  }

  const resource = isCamera ? 'камери' : 'фотобібліотеки';
  const retryHint = permission.canAskAgain
    ? 'Спробуйте ще раз і дозвольте доступ або відкрийте налаштування VanGo.'
    : 'Дозвольте доступ у налаштуваннях VanGo, поверніться до застосунку й натисніть «Фото» або «Галерея» ще раз.';
  Alert.alert(`Доступ до ${resource}`, `Щоб додати фото, потрібен доступ до ${resource}. ${retryHint}`, [
    { text: 'Скасувати', style: 'cancel' },
    {
      text: 'Відкрити налаштування',
      onPress: async () => {
        try {
          await Linking.openSettings();
        } catch {
          Alert.alert('Не вдалося відкрити налаштування', 'Відкрийте налаштування пристрою та знайдіть VanGo, щоб змінити доступ.');
        }
      },
    },
  ]);
  return false;
}
