import React, { useState } from 'react';
import { View, TouchableOpacity, Image, Modal, StyleSheet, ScrollView, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import AppButton from './AppButton';

export default function PhotoPicker({ photos, onChange }) {
  const [previewIndex, setPreviewIndex] = useState(null);

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Доступ до фото', 'Надайте доступ до галереї');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
    });
    if (!res.canceled) onChange([...(photos || []), res.assets[0].uri]);
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Доступ до камери', 'Надайте доступ до камери');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      quality: 0.5,
    });
    if (!res.canceled) onChange([...(photos || []), res.assets[0].uri]);
  }

  return (
    <View style={styles.container}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <AppButton title="Фото" onPress={takePhoto} style={{ flex: 1 }} />
        <AppButton title="Галерея" onPress={pickFromLibrary} style={{ flex: 1 }} />
      </View>
      {photos && photos.length > 0 && (
        <ScrollView horizontal style={{ marginTop: 8 }}>
          {photos.map((p, i) => (
            <TouchableOpacity key={i} onPress={() => setPreviewIndex(i)}>
              <Image source={{ uri: p }} style={styles.thumbnail} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {previewIndex !== null && photos && (
        <Modal visible transparent>
          <View style={styles.modal}>
            <TouchableOpacity style={styles.close} onPress={() => setPreviewIndex(null)}>
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.delete}
              onPress={() => {
                const newPhotos = photos.filter((_, idx) => idx !== previewIndex);
                onChange(newPhotos);
                setPreviewIndex(null);
              }}
            >
              <Ionicons name="trash" size={32} color="#fff" />
            </TouchableOpacity>
            <Image source={{ uri: photos[previewIndex] }} style={styles.full} resizeMode="contain" />
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  thumbnail: { width: 100, height: 100, marginRight: 8 },
  modal: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  full: { width: '100%', height: '100%' },
  close: { position: 'absolute', top: 40, right: 20, zIndex: 1 },
  delete: { position: 'absolute', top: 40, left: 20, zIndex: 1 },
});
