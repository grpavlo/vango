import React, { useEffect, useState, useRef, useLayoutEffect } from "react";
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
import { markOrderUpdatesSeen, reconcileOrderUpdates } from "../orderUpdates";
import { openLocationInMaps } from "../maps";
import DriverCompletionCelebration, {
  getOrderCompletionEarnings,
} from "../components/DriverCompletionCelebration";
import NotificationBell from "../components/NotificationBell";

const statusLabels = {
  CREATED: "Створено",
  ACCEPTED: "Водій в дорозі",
  IN_PROGRESS: "Водій отримав вантаж",
  DELIVERED: "Замовлення доставлено",
  COMPLETED: "Виконано",
  PENDING: "Очікує підтвердження",
  PENDING_CONFIRM: "Очікує підтвердження",
  DISCUSSING: "Ведеться обговорення",
  CANCELLED: "Скасовано",
  REJECTED: "Відмовлено",
};

const CUSTOMER_IN_PROGRESS_HISTORY_DELAY_MS = 3 * 24 * 60 * 60 * 1000;
const MOVE_TO_HISTORY_TITLE =
  "\u041f\u0435\u0440\u0435\u043c\u0456\u0441\u0442\u0438 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u0432 \u0456\u0441\u0442\u043e\u0440\u0456\u044e";
const MOVE_TO_HISTORY_WAIT_TEXT =
  "\u041a\u043d\u043e\u043f\u043a\u0430 \u043f\u0435\u0440\u0435\u043c\u0456\u0449\u0435\u043d\u043d\u044f \u0432 \u0456\u0441\u0442\u043e\u0440\u0456\u044e \u0437'\u044f\u0432\u0438\u0442\u044c\u0441\u044f";

