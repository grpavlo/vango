import React, { useState } from 'react';
import { View, TouchableOpacity, Image, Modal, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import AppButton from './AppButton';

export default function PhotoPicker({ photo, onChange }) {
  const [preview, setPreview] = useState(false);

  async function pickFromLibrary() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
    });
    if (!res.canceled) onChange(res.assets[0].uri);
  }

  async function takePhoto() {
    const res = await ImagePicker.launchCameraAsync({
      quality: 0.5,
    });
    if (!res.canceled) onChange(res.assets[0].uri);
  }

  return (
    <View style={styles.container}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <AppButton title="Фото" onPress={takePhoto} style={{ flex: 1 }} />
        <AppButton title="Галерея" onPress={pickFromLibrary} style={{ flex: 1 }} />
      </View>
      {photo && (
        <TouchableOpacity onPress={() => setPreview(true)}>
          <Image source={{ uri: photo }} style={styles.thumbnail} />
        </TouchableOpacity>
      )}
      {photo && (
        <Modal visible={preview} transparent>
          <View style={styles.modal}>
            <TouchableOpacity style={styles.close} onPress={() => setPreview(false)}>
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.delete}
              onPress={() => {
                onChange(null);
                setPreview(false);
              }}
            >
              <Ionicons name="trash" size={32} color="#fff" />
            </TouchableOpacity>
            <Image source={{ uri: photo }} style={styles.full} resizeMode="contain" />
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  thumbnail: { width: 100, height: 100, marginVertical: 8 },
  modal: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  full: { width: '100%', height: '100%' },
  close: { position: 'absolute', top: 40, right: 20, zIndex: 1 },
  delete: { position: 'absolute', top: 40, left: 20, zIndex: 1 },
});
