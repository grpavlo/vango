import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  SafeAreaView,
  ScrollView,
  Linking,
  Alert,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareFlatList } from "react-native-keyboard-aware-scroll-view";
import { colors } from "../components/Colors";
import AppButton from "../components/AppButton";
import AppInput from "../components/AppInput";
import { apiFetch, HOST_URL } from "../api";
import { useAuth } from "../AuthContext";
import OrderCardSkeleton from "../components/OrderCardSkeleton";

const statusLabels = {
  CREATED: "Створено",
  ACCEPTED: "Водій в дорозі",
  IN_PROGRESS: "Водій отримав вантаж",
  DELIVERED: "Замовлення доставлено",
  COMPLETED: "Виконано",
  PENDING: "Очікує підтвердження",
  CANCELLED: "Скасовано",
  REJECTED: "Відмовлено",
};

export default function MyOrdersScreen({ navigation, route }) {
  const { token, role } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const wsRef = useRef(null);
  const [filter, setFilter] = useState("active");
  const [editedFinal, setEditedFinal] = useState({}); // { [orderId]: "12345" }
  const lastPresetFilterRequestRef = useRef(null);

  async function load() {
    try {
      setLoading(true);
      const url = role ? `/orders/my?role=${role}` : "/orders/my";
      const data = await apiFetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders(data);
      setLoading(false);
    } catch (err) {
      console.log(err);
      setLoading(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener("focus", load);
    return unsubscribe;
  }, [role, navigation]);

  useEffect(() => {
    connectWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [token]);

  useEffect(() => {
    const presetFilter = route?.params?.presetFilter;
    const presetRequestId = route?.params?.presetFilterRequestId;
    if (!presetFilter) {
      return;
    }
    if (presetRequestId && lastPresetFilterRequestRef.current === presetRequestId) {
      return;
    }
    lastPresetFilterRequestRef.current = presetRequestId ?? `${presetFilter}-${Date.now()}`;
    setFilter(presetFilter);
    if (typeof navigation?.setParams === "function") {
      navigation.setParams({
        presetFilter: undefined,
        presetFilterRequestId: undefined,
      });
    }
  }, [route?.params?.presetFilter, route?.params?.presetFilterRequestId, navigation]);

  function connectWs() {
    if (!token) return;
    if (wsRef.current) wsRef.current.close();
    const url = `${HOST_URL.replace(/^http/, "ws")}/api/orders/stream`;
    const ws = new WebSocket(url, null, {
      headers: { Authorization: `Bearer ${token}` },
    });
    wsRef.current = ws;
    ws.onmessage = () => load();
    ws.onerror = (e) => console.log("ws error", e.message);
  }

  function openDriverProfile(driverData) {
    if (!driverData) return;
    const params = { driver: driverData };
    const level1 =
      typeof navigation?.getParent === "function"
        ? navigation.getParent()
        : null;
    const level2 =
      typeof level1?.getParent === "function" ? level1.getParent() : null;
    (level2 || level1 || navigation)?.navigate?.("DriverProfile", params);
  }
  async function cancelReserve(id) {
    try {
      await apiFetch(`/orders/${id}/cancel-reserve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      load();
    } catch (err) {
      console.log(err);
    }
  }

  async function confirmDriver(id) {
    try {
      await apiFetch(`/orders/${id}/confirm-driver`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      load();
    } catch (err) {
      console.log(err);
    }
  }

  async function rejectDriver(id) {
    try {
      await apiFetch(`/orders/${id}/reject-driver`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      load();
    } catch (err) {
      console.log(err);
    }
  }
  function confirmFinalPriceModal(order) {
    const fp = Number(order.finalPrice);
    const priceText = Number.isFinite(fp) ? `${Math.round(fp)} грн` : "—";
    return new Promise((resolve) => {
      Alert.alert("Підтвердити фінальну ціну?", `Фінальна ціна: ${priceText}`, [
        {
          text: "Відхилити",
          style: "destructive",
          onPress: () => resolve(false),
        },
        { text: "Скасувати", onPress: () => resolve(null) },
        { text: "Прийняти", onPress: () => resolve(true) },
      ]);
    });
  }

  async function handleConfirmOrReject(order) {
    const choice = await confirmFinalPriceModal(order);
    if (choice === true) {
      await confirmDriver(order.id);
    } else if (choice === false) {
      await rejectDriver(order.id);
    }
    // choice === null → нічого не робимо
  }

  function confirmAction(message) {
    return new Promise((resolve) => {
      Alert.alert("Підтвердження", message, [
        { text: "Скасувати", onPress: () => resolve(false) },
        { text: "OK", onPress: () => resolve(true) },
      ]);
    });
  }

  async function updateStatus(id, status, options = {}) {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      let body;
      if (options.photoUri) {
        const fd = new FormData();
        fd.append("status", status);
        const uri = options.photoUri;
        const filenameFromUri = uri.split("/").pop() || `photo-${Date.now()}.jpg`;
        const extMatch = /\.(\w+)$/.exec(filenameFromUri);
        const normalizedName = extMatch ? filenameFromUri : `${filenameFromUri}.jpg`;
        const ext = (extMatch ? extMatch[1] : "jpg").toLowerCase();
        const mime =
          ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext || "jpeg"}`;
        fd.append("statusPhoto", { uri, name: normalizedName, type: mime });
        body = fd;
      } else {
        body = JSON.stringify({ status });
      }
      await apiFetch(`/orders/${id}/status`, {
        method: "PATCH",
        headers,
        body,
      });
      load();
    } catch (err) {
      console.log(err);
    }
  }

  function openLocationInMaps(address, lat, lon) {
    const latNum = Number(lat);
    const lonNum = Number(lon);
    const hasCoords =
      lat !== undefined &&
      lat !== null &&
      lon !== undefined &&
      lon !== null &&
      `${lat}` !== "" &&
      `${lon}` !== "" &&
      Number.isFinite(latNum) &&
      Number.isFinite(lonNum);
    const query = address || (hasCoords ? `${latNum},${lonNum}` : "");
    if (!query) return;
    const encoded = encodeURIComponent(query);
    const coord = hasCoords ? `${latNum},${lonNum}` : null;
    const url = coord
      ? Platform.select({
          ios: `http://maps.apple.com/?ll=${coord}&q=${encoded}`,
          default: `geo:${coord}?q=${encoded}`,
        })
      : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    Linking.openURL(url).catch((err) => console.log("maps open error", err));
  }

  function askPhotoPrompt(message) {
    return new Promise((resolve) => {
      Alert.alert("Фото вантажу", message, [
        { text: "Пропустити", style: "cancel", onPress: () => resolve(false) },
        { text: "Зробити фото", onPress: () => resolve(true) },
      ]);
    });
  }

  async function captureStatusPhoto() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Доступ до камери", "Надайте доступ до камери, щоб додати фото.");
        return null;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.5,
      });
      if (result.canceled) return null;
      return result.assets?.[0]?.uri || null;
    } catch (err) {
      console.log(err);
      Alert.alert("Помилка", "Не вдалося зробити фото.");
      return null;
    }
  }

  async function changeStatusWithOptionalPhoto(id, status, promptMessage) {
    const wantsPhoto = await askPhotoPrompt(promptMessage);
    if (wantsPhoto) {
      const photoUri = await captureStatusPhoto();
      if (photoUri) {
        await updateStatus(id, status, { photoUri });
        return;
      }
    }
    await updateStatus(id, status);
  }

  async function markReceived(id) {
    if (await confirmAction("Підтвердити отримання вантажу?")) {
      await changeStatusWithOptionalPhoto(
        id,
        "IN_PROGRESS",
        "Бажаєте додати фото отриманого вантажу?"
      );
    }
  }

  async function markDelivered(id) {
    if (await confirmAction("Підтвердити передачу вантажу?")) {
      await changeStatusWithOptionalPhoto(
        id,
        "DELIVERED",
        "Бажаєте додати фото виданого вантажу?"
      );
    }
  }

  async function confirmDelivery(id) {
    if (await confirmAction("Підтвердити виконання замовлення?")) {
      await updateStatus(id, "COMPLETED");
    }
  }
  function editOrder(order) {
    navigation.navigate("EditOrder", { order });
  }

  function confirmDelete(id) {
    Alert.alert("Підтвердження", "Видалити вантаж?", [
      { text: "Скасувати" },
      { text: "OK", onPress: () => remove(id) },
    ]);
  }

  async function remove(id) {
    try {
      await apiFetch(`/orders/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      load();
    } catch (err) {
      console.log(err);
    }
  }

  //  async function cancelReserve() {
  //   try {
  //     await apiFetch(`/orders/${order.id}/cancel-reserve`, {
  //       method: "POST",
  //       headers: { Authorization: `Bearer ${token}` },
  //     });
  //     setReserved(false);
  //     setPhone(null);
  //     setCustomerName(null);
  //     setReservedUntil(null);
  //     setTimeLeft(null);
  //     try {
  //       const stored = await AsyncStorage.getItem("reservedPhones");
  //       const map = stored ? JSON.parse(stored) : {};
  //       if (map[order.id]) {
  //         delete map[order.id];
  //         await AsyncStorage.setItem("reservedPhones", JSON.stringify(map));
  //       }
  //     } catch {}
  //     navigation.goBack();
  //   } catch (err) {
  //     console.log(err);
  //   }
  // }

  function renderItem({ item }) {
    const pickupCity =
      item.pickupCity ||
      ((item.pickupLocation || "").split(",")[1] || "").trim();
    const dropoffCity =
      item.dropoffCity ||
      ((item.dropoffLocation || "").split(",")[1] || "").trim();
    const dropoffAddress =
      item.dropoffAddress ||
      ((item.dropoffLocation || "").split(",")[0] || "").trim();
    const pickupQuery = item.pickupLocation || pickupCity;
    const dropoffQuery =
      item.dropoffLocation ||
      [dropoffAddress, dropoffCity].filter(Boolean).join(", ");
    const now = new Date();
    const reserved =
      item.reservedBy &&
      item.reservedUntil &&
      new Date(item.reservedUntil) > now;
    const pending = item.status === "PENDING";
    const candidate =
      item.driver || item.reservedDriver || item.candidateDriver;
    const candidateTime =
      item.candidateUntil || item.reservedUntil
        ? Math.max(
            0,
            Math.ceil(
              (new Date(item.candidateUntil || item.reservedUntil) - now) /
                60000
            )
          )
        : 0;
    return (
      <TouchableOpacity
        onPress={() =>
          navigation.navigate("OrderDetail", { order: item, token })
        }
        activeOpacity={0.8}
      >
        <View style={styles.card}>
          {role === "CUSTOMER" && candidate && reserved && (
            <TouchableOpacity
              style={styles.candidateRow}
              activeOpacity={0.7}
              onPress={() =>
                candidate.phone && Linking.openURL(`tel:${candidate.phone}`)
              }
            >
              <View style={styles.candidateLeft}>
                <TouchableOpacity
                  onPress={() => openDriverProfile(candidate)}
                  activeOpacity={0.8}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {candidate.name.charAt(0)}
                    </Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>{candidate.name}</Text>
                  {candidate.rating && (
                    <Text style={styles.driverRating}>
                      Рейтинг: {candidate.rating.toFixed(1)}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.candidateRight}>
                <Ionicons name="call" size={20} color={colors.green} />
                <Text style={styles.timeLabel}>{candidateTime} хв</Text>
              </View>
            </TouchableOpacity>
          )}

          <View style={styles.idRow}>
            <Text style={styles.itemNumber}>№ {item.id}</Text>
            {role === "CUSTOMER" && item.status === "CREATED" && (
              <View style={styles.idActions}>
                <TouchableOpacity onPress={() => editOrder(item)}>
                  <Ionicons name="pencil" size={20} color={colors.green} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmDelete(item.id)}
                  style={{ marginLeft: 16 }}
                >
                  <Ionicons name="trash" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          <Text style={styles.field}>
            <Text style={styles.fieldLabel}>Місто завантаження: </Text>
            <Text style={{ fontWeight: "bold" }}>{pickupCity}</Text>
          </Text>
          <Text style={styles.field}>
            <Text style={styles.fieldLabel}>Місто розвантаження: </Text>
            <Text style={{ fontWeight: "bold" }}>{dropoffCity}</Text>
          </Text>
          <Text style={styles.field}>
            <Text style={styles.fieldLabel}>Адреса розвантаження: </Text>
            <Text style={{ fontWeight: "bold" }}>{dropoffCity}</Text>
            {dropoffAddress ? `, ${dropoffAddress}` : ""}
          </Text>
          <View style={styles.mapRow}>
            <TouchableOpacity
              style={styles.mapChip}
              activeOpacity={0.8}
              onPress={() =>
                openLocationInMaps(pickupQuery, item.pickupLat, item.pickupLon)
              }
            >
              <Ionicons name="navigate-outline" size={18} color={colors.orange} />
              <Text style={styles.mapChipText}>Відкрити завантаження</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mapChip}
              activeOpacity={0.8}
              onPress={() =>
                openLocationInMaps(
                  dropoffQuery,
                  item.dropoffLat,
                  item.dropoffLon
                )
              }
            >
              <Ionicons name="navigate-outline" size={18} color={colors.green} />
              <Text style={styles.mapChipText}>Відкрити розвантаження</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.field}>
            <Text style={styles.fieldLabel}>Дата створення: </Text>
            {formatDate(new Date(item.createdAt))}
          </Text>
          <Text style={styles.field}>
            <Text style={styles.fieldLabel}>Ціна:</Text>
            <Text style={styles.info}>
              {` ${Math.round(item.price)} грн${
                item.agreedPrice ? " (Договірна)" : ""
              }`}
            </Text>
          </Text>
          <Text style={styles.statusRow}>
            <Text style={styles.fieldLabel}>Статус: </Text>
            <Text style={styles.statusValue}>
              {statusLabels[item.status] || item.status}
            </Text>
          </Text>
          {
            // як у OrderDetailScreen: для Клієнта показуємо, коли замовлення створене і є резерв
            ((item.status === "CREATED" && item.reservedBy) ||
              // для Водія — коли резерв активний, немає driverId і це в роботі
              (role === "DRIVER" && reserved && !item.driverId)) && (
              <AppButton
                key="cancel"
                title="Відмінити резерв"
                onPress={() => cancelReserve(item.id)}
                variant="danger"
              />
            )
          }
          {/* Фінальна ціна: показувати і при RESERVED (CREATED+reserved), і при PENDING */}
          {(role === "CUSTOMER" || role === "DRIVER") && (reserved || item.status === "PENDING") && (
            <View style={styles.finalPriceRow}>
              <Text style={styles.finalPriceLabel}>Фінальна ціна:</Text>
              {role === "DRIVER" ? (
                <>
                  <AppInput
                    style={styles.finalPriceInput}
                    keyboardType="numeric"
                    value={
                      editedFinal[item.id] ??
                      (item.finalPrice ? String(Math.round(item.finalPrice)) : "")
                    }
                    onChangeText={(v) =>
                      setEditedFinal((prev) => ({
                        ...prev,
                        [item.id]: v.replace(/[^\d]/g, ""),
                      }))
                    }
                    placeholder="Вкажіть суму"
                  />

                  <TouchableOpacity
                    onPress={async () => {
                      const val = editedFinal[item.id];
                      if (!val) return;
                      await apiFetch(`/orders/${item.id}/final-price`, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}` },
                        body: JSON.stringify({
                          finalPrice: String(Math.round(Number(val))),
                        }),
                      });
                      load();
                    }}
                    accessibilityLabel="Зберегти фінальну ціну"
                  >
                    <Ionicons name="save" size={22} color={colors.green} />
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.finalPriceValue}>
                  {item.finalPrice
                    ? `${Math.round(Number(item.finalPrice))} грн`
                    : "—"}
                </Text>
              )}
            </View>
          )}

          {/* Кнопки підтвердження лише у PENDING */}
          {role === "CUSTOMER" && item.status === "PENDING" && (
            <View style={styles.actionRow}>
              <AppButton
                title="Прийняти"
                onPress={() => handleConfirmOrReject(item)}
                style={styles.smallBtn}
              />
              <AppButton
                title="Відхилити"
                color="#EF4444"
                onPress={() => rejectDriver(item.id)}
                style={styles.smallBtn}
              />
            </View>
          )}

          {role === "DRIVER" && item.status === "ACCEPTED" && (
            <AppButton
              title="Отримав вантаж"
              onPress={() => markReceived(item.id)}
            />
          )}
          {role === "DRIVER" && item.status === "IN_PROGRESS" && (
            <AppButton
              title="Віддав вантаж"
              onPress={() => markDelivered(item.id)}
            />
          )}
          {role === "CUSTOMER" && item.status === "DELIVERED" && (
            <AppButton
              title="Підтвердити доставку"
              onPress={() => confirmDelivery(item.id)}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  }

  const filtered = orders.filter((o) => {
    const reservedActive =
      o.reservedBy && o.reservedUntil && new Date(o.reservedUntil) > new Date();
    if (filter === "active") {
      if (role === "DRIVER") {
        return ["ACCEPTED", "IN_PROGRESS", "DELIVERED"].includes(o.status);
      }
      return (
        ["ACCEPTED", "IN_PROGRESS", "PENDING", "DELIVERED"].includes(
          o.status
        ) || reservedActive
      );
    }
    if (filter === "posted") {
      if (role === "DRIVER") {
        return reservedActive || o.status === "PENDING";
      }
      return o.status === "CREATED" && !o.reservedBy;
    }
    return ["COMPLETED"].includes(o.status) || o.status === "CANCELLED";
  });

  if (loading && orders.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        {[...Array(5)].map((_, i) => (
          <OrderCardSkeleton key={i} />
        ))}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        <Pressable
          style={[styles.filterBtn, filter === "active" && styles.activeFilter]}
          onPress={() => setFilter("active")}
        >
          <Text
            style={[
              styles.filterText,
              filter === "active" && styles.activeFilterText,
            ]}
          >
            В роботі
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterBtn, filter === "posted" && styles.activeFilter]}
          onPress={() => setFilter("posted")}
        >
          <Text
            style={[
              styles.filterText,
              filter === "posted" && styles.activeFilterText,
            ]}
          >
            {role === "DRIVER" ? "На підтвердженні" : "Створено"}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.filterBtn,
            filter === "history" && styles.activeFilter,
          ]}
          onPress={() => setFilter("history")}
        >
          <Text
            style={[
              styles.filterText,
              filter === "history" && styles.activeFilterText,
            ]}
          >
            Історія
          </Text>
        </Pressable>
      </ScrollView>
      <KeyboardAwareFlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(o) => o.id.toString()}
        onRefresh={refresh}
        refreshing={refreshing}
        contentContainerStyle={{ paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={5}
        enableOnAndroid
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 24,
    marginHorizontal: 12,
    marginVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  candidateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFF8F3",
    borderColor: "#FFF8F3",
    borderWidth: 1,
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  candidateLeft: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  driverInfo: { marginLeft: 8 },
  driverName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  driverRating: { fontSize: 14, color: "#6B7280" },
  candidateRight: { flexDirection: "row", alignItems: "center" },
  timeLabel: { marginLeft: 4, fontSize: 14, color: "#EA580C" },
  idRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  idActions: { flexDirection: "row" },
  itemNumber: { fontSize: 18, fontWeight: "600", color: "#111827" },
  field: { marginTop: 4, fontSize: 15, color: "#111827" },
  fieldLabel: { fontWeight: "600", color: "#374151" },
  statusRow: { marginTop: 12, flexDirection: "row", alignItems: "center" },
  statusValue: { fontWeight: "600", color: colors.green },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  smallBtn: { flex: 1, marginHorizontal: 4 },
  filters: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    marginVertical: 16,
  },
  filterBtn: {
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    justifyContent: "center",
    flexShrink: 0,
  },
  activeFilter: { backgroundColor: colors.green },
  activeFilterText: { color: "#fff" },
  filterText: { fontSize: 16, fontWeight: "600", color: "#111827" },
  finalPriceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F3FFF4",
    borderColor: "#22C55E",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  finalPriceLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#166534", // темно-зелений
  },
  finalPriceValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#16A34A", // зелений
  },
  finalPriceInput: {
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 16,
    fontWeight: "600",
    minWidth: 100,
    textAlign: "right",
  },
  mapRow: {
    flexDirection: "row",
    marginTop: 8,
    marginBottom: 4,
    justifyContent: "space-between",
    gap: 8,
  },
  mapChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#F9FAFB",
  },
  mapChipText: { marginLeft: 6, fontWeight: "600", color: "#111827" },
});

function formatDate(d) {
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}