export default function MyOrdersScreen({ navigation, route }) {
  const { token, role } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const wsRef = useRef(null);
  const [filter, setFilter] = useState("active");
  const [editedFinal, setEditedFinal] = useState({}); // { [orderId]: "12345" }
  const [tabsViewportWidth, setTabsViewportWidth] = useState(0);
  const [tabsContentWidth, setTabsContentWidth] = useState(0);
  const [tabsScrollX, setTabsScrollX] = useState(0);
  const [unreadUpdatesByOrder, setUnreadUpdatesByOrder] = useState({});
  const [nowMs, setNowMs] = useState(Date.now());
  const [completionCelebration, setCompletionCelebration] = useState(null);
  const lastPresetFilterRequestRef = useRef(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <NotificationBell />,
    });
  }, [navigation]);

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
    const timer = setInterval(() => setNowMs(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

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

  useEffect(() => {
    let mounted = true;

    async function syncUnreadUpdates() {
      if (!role || !token) {
        if (mounted) setUnreadUpdatesByOrder({});
        return;
      }
      try {
        const { unreadByOrder } = await reconcileOrderUpdates(role, token, orders);
        if (mounted) setUnreadUpdatesByOrder(unreadByOrder || {});
      } catch (err) {
        console.log("sync unread updates error", err);
      }
    }

    syncUnreadUpdates();
    return () => {
      mounted = false;
    };
  }, [orders, role, token]);

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
      const photoUris = Array.isArray(options.photoUris)
        ? options.photoUris.filter(Boolean)
        : options.photoUri
        ? [options.photoUri]
        : [];
      if (photoUris.length > 0) {
        const fd = new FormData();
        fd.append("status", status);
        photoUris.forEach((uri, index) => {
          const filenameFromUri = uri.split("/").pop() || `photo-${Date.now()}-${index + 1}.jpg`;
          const extMatch = /\.(\w+)$/.exec(filenameFromUri);
          const normalizedName = extMatch ? filenameFromUri : `${filenameFromUri}.jpg`;
          const ext = (extMatch ? extMatch[1] : "jpg").toLowerCase();
          const mime =
            ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext || "jpeg"}`;
          const fieldName = photoUris.length === 1 ? "statusPhoto" : "statusPhotos";
          fd.append(fieldName, { uri, name: normalizedName, type: mime });
        });
        body = fd;
      } else {
        body = JSON.stringify({ status });
      }
      const updated = await apiFetch(`/orders/${id}/status`, {
        method: "PATCH",
        headers,
        body,
      });
      load();
      return updated;
    } catch (err) {
      console.log(err);
      Alert.alert("Помилка", err?.message || "Не вдалося оновити статус");
      return null;
    }
  }

  function askPhotoPrompt(message) {
    return new Promise((resolve) => {
      Alert.alert("Фото вантажу", message, [
        { text: "Пропустити", style: "cancel", onPress: () => resolve(false) },
        { text: "Зробити фото", onPress: () => resolve(true) },
      ]);
    });
  }

  async function captureStatusPhotos() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Доступ до камери", "Надайте доступ до камери, щоб додати фото.");
        return [];
      }
      const collected = [];
      let keepCapturing = true;
      while (keepCapturing) {
        const result = await ImagePicker.launchCameraAsync({
          quality: 0.5,
        });
        if (result.canceled) break;
        const uri = result.assets?.[0]?.uri;
        if (!uri) break;
        collected.push(uri);
        keepCapturing = await askAddMorePhotoPrompt();
      }
      return collected;
    } catch (err) {
      console.log(err);
      Alert.alert("Помилка", "Не вдалося зробити фото.");
      return [];
    }
  }

  function askAddMorePhotoPrompt() {
    return new Promise((resolve) => {
      Alert.alert("Додати ще фото?", "Зробити додаткові фото вантажу", [
        { text: "Ні", style: "cancel", onPress: () => resolve(false) },
        { text: "Так", onPress: () => resolve(true) },
      ]);
    });
  }

  async function changeStatusWithOptionalPhoto(id, status, promptMessage) {
    const wantsPhoto = await askPhotoPrompt(promptMessage);
    if (wantsPhoto) {
      const photoUris = await captureStatusPhotos();
      if (photoUris.length > 0) {
        return updateStatus(id, status, { photoUris });
      }
    }
    return updateStatus(id, status);
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

  function showCompletionCelebration(orderLike) {
    setCompletionCelebration({
      id: orderLike?.id ?? Date.now(),
      earnings: getOrderCompletionEarnings(orderLike),
    });
  }

  async function markDelivered(orderOrId) {
    const id = typeof orderOrId === "object" ? orderOrId?.id : orderOrId;
    if (await confirmAction("Підтвердити передачу вантажу?")) {
      const updated = await changeStatusWithOptionalPhoto(
        id,
        "DELIVERED",
        "Бажаєте додати фото виданого вантажу?"
      );
      if (updated) {
        showCompletionCelebration(updated || orderOrId);
      }
    }
  }

  async function confirmDelivery(id) {
    if (await confirmAction("Підтвердити виконання замовлення?")) {
      await updateStatus(id, "COMPLETED");
    }
  }

  async function moveOrderToHistory(id) {
    if (await confirmAction("Перемістити замовлення в історію?")) {
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

  function openOrderDetail(item) {
    if (!item) return;
    const orderId = String(item.id);
    setUnreadUpdatesByOrder((prev) => ({
      ...prev,
      [orderId]: { status: false, photo: false },
    }));
    markOrderUpdatesSeen(role, token, item).catch((err) =>
      console.log("mark updates seen from list error", err)
    );
    navigation.navigate("OrderDetail", { order: item, token });
  }

  function renderItem({ item }) {
    const pickupCity =
      item.pickupCity ||
      ((item.pickupLocation || "").split(",")[1] || "").trim();
    const dropoffCity =
      item.dropoffCity ||
      ((item.dropoffLocation || "").split(",")[1] || "").trim();
    const pickupAddress =
      item.pickupAddress ||
      ((item.pickupLocation || "").split(",")[0] || "").trim();
    const dropoffAddress =
      item.dropoffAddress ||
      ((item.dropoffLocation || "").split(",")[0] || "").trim();
    const pickupQuery =
      item.pickupLocation ||
      [pickupAddress, pickupCity].filter(Boolean).join(", ");
    const dropoffQuery =
      item.dropoffLocation ||
      [dropoffAddress, dropoffCity].filter(Boolean).join(", ");
    const now = new Date(nowMs);
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
    const unreadUpdate = unreadUpdatesByOrder[String(item.id)] || {};
    const showStatusChangedBadge = filter === "active" && Boolean(unreadUpdate.status);
    const showNewPhotoBadge = filter === "active" && Boolean(unreadUpdate.photo);
    const canMoveToHistory = canCustomerMoveInProgressOrderToHistory(item, nowMs);
    const moveToHistoryWaitText = getMoveToHistoryWaitText(item, nowMs);
    const orderPriceText = formatOrderPriceValue(item);
    return (
      <TouchableOpacity
        onPress={() => openOrderDetail(item)}
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
                <Text style={styles.timeLabel}>Буде {candidateTime} хв</Text>
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
                openLocationInMaps({
                  address: pickupQuery || item.pickupAddress,
                  city: pickupCity,
                  lat: item.pickupLat,
                  lon: item.pickupLon,
                })
              }
            >
              <Ionicons name="navigate-outline" size={18} color={colors.orange} />
              <Text style={styles.mapChipText}>Відкрити завантаження</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mapChip}
              activeOpacity={0.8}
              onPress={() =>
                openLocationInMaps({
                  address: dropoffQuery || dropoffAddress,
                  city: dropoffCity,
                  lat: item.dropoffLat,
                  lon: item.dropoffLon,
                })
              }
            >
              <Ionicons name="navigate-outline" size={18} color={colors.green} />
              <Text style={styles.mapChipText}>Відкрити розвантаження</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.field}>
            <Text style={styles.fieldLabel}>Дата завантаження: </Text>
            {formatLoadDateLocal(item)}
          </Text>
          <Text style={styles.field}>
            <Text style={styles.fieldLabel}>Ціна:</Text>
            <Text style={styles.info}> {orderPriceText}</Text>
          </Text>
          <Text style={styles.statusRow}>
            <Text style={styles.fieldLabel}>Статус: </Text>
            <Text style={styles.statusValue}>
              {statusLabels[item.status] || item.status}
            </Text>
          </Text>
          {(showStatusChangedBadge || showNewPhotoBadge) && (
            <View style={styles.updateBadgesRow}>
              {showStatusChangedBadge && (
                <View style={styles.statusChangedBadge}>
                  <Ionicons name="sync-outline" size={14} color="#9A3412" />
                  <Text style={styles.statusChangedBadgeText}>Статус змінено</Text>
                </View>
              )}
              {showNewPhotoBadge && (
                <View style={styles.newPhotoBadge}>
                  <Ionicons name="image-outline" size={14} color="#075985" />
                  <Text style={styles.newPhotoBadgeText}>Додано нове фото</Text>
                </View>
              )}
            </View>
          )}
          {role === "CUSTOMER" && item.status === "CREATED" && item.responseCount > 0 && (
            <View style={styles.responseCountChip}>
              <Ionicons name="people-outline" size={16} color="#065F46" />
              <Text style={styles.responseCountText}>
                {item.responseCount} {item.responseCount === 1 ? 'водій зацікавлений' : 'водіїв зацікавлені'}
              </Text>
            </View>
          )}
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
                // Водій може редагувати фінальну ціну ТІЛЬКИ якщо agreedPrice === true
                item.agreedPrice ? (
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
                  // Показуємо фінальну ціну, але без можливості редагування
                  <Text style={styles.finalPriceValue}>
                    {item.finalPrice
                      ? `${Math.round(Number(item.finalPrice))} грн`
                      : item.price
                      ? `${Math.round(Number(item.price))} грн`
                      : "—"}
                  </Text>
                )
              ) : (
                <Text style={styles.finalPriceValue}>
                  {item.finalPrice
                    ? `${Math.round(Number(item.finalPrice))} грн`
                    : item.price
                    ? `${Math.round(Number(item.price))} грн`
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
              onPress={() => markDelivered(item)}
            />
          )}
          {role === "CUSTOMER" && item.status === "DELIVERED" && (
            <AppButton
              title="Підтвердити доставку"
              onPress={() => confirmDelivery(item.id)}
            />
          )}
          {canMoveToHistory && (
            <AppButton
              title={MOVE_TO_HISTORY_TITLE}
              onPress={() => moveOrderToHistory(item.id)}
              color="#6B7280"
            />
          )}
          {!canMoveToHistory && moveToHistoryWaitText && (
            <Text style={styles.moveToHistoryHint}>{moveToHistoryWaitText}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  const driverHasActiveResponse = (o) =>
    o.myResponseStatus &&
    ["RESPONDED", "CALL_MADE", "PENDING_CONFIRM", "DISCUSSING", "COUNTER_OFFERED"].includes(
      o.myResponseStatus
    );

  function parseOrderHistory(order) {
    if (Array.isArray(order?.history)) return order.history;
    if (typeof order?.history === "string") {
      try {
        const parsed = JSON.parse(order.history);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  function getStatusTimeMs(order, statuses) {
    const statusSet = new Set(Array.isArray(statuses) ? statuses : [statuses]);
    const history = parseOrderHistory(order);
    for (let i = history.length - 1; i >= 0; i -= 1) {
      const entry = history[i];
      if (!entry || !statusSet.has(entry.status) || !entry.at) continue;
      const ms = new Date(entry.at).getTime();
      if (Number.isFinite(ms) && ms > 0) return ms;
    }
    return 0;
  }

  function canCustomerMoveInProgressOrderToHistory(order, currentTimeMs = Date.now()) {
    if (role !== "CUSTOMER" || order?.status !== "IN_PROGRESS") return false;
    const inProgressAtMs =
      getStatusTimeMs(order, "IN_PROGRESS") ||
      new Date(order?.updatedAt || 0).getTime() ||
      0;
    if (!Number.isFinite(inProgressAtMs) || inProgressAtMs <= 0) return false;
    return currentTimeMs - inProgressAtMs >= CUSTOMER_IN_PROGRESS_HISTORY_DELAY_MS;
  }

  function getMoveToHistoryWaitText(order, currentTimeMs = Date.now()) {
    if (role !== "CUSTOMER" || order?.status !== "IN_PROGRESS") return "";
    const inProgressAtMs =
      getStatusTimeMs(order, "IN_PROGRESS") ||
      new Date(order?.updatedAt || 0).getTime() ||
      0;
    if (!Number.isFinite(inProgressAtMs) || inProgressAtMs <= 0) return "";
    const remainingMs = CUSTOMER_IN_PROGRESS_HISTORY_DELAY_MS - (currentTimeMs - inProgressAtMs);
    if (remainingMs <= 0) return "";
    const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
    if (remainingHours >= 24) {
      return `${MOVE_TO_HISTORY_WAIT_TEXT} через ${Math.ceil(remainingHours / 24)} дн.`;
    }
    return `${MOVE_TO_HISTORY_WAIT_TEXT} через ${remainingHours} год.`;
  }

  function getSortTimeMs(order, currentFilter) {
    if (currentFilter === "active") {
      const byAcceptedStatus = getStatusTimeMs(order, "ACCEPTED");
      if (byAcceptedStatus > 0) return byAcceptedStatus;
      const byCurrentStatus = getStatusTimeMs(order, order.status);
      if (byCurrentStatus > 0) return byCurrentStatus;
      return new Date(order.updatedAt || order.createdAt || 0).getTime() || 0;
    }
    if (currentFilter === "history") {
      const byFinishStatus = getStatusTimeMs(order, ["COMPLETED", "CANCELLED"]);
      if (byFinishStatus > 0) return byFinishStatus;
      return new Date(order.updatedAt || order.createdAt || 0).getTime() || 0;
    }
    return new Date(order.createdAt || order.updatedAt || 0).getTime() || 0;
  }

  const filtered = orders
    .filter((o) => {
      const reservedActive =
        o.reservedBy && o.reservedUntil && new Date(o.reservedUntil) > new Date();
      const hasActiveResponses = o.responseCount > 0;
      if (filter === "active") {
        if (role === "DRIVER") {
          return ["ACCEPTED", "IN_PROGRESS", "DELIVERED"].includes(o.status);
        }
        return (
          ["ACCEPTED", "IN_PROGRESS", "PENDING", "PENDING_CONFIRM", "DELIVERED"].includes(o.status) ||
          reservedActive ||
          (o.status === "CREATED" && hasActiveResponses)
        );
      }
      if (filter === "posted") {
        if (role === "DRIVER") {
          return (
            reservedActive ||
            driverHasActiveResponse(o) ||
            o.status === "PENDING" ||
            o.status === "PENDING_CONFIRM" ||
            o.status === "DISCUSSING" ||
            o.status === "COUNTER_OFFERED"
          );
        }
        return o.status === "CREATED" && !o.reservedBy && !hasActiveResponses;
      }
      return ["COMPLETED"].includes(o.status) || o.status === "CANCELLED";
    })
    .sort((a, b) => {
      const aTime = getSortTimeMs(a, filter);
      const bTime = getSortTimeMs(b, filter);
      if (aTime !== bTime) return bTime - aTime;

      const aId = Number(a.id);
      const bId = Number(b.id);
      const safeAId = Number.isFinite(aId) ? aId : 0;
      const safeBId = Number.isFinite(bId) ? bId : 0;
      return safeBId - safeAId;
    });

  const activeCount = orders.filter((o) => {
    const reservedActive =
      o.reservedBy && o.reservedUntil && new Date(o.reservedUntil) > new Date();
    const hasActiveResponses = o.responseCount > 0;
    if (role === "DRIVER") {
      return ["ACCEPTED", "IN_PROGRESS", "DELIVERED"].includes(o.status);
    }
    return (
      ["ACCEPTED", "IN_PROGRESS", "PENDING", "PENDING_CONFIRM", "DELIVERED"].includes(o.status) ||
      reservedActive ||
      (o.status === "CREATED" && hasActiveResponses)
    );
  }).length;

  const postedCount = orders.filter((o) => {
    const reservedActive =
      o.reservedBy && o.reservedUntil && new Date(o.reservedUntil) > new Date();
    const hasActiveResponses = o.responseCount > 0;
    if (role === "DRIVER") {
      return (
        reservedActive ||
        driverHasActiveResponse(o) ||
        o.status === "PENDING" ||
        o.status === "PENDING_CONFIRM" ||
        o.status === "DISCUSSING" ||
        o.status === "COUNTER_OFFERED"
      );
    }
    return o.status === "CREATED" && !o.reservedBy && !hasActiveResponses;
  }).length;

  const showTabsScrollTrack = tabsContentWidth > tabsViewportWidth + 1;
  const tabsThumbWidth = showTabsScrollTrack
    ? Math.max((tabsViewportWidth / tabsContentWidth) * tabsViewportWidth, 44)
    : 0;
  const maxTabsThumbOffset = Math.max(tabsViewportWidth - tabsThumbWidth, 0);
  const maxTabsScrollOffset = Math.max(tabsContentWidth - tabsViewportWidth, 0);
  const clampedTabsScrollX = Math.min(Math.max(tabsScrollX, 0), maxTabsScrollOffset);
  const tabsThumbOffset =
    maxTabsScrollOffset > 0
      ? (clampedTabsScrollX / maxTabsScrollOffset) * maxTabsThumbOffset
      : 0;

  function renderFilterLabel(label, count, isActive) {
    return (
      <View style={styles.filterLabelRow}>
        <Text style={[styles.filterText, isActive && styles.activeFilterText]}>
          {label}
        </Text>
        {count > 0 && (
          <View style={[styles.filterBadge, isActive && styles.activeFilterBadge]}>
            <Text
              style={[
                styles.filterBadgeText,
                isActive && styles.activeFilterBadgeText,
              ]}
            >
              {count}
            </Text>
          </View>
        )}
      </View>
    );
  }

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
      <View style={styles.filtersWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filters}
        onLayout={(e) => setTabsViewportWidth(e.nativeEvent.layout.width)}
        onContentSizeChange={(width) => setTabsContentWidth(width)}
        onScroll={(e) => setTabsScrollX(e.nativeEvent.contentOffset.x)}
        scrollEventThrottle={16}
      >
        <Pressable
          style={[styles.filterBtn, filter === "active" && styles.activeFilter]}
          onPress={() => setFilter("active")}
        >
          {renderFilterLabel("В роботі", activeCount, filter === "active")}
        </Pressable>
        <Pressable
          style={[styles.filterBtn, filter === "posted" && styles.activeFilter]}
          onPress={() => setFilter("posted")}
        >
          {renderFilterLabel(
            role === "DRIVER" ? "На підтвердженні" : "Створено",
            role === "DRIVER" ? postedCount : 0,
            filter === "posted"
          )}
        </Pressable>
        <Pressable
          style={[
            styles.filterBtn,
            filter === "history" && styles.activeFilter,
          ]}
          onPress={() => setFilter("history")}
        >
          {renderFilterLabel("Історія", 0, filter === "history")}
        </Pressable>
      </ScrollView>
      {showTabsScrollTrack && (
        <View style={styles.tabsScrollTrack}>
          <View
            style={[
              styles.tabsScrollThumb,
              { width: tabsThumbWidth, transform: [{ translateX: tabsThumbOffset }] },
            ]}
          />
        </View>
      )}
      </View>
      <KeyboardAwareFlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(o) => o.id.toString()}
        onRefresh={refresh}
        refreshing={refreshing}
        contentContainerStyle={{ paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={120}
        enableOnAndroid
      />
      <DriverCompletionCelebration
        visible={Boolean(completionCelebration)}
        earnings={completionCelebration?.earnings}
        onClose={() => setCompletionCelebration(null)}
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
  info: { color: "#111827" },
  statusRow: { marginTop: 12, flexDirection: "row", alignItems: "center" },
  statusValue: { fontWeight: "600", color: colors.green },
  updateBadgesRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  statusChangedBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEDD5",
    borderColor: "#FDBA74",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusChangedBadgeText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#9A3412",
  },
  newPhotoBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0F2FE",
    borderColor: "#7DD3FC",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  newPhotoBadgeText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#075985",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  smallBtn: { flex: 1, marginHorizontal: 4 },
  filtersWrap: {
    marginTop: 12,
    marginBottom: 8,
  },
  filtersScroll: {
    marginBottom: 2,
  },
  filters: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  tabsScrollTrack: {
    height: 4,
    marginHorizontal: 12,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    overflow: "hidden",
  },
  tabsScrollThumb: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: "#9CA3AF",
  },
  filterBtn: {
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  activeFilter: { backgroundColor: colors.green },
  activeFilterText: { color: "#fff" },
  filterText: { fontSize: 16, fontWeight: "600", color: "#111827" },
  filterLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  filterBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: { color: "#B91C1C", fontSize: 12, fontWeight: "800" },
  activeFilterBadge: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderColor: "rgba(255,255,255,0.45)",
  },
  activeFilterBadgeText: { color: "#fff" },
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
  responseCountChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  responseCountText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: "600",
    color: "#065F46",
  },
  moveToHistoryHint: {
    marginTop: 10,
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },
});

function formatDateLocal(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}

function formatLoadDateLocal(order) {
  if (!order) return '';
  if (order.timingOption === 'ASAP') {
    return '\u042f\u043a\u043d\u0430\u0439\u0448\u0432\u0438\u0434\u0448\u0435';
  }
  if (order.timingOption === 'WITHIN_1_HOUR') {
    return '\u0414\u043e 1 \u0433\u043e\u0434';
  }
  if (order.freeDate) {
    const until = formatDateLocal(order.freeDateUntil);
    return until ? `Вільна до ${until}` : 'Вільна дата';
  }
  return formatDateLocal(order.loadFrom) || '-';
}
function shouldShowAgreedPriceOnly(order) {
  const price = Number(order?.price);
  return Boolean(order?.agreedPrice) && (!Number.isFinite(price) || price <= 0);
}

function shouldShowDriverProposedPrice(order) {
  return (
    Boolean(order?.isIntraCity) &&
    !["ACCEPTED", "IN_PROGRESS", "DELIVERED", "COMPLETED"].includes(order?.status)
  );
}

function formatOrderPriceValue(order) {
  const price = Number(order?.price);
  if (shouldShowDriverProposedPrice(order)) {
    return "\u043f\u0440\u043e\u043f\u043e\u043d\u0443\u0454\u0442\u044c\u0441\u044f \u0432\u043e\u0434\u0456\u0454\u043c";
  }
  if (shouldShowAgreedPriceOnly(order)) return "Договірна";
  if (!Number.isFinite(price)) return order?.agreedPrice ? "Договірна" : "—";
  return `${Math.round(price)} грн${order?.agreedPrice ? " (Договірна)" : ""}`;
}
