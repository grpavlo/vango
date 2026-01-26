import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import { colors } from "../components/Colors";
import { HOST_URL } from "../api";

export default function DriverProfileScreen({ navigation, route }) {
  const driver = route?.params?.driver || null;
  const phone = driver?.phone || route?.params?.phone || null;
  const profile = driver?.driverProfile || route?.params?.driverProfile || null;

  const name =
    driver?.name ||
    profile?.fullName ||
    route?.params?.name ||
    "Водій";

  const rating = driver?.rating || null;

  const driverPhotoUri = useMemo(
    () => toFullUrl(profile?.selfiePhoto),
    [profile?.selfiePhoto]
  );
  const carPhotoUri = useMemo(
    () =>
      toFullUrl(
        profile?.carPhotoFrontRight ||
          profile?.carPhotoRearLeft ||
          profile?.carPhotoInterior
      ),
    [
      profile?.carPhotoFrontRight,
      profile?.carPhotoRearLeft,
      profile?.carPhotoInterior,
    ]
  );

  function handleCall() {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  }

  function handleGoBack() {
    if (typeof navigation?.goBack === "function") {
      navigation.goBack();
    }
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleGoBack}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={colors.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Профіль водія</Text>
        <View style={styles.headerPlaceholder} />
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Водій</Text>
          <View style={styles.row}>
            {driverPhotoUri ? (
              <Image
                source={{ uri: driverPhotoUri }}
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Ionicons name="person" size={40} color="#fff" />
              </View>
            )}
            <View style={styles.infoBlock}>
              <Text style={styles.name}>{name}</Text>
              {rating && (
                <Text style={styles.secondaryText}>
                  Рейтинг: {Number(rating).toFixed(1)}
                </Text>
              )}
              {phone && (
                <TouchableOpacity
                  style={styles.phoneRow}
                  onPress={handleCall}
                  activeOpacity={0.7}
                >
                  <Ionicons name="call" size={20} color={colors.green} />
                  <Text style={styles.phoneText}>{phone}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Автомобіль</Text>
          {carPhotoUri ? (
            <Image
              source={{ uri: carPhotoUri }}
              style={styles.carPhoto}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.carPhoto, styles.photoPlaceholder]}>
              <Ionicons name="car-outline" size={42} color={colors.gray500} />
              <Text style={styles.placeholderText}>Фото недоступне</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Номер:</Text>
            <Text style={styles.detailValue}>
              {profile?.carPlate || "Не вказано"}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Машина:</Text>
            <Text style={styles.detailValue}>
              {buildCarName(profile) || "Не вказано"}
            </Text>
          </View>
        </View>
        {phone && (
          <TouchableOpacity
            style={styles.callButton}
            onPress={handleCall}
            activeOpacity={0.85}
          >
            <Ionicons name="call" size={20} color="#fff" />
            <Text style={styles.callButtonText}>Зателефонувати</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </Screen>
  );
}

function buildCarName(profile) {
  if (!profile) return null;
  const parts = [profile.carMake, profile.carModel, profile.carYear];
  const filtered = parts.filter(Boolean);
  return filtered.length ? filtered.join(" ") : null;
}

function toFullUrl(path) {
  if (!path) return null;
  if (/^https?:/.test(path)) {
    return path;
  }
  return `${HOST_URL}${path}`;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, paddingHorizontal: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    elevation: 2,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
    color: colors.gray900,
  },
  headerPlaceholder: { width: 40 },
  scrollContent: { paddingBottom: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.green,
    overflow: "hidden",
  },
  avatarFallback: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.green,
  },
  infoBlock: { marginLeft: 16, flex: 1 },
  name: { fontSize: 18, fontWeight: "600", color: colors.gray900 },
  secondaryText: { marginTop: 4, color: colors.gray600 },
  phoneRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  phoneText: { marginLeft: 6, fontSize: 16, color: colors.green, fontWeight: "600" },
  carPhoto: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: colors.gray100,
  },
  photoPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: { marginTop: 8, color: colors.gray500 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  detailLabel: { color: colors.gray600, fontWeight: "600" },
  detailValue: { color: colors.gray900, fontWeight: "600" },
  callButton: {
    marginTop: 8,
    backgroundColor: colors.green,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.green,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  callButtonText: { color: "#fff", fontSize: 16, fontWeight: "600", marginLeft: 8 },
});
