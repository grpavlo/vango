import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Ionicons } from "@expo/vector-icons";

import AppText from "../components/AppText";
import AppInput from "../components/AppInput";
import AppButton from "../components/AppButton";
import DateInput from "../components/DateInput";
import TimeInput from "../components/TimeInput";
import AddressSearchInput from "../components/AddressSearchInput";
import { colors } from "../components/Colors";
import { GOOGLE_PLACES_API_KEY } from "../config";
import PhotoPicker from "../components/PhotoPicker";
import OptionSwitch from "../components/OptionSwitch";
import CheckBox from "../components/CheckBox";
import { apiFetch } from "../api";
import { useAuth } from "../AuthContext";
import { useToast } from "../components/Toast";
import { formatPointAddress } from "../addressFormat";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const FREE_DATE_TTL_DAYS = 7;
const INTRA_CITY_HINT_TEXT =
  "Створіть замовлення та вибирайте найвигідніше серед пропозицій від водіїв";
const FREE_DATE_TITLE = "\u0412\u0456\u043b\u044c\u043d\u0430 \u0434\u0430\u0442\u0430";
const FREE_DATE_INFO_TEXT =
  "\u042f\u043a\u0449\u043e \u0434\u0430\u0442\u0430 \u0440\u043e\u0437\u0432\u0430\u043d\u0442\u0430\u0436\u0435\u043d\u043d\u044f \u0432\u0456\u043b\u044c\u043d\u0430, \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u0431\u0443\u0434\u0435 \u0430\u043a\u0442\u0443\u0430\u043b\u044c\u043d\u0438\u043c 7 \u0434\u043d\u0456\u0432 \u0456 \u043f\u043e\u043a\u0430\u0437\u0443\u0432\u0430\u0442\u0438\u043c\u0435\u0442\u044c\u0441\u044f \u0432\u043e\u0434\u0456\u044f\u043c \u0443 \u0432\u0438\u0431\u0440\u0430\u043d\u043e\u043c\u0443 \u043c\u0456\u0441\u0442\u0456 \u0437\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0435\u043d\u043d\u044f.";
const FREE_DATE_INLINE_TEXT =
  "\u041f\u043e\u043b\u044f \u0437\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0435\u043d\u043d\u044f \u0442\u0430 \u0440\u043e\u0437\u0432\u0430\u043d\u0442\u0430\u0436\u0435\u043d\u043d\u044f \u043c\u043e\u0436\u043d\u0430 \u043d\u0435 \u0437\u0430\u043f\u043e\u0432\u043d\u044e\u0432\u0430\u0442\u0438.\n\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u0431\u0443\u0434\u0435 \u0430\u043a\u0442\u0438\u0432\u043d\u0438\u043c 7 \u0434\u043d\u0456\u0432.";

function normalizeCityName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function parseLocaleNumber(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

function normalizeNumericForApi(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.replace(/\s+/g, "").replace(",", ".");
}

function isIntraCityRoute(pickupCity, dropoffCity) {
  const pickup = normalizeCityName(pickupCity);
  const dropoff = normalizeCityName(dropoffCity);
  return Boolean(pickup && dropoff && pickup === dropoff);
}

function buildDefaultSchedule() {
  const now = new Date();
  const loadFrom = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    9,
    0,
    0
  );
  const loadTo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    18,
    0,
    0
  );

  return {
    loadFrom,
    loadTo,
    unloadFrom: new Date(loadFrom.getTime() + DAY_IN_MS),
    unloadTo: new Date(loadTo.getTime() + DAY_IN_MS),
  };
}

function buildFlexibleSchedule(baseDate = new Date()) {
  const loadFrom = new Date(baseDate);
  const loadTo = new Date(loadFrom.getTime() + 60 * 60 * 1000);
  const freeDateUntil = new Date(
    loadFrom.getTime() + FREE_DATE_TTL_DAYS * DAY_IN_MS
  );
  const unloadFrom = new Date(freeDateUntil);
  const unloadTo = new Date(freeDateUntil.getTime() + 60 * 60 * 1000);

  return { loadFrom, loadTo, unloadFrom, unloadTo, freeDateUntil };
}

