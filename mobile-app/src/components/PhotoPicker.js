import React, { useCallback, useRef, useState } from "react";
import {
  View,
  TouchableOpacity,
  Image,
  Modal,
  StyleSheet,
  ScrollView,
  Pressable,
  Text,
} from "react-native";
import { useToast } from "./Toast";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./Colors";

export default function PhotoPicker({ photos, onChange, maxCount = 10 }) {
  // нормалізуємо у масив рядків-URL
  const list = Array.isArray(photos)
    ? photos.filter(Boolean)
    : photos
    ? [photos]
    : [];
  const [previewIndex, setPreviewIndex] = useState(null);
  const toast = useToast();
  const previewTouchStartRef = useRef(null);
  const closePreview = useCallback(() => setPreviewIndex(null), []);

  function handlePreviewTouchStart(event) {
    const touch = event.nativeEvent?.touches?.[0] || event.nativeEvent;
    previewTouchStartRef.current = {
      x: touch?.pageX || 0,
      y: touch?.pageY || 0,
      at: Date.now(),
    };
  }

  function handlePreviewTouchEnd(event) {
    const start = previewTouchStartRef.current;
    previewTouchStartRef.current = null;
    if (!start) return;
    const touch =
      event.nativeEvent?.changedTouches?.[0] ||
      event.nativeEvent?.touches?.[0] ||
      event.nativeEvent;
    const dx = (touch?.pageX || 0) - start.x;
    const dy = (touch?.pageY || 0) - start.y;
    const elapsed = Math.max(Date.now() - start.at, 1);
    const distance = Math.max(Math.abs(dx), Math.abs(dy));
    const velocity = distance / elapsed;
    if (distance > 45 || velocity > 0.35) {
      closePreview();
    }
  }

  const makeNextPhotos = (newUri) => {
    if (!newUri) return list;
    if (maxCount === 1) return [newUri];
    return [...list, newUri].slice(0, maxCount);
  };

  async function pickFromLibrary() {
    if (maxCount > 1 && list.length >= maxCount) {
      toast.show("Максимум 10 фотографій");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      toast.show("Надайте доступ до галереї");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.5,
    });
    if (!res.canceled) onChange(makeNextPhotos(res.assets[0].uri));
  }

  async function takePhoto() {
    if (maxCount > 1 && list.length >= maxCount) {
      toast.show("Максимум 10 фотографій");
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== "granted") {
      toast.show("Надайте доступ до камери");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      quality: 0.5,
    });
    if (!res.canceled) onChange(makeNextPhotos(res.assets[0].uri));
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable
          onPress={takePhoto}
          style={({ pressed }) => [
            styles.action,
            pressed && styles.actionPressed,
          ]}
        >
          <Text style={styles.actionText}>Фото</Text>
        </Pressable>
        <Pressable
          onPress={pickFromLibrary}
          style={({ pressed }) => [
            styles.action,
            pressed && styles.actionPressed,
          ]}
        >
          <Text style={styles.actionText}>Галерея</Text>
        </Pressable>
      </View>
      {list.length > 0 && (
        <ScrollView horizontal style={{ marginTop: 8 }}>
          {list.map((p, i) => (
            <TouchableOpacity key={i} onPress={() => setPreviewIndex(i)}>
              <Image source={{ uri: p }} style={styles.thumbnail} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {previewIndex !== null && list.length > 0 && (
        <Modal visible transparent onRequestClose={closePreview}>
          <View style={styles.modal}>
            <Image
              source={{ uri: list[previewIndex] }}
              style={styles.full}
              resizeMode="contain"
            />
            <View
              style={styles.swipeCloseLayer}
              onTouchStart={handlePreviewTouchStart}
              onTouchEnd={handlePreviewTouchEnd}
            />
            <TouchableOpacity
              style={styles.close}
              onPress={closePreview}
            >
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.delete}
              onPress={() => {
                const newPhotos = list.filter(
                  (_, idx) => idx !== previewIndex
                );
                onChange(newPhotos);
                closePreview();
              }}
            >
              <Ionicons name="trash" size={32} color="#fff" />
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center" },
  row: { flexDirection: "row", gap: 8, width: "100%" },
  action: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  actionPressed: { backgroundColor: "#F3F4F6" },
  actionText: { fontWeight: "600", color: colors.text },
  thumbnail: { width: 100, height: 100, marginRight: 8 },
  modal: {
    flex: 1,
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
  },
  full: { width: "100%", height: "100%" },
  swipeCloseLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  close: { position: "absolute", top: 40, right: 20, zIndex: 2 },
  delete: { position: "absolute", top: 40, left: 20, zIndex: 2 },
});