export default function CreateOrderScreen({ navigation }) {
  const { token } = useAuth();
  const toast = useToast();

  const [pickupQuery, setPickupQuery] = useState("");
  const [pickup, setPickup] = useState(null);
  const [dropoffQuery, setDropoffQuery] = useState("");
  const [dropoff, setDropoff] = useState(null);
  const [cargoLength, setCargoLength] = useState("");
  const [cargoWidth, setCargoWidth] = useState("");
  const [cargoHeight, setCargoHeight] = useState("");
  const [cargoWeight, setCargoWeight] = useState("");
  const [cargoVolume, setCargoVolume] = useState("0");
  const [distance, setDistance] = useState(null);
  const [loadHelp, setLoadHelp] = useState(false);
  const [unloadHelp, setUnloadHelp] = useState(false);
  const [freeDate, setFreeDate] = useState(false);
  const [payment, setPayment] = useState("cash");
  const [loadFrom, setLoadFrom] = useState(
    () => buildDefaultSchedule().loadFrom
  );
  const [loadTo, setLoadTo] = useState(() => buildDefaultSchedule().loadTo);
  const [unloadFrom, setUnloadFrom] = useState(
    () => buildDefaultSchedule().unloadFrom
  );
  const [unloadTo, setUnloadTo] = useState(
    () => buildDefaultSchedule().unloadTo
  );
  const [photos, setPhotos] = useState([]);
  const [description, setDescription] = useState("");
  const [systemPrice, setSystemPrice] = useState(null);
  const [adjust] = useState(0);
  const [agreedPrice, setAgreedPrice] = useState(false);
  const isIntraCityOrder = isIntraCityRoute(pickup?.city, dropoff?.city);

  useEffect(() => {
    async function calcDistance() {
      if (!pickup || !dropoff) {
        setDistance(null);
        return;
      }

      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${pickup.lon},${pickup.lat};${dropoff.lon},${dropoff.lat}?overview=false`
        );
        const data = await res.json();
        if (data.routes && data.routes[0]) {
          setDistance(Math.round(data.routes[0].distance / 1000));
        }
      } catch (err) {
        console.log(err);
      }
    }

    calcDistance();
  }, [pickup, dropoff]);

  useEffect(() => {
    const l = parseLocaleNumber(cargoLength);
    const w = parseLocaleNumber(cargoWidth);
    const h = parseLocaleNumber(cargoHeight);
    const volume = l * w * h;
    setCargoVolume(volume > 0 ? volume.toFixed(2) : "0");
  }, [cargoLength, cargoWidth, cargoHeight]);

  function resetForm() {
    const defaults = buildDefaultSchedule();
    setPickupQuery("");
    setPickup(null);
    setDropoffQuery("");
    setDropoff(null);
    setLoadFrom(defaults.loadFrom);
    setLoadTo(defaults.loadTo);
    setUnloadFrom(defaults.unloadFrom);
    setUnloadTo(defaults.unloadTo);
    setLoadHelp(false);
    setUnloadHelp(false);
    setFreeDate(false);
    setPayment("cash");
    setDescription("");
    setPhotos([]);
    setSystemPrice(null);
    setAgreedPrice(false);
    setCargoLength("");
    setCargoWidth("");
    setCargoHeight("");
    setCargoWeight("");
    setCargoVolume("0");
    setDistance(null);
  }

  function handleFreeDateChange(value) {
    setFreeDate(value);
    if (value) {
      Alert.alert(FREE_DATE_TITLE, FREE_DATE_INFO_TEXT);
    }
  }

  function showFreeDateInfo() {
    Alert.alert(FREE_DATE_TITLE, FREE_DATE_INFO_TEXT);
  }

  async function create() {
    try {
      const schedule = freeDate
        ? buildFlexibleSchedule()
        : { loadFrom, loadTo, unloadFrom, unloadTo, freeDateUntil: null };

      const fd = new FormData();

      if (pickup) {
        fd.append("pickupLocation", pickup.text);
        fd.append("pickupLat", pickup.lat);
        fd.append("pickupLon", pickup.lon);
        if (pickup.city) fd.append("pickupCity", pickup.city);
        if (pickup.address) fd.append("pickupAddress", pickup.address);
        if (pickup.country) fd.append("pickupCountry", pickup.country);
        if (pickup.postcode) fd.append("pickupPostcode", pickup.postcode);
      }

      if (dropoff) {
        fd.append("dropoffLocation", dropoff.text);
        fd.append("dropoffLat", dropoff.lat);
        fd.append("dropoffLon", dropoff.lon);
        if (dropoff.city) fd.append("dropoffCity", dropoff.city);
        if (dropoff.address) fd.append("dropoffAddress", dropoff.address);
        if (dropoff.country) fd.append("dropoffCountry", dropoff.country);
        if (dropoff.postcode) fd.append("dropoffPostcode", dropoff.postcode);
      }

      if (pickup?.city) {
        fd.append("city", pickup.city);
      }

      fd.append("cargoType", description);
      if (cargoLength)
        fd.append("cargoLength", normalizeNumericForApi(cargoLength));
      if (cargoWidth)
        fd.append("cargoWidth", normalizeNumericForApi(cargoWidth));
      if (cargoHeight)
        fd.append("cargoHeight", normalizeNumericForApi(cargoHeight));
      if (cargoWeight)
        fd.append("cargoWeight", normalizeNumericForApi(cargoWeight));
      if (parseLocaleNumber(cargoVolume) > 0)
        fd.append("cargoVolume", normalizeNumericForApi(cargoVolume));
      if (distance !== null) fd.append("distance", String(distance));

      fd.append("loadFrom", schedule.loadFrom.toISOString());
      fd.append("loadTo", schedule.loadTo.toISOString());
      fd.append("unloadFrom", schedule.unloadFrom.toISOString());
      fd.append("unloadTo", schedule.unloadTo.toISOString());
      fd.append("freeDate", freeDate ? "true" : "false");
      if (schedule.freeDateUntil) {
        fd.append("freeDateUntil", schedule.freeDateUntil.toISOString());
      }

      fd.append("insurance", "false");
      fd.append("loadHelp", loadHelp ? "true" : "false");
      fd.append("unloadHelp", unloadHelp ? "true" : "false");
      fd.append("payment", payment);
      if (!isIntraCityOrder) {
        const finalPrice = agreedPrice
          ? 0
          : Math.round((systemPrice || 0) * (1 + adjust / 100));
        fd.append("price", String(finalPrice));
        fd.append("agreedPrice", agreedPrice ? "true" : "false");
      } else {
        fd.append("agreedPrice", "false");
      }

      if (photos.length > 0) {
        photos.forEach((uri) => {
          const filename = uri.split("/").pop();
          const match = /\.([a-zA-Z0-9]+)$/.exec(filename || "");
          const type = match ? `image/${match[1]}` : "image";
          fd.append("photos", { uri, name: filename, type });
        });
      }

      await apiFetch("/orders", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      resetForm();
      navigation.navigate("MyOrders");
    } catch (err) {
      console.log(err);
    }
  }

  async function confirmCreate() {
    if (!pickup || !dropoff) {
      toast.show("Вкажіть адреси завантаження та розвантаження");
      return;
    }
    if (!photos || photos.length === 0) {
      toast.show("Додайте хоча б одне фото вантажу");
      return;
    }
    if (photos.length > 10) {
      toast.show("Максимальна кількість фото - 10");
      return;
    }
    if (!description.trim()) {
      toast.show("Вкажіть опис вантажу");
      return;
    }
    if (!isIntraCityOrder && !agreedPrice && parseLocaleNumber(systemPrice) <= 0) {
      toast.show("Потрібно вказати ціну");
      return;
    }

    if (!freeDate) {
      if (loadFrom < new Date()) {
        toast.show("Дата завантаження не може бути в минулому");
        return;
      }
      if (loadTo <= loadFrom) {
        toast.show(
          "Кінцева дата завантаження повинна бути пізніше початкової"
        );
        return;
      }
      if (unloadFrom <= loadTo) {
        toast.show(
          "Дата початку розвантаження повинна бути після закінчення завантаження"
        );
        return;
      }
      if (unloadTo <= unloadFrom) {
        toast.show(
          "Кінцева дата розвантаження повинна бути пізніше початкової"
        );
        return;
      }
    }

    Alert.alert("Підтвердження", "Ви впевнені, що хочете розмістити вантаж?", [
      { text: "Скасувати" },
      { text: "OK", onPress: create },
    ]);
  }

  return (
    <KeyboardAwareScrollView
      keyboardShouldPersistTaps="handled"
      extraScrollHeight={80}
      enableOnAndroid
      showsVerticalScrollIndicator={false}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          <View style={styles.section}>
            <Ionicons name="location" size={20} color={colors.green} />
            <AppText style={styles.label}>Звідки</AppText>
          </View>
          <AddressSearchInput
            placeholder="Адреса завантаження"
            value={pickupQuery}
            onChangeText={(text) => {
              setPickupQuery(text);
              if (!text) setPickup(null);
            }}
            onSelect={(point) => {
              setPickup(point);
              setPickupQuery(formatPointAddress(point));
            }}
            navigation={navigation}
            lat={pickup?.lat}
            lon={pickup?.lon}
            provider="google"
            googleApiKey={GOOGLE_PLACES_API_KEY}
            suggestionStyles={{
              box: styles.suggestionsBoxWrapper,
              item: styles.suggestionItem,
              main: styles.suggestionMain,
              sub: styles.suggestionSub,
            }}
          />

          <View style={styles.section}>
            <Ionicons name="location" size={20} color={colors.orange} />
            <AppText style={styles.label}>Куди</AppText>
          </View>
          <AddressSearchInput
            placeholder="Адреса доставки"
            value={dropoffQuery}
            onChangeText={(text) => {
              setDropoffQuery(text);
              if (!text) setDropoff(null);
            }}
            onSelect={(point) => {
              setDropoff(point);
              setDropoffQuery(formatPointAddress(point));
            }}
            navigation={navigation}
            lat={dropoff?.lat}
            lon={dropoff?.lon}
            provider="google"
            googleApiKey={GOOGLE_PLACES_API_KEY}
            suggestionStyles={{
              box: styles.suggestionsBoxWrapper,
              item: styles.suggestionItem,
              main: styles.suggestionMain,
              sub: styles.suggestionSub,
            }}
          />

          <View style={styles.freeDateBox}>
            <View style={styles.freeDateHeader}>
              <CheckBox
                value={freeDate}
                onChange={handleFreeDateChange}
                label="Вільна дата"
              />
              <TouchableOpacity
                style={styles.freeDateInfoButton}
                onPress={showFreeDateInfo}
                accessibilityRole="button"
                accessibilityLabel="Інформація про вільну дату"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="information-circle-outline" size={22} color={colors.green} />
              </TouchableOpacity>
            </View>
            {freeDate && (
              <AppText style={styles.freeDateHint}>
                {FREE_DATE_INLINE_TEXT}
              </AppText>
            )}
          </View>

          {!freeDate && (
            <>
              <View style={styles.section}>
                <Ionicons
                  name="arrow-down-circle"
                  size={20}
                  color={colors.green}
                />
                <AppText style={styles.label}>Завантаження</AppText>
              </View>
              <DateInput
                value={loadFrom}
                onChange={(date) => {
                  const from = new Date(loadFrom);
                  from.setFullYear(
                    date.getFullYear(),
                    date.getMonth(),
                    date.getDate()
                  );
                  const to = new Date(loadTo);
                  to.setFullYear(
                    date.getFullYear(),
                    date.getMonth(),
                    date.getDate()
                  );
                  setLoadFrom(from);
                  setLoadTo(to);
                }}
                style={{ marginTop: 0, marginBottom: 12 }}
                placeholder="DD.MM.YYYY"
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TimeInput
                  value={loadFrom}
                  onChange={setLoadFrom}
                  style={{ flex: 1 }}
                  placeholder="09:00"
                />
                <TimeInput
                  value={loadTo}
                  onChange={setLoadTo}
                  style={{ flex: 1 }}
                  placeholder="18:00"
                />
              </View>

              <View style={styles.section}>
                <Ionicons
                  name="arrow-up-circle"
                  size={20}
                  color={colors.orange}
                />
                <AppText style={styles.label}>Розвантаження</AppText>
              </View>
              <DateInput
                value={unloadFrom}
                onChange={(date) => {
                  const from = new Date(unloadFrom);
                  from.setFullYear(
                    date.getFullYear(),
                    date.getMonth(),
                    date.getDate()
                  );
                  const to = new Date(unloadTo);
                  to.setFullYear(
                    date.getFullYear(),
                    date.getMonth(),
                    date.getDate()
                  );
                  setUnloadFrom(from);
                  setUnloadTo(to);
                }}
                style={{ marginTop: 0, marginBottom: 12 }}
                placeholder="DD.MM.YYYY"
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TimeInput
                  value={unloadFrom}
                  onChange={setUnloadFrom}
                  style={{ flex: 1 }}
                  placeholder="09:00"
                />
                <TimeInput
                  value={unloadTo}
                  onChange={setUnloadTo}
                  style={{ flex: 1 }}
                  placeholder="18:00"
                />
              </View>
            </>
          )}

          <View style={styles.section}>
            <Ionicons name="cube" size={20} color={colors.green} />
            <AppText style={styles.label}>Габарити (Д x Ш x В, метри)</AppText>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <AppInput
              style={styles.dim}
              value={cargoLength}
              onChangeText={setCargoLength}
              keyboardType="numeric"
              placeholder="Д"
            />
            <AppInput
              style={styles.dim}
              value={cargoWidth}
              onChangeText={setCargoWidth}
              keyboardType="numeric"
              placeholder="Ш"
            />
            <AppInput
              style={styles.dim}
              value={cargoHeight}
              onChangeText={setCargoHeight}
              keyboardType="numeric"
              placeholder="В"
            />
          </View>
          {parseLocaleNumber(cargoVolume) > 0 && (
            <AppText style={{ marginTop: 4, color: "#6B7280" }}>
              Об'єм: {cargoVolume} м3
            </AppText>
          )}

          <AppText style={styles.labelStandalone}>Вага, кг</AppText>
          <AppInput
            value={cargoWeight}
            onChangeText={setCargoWeight}
            keyboardType="numeric"
            placeholder="Вага вантажу"
          />

          {distance !== null && (
            <AppText style={{ marginTop: 8, color: "#6B7280" }}>
              ~{distance} км по дорозі
            </AppText>
          )}

          <View>
            <AppText style={styles.labelStandalone}>Додаткові послуги</AppText>
            <View style={styles.serviceRow}>
              <CheckBox
                value={loadHelp}
                onChange={setLoadHelp}
                label="Завантаження"
              />
              <CheckBox
                value={unloadHelp}
                onChange={setUnloadHelp}
                label="Розвантаження"
              />
            </View>
          </View>

          <AppText style={styles.labelStandalone}>Оплата</AppText>
          <OptionSwitch
            options={[
              { label: "Готівка", value: "cash" },
              { label: "Карта", value: "card" },
            ]}
            value={payment}
            onChange={setPayment}
          />

          <AppText style={styles.labelStandalone}>Опис вантажу</AppText>
          <AppInput
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            style={{ height: 100, textAlignVertical: "top" }}
          />

          <PhotoPicker photos={photos} onChange={setPhotos} />
          <View style={{ marginTop: 16 }}>
            {isIntraCityOrder ? (
              <View style={styles.intraCityHintBox}>
                <AppText style={styles.intraCityHintText}>
                  {INTRA_CITY_HINT_TEXT}
                </AppText>
              </View>
            ) : (
              <>
                <AppText style={styles.labelStandalone}>Ціна</AppText>
                <View style={styles.priceRow}>
                  <AppInput
                    style={[
                      { marginRight: 8, flex: 1 },
                      agreedPrice && styles.disabledPriceInput,
                    ]}
                    value={agreedPrice ? "" : systemPrice ? String(systemPrice) : ""}
                    onChangeText={setSystemPrice}
                    keyboardType="number-pad"
                    editable={!agreedPrice}
                  />
                  <CheckBox
                    value={agreedPrice}
                    onChange={setAgreedPrice}
                    label="Договірна"
                  />
                </View>
              </>
            )}
          </View>

          <View style={styles.actions}>
            <AppButton
              title="Створити"
              onPress={confirmCreate}
              style={{ flex: 1, height: 56, borderRadius: 16 }}
              textStyle={{ fontSize: 18, fontWeight: "600" }}
            />
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  dim: { flex: 1, textAlign: "center" },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fff",
  },
  suggestionSub: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  suggestionMain: { fontSize: 16 },
  section: { flexDirection: "row", alignItems: "center", marginTop: 24 },
  label: { marginLeft: 8, color: colors.text, fontWeight: "600" },
  labelStandalone: { marginTop: 24, color: colors.text, fontWeight: "600" },
  freeDateBox: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
  },
  freeDateHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  freeDateInfoButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  freeDateHint: {
    marginTop: 8,
    color: "#166534",
    lineHeight: 20,
  },
  suggestionsBoxWrapper: {
    backgroundColor: "#fff",
    borderRadius: 8,
    maxHeight: 200,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    marginLeft: 24,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  disabledPriceInput: {
    backgroundColor: "#F3F4F6",
    color: "#9CA3AF",
  },
  intraCityHintBox: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  intraCityHintText: {
    color: "#1E3A8A",
    lineHeight: 20,
    fontWeight: "500",
  },
  actions: { flexDirection: "row", marginTop: 32 },
});
