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
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

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
const ORDER_TYPE_LOCAL = "LOCAL";
const ORDER_TYPE_LONG_DISTANCE = "LONG_DISTANCE";
const TIMING_ASAP = "ASAP";
const TIMING_WITHIN_1_HOUR = "WITHIN_1_HOUR";
const TIMING_SCHEDULED = "SCHEDULED";
const LOCATION_STORAGE_KEYS = ["userLocation", "location"];
const INTRA_CITY_HINT_TEXT =
  "Створіть замовлення та вибирайте найвигідніше серед пропозицій від водіїв";
const LOCAL_ORDER_HINT_TEXT =
  "\u0412\u043e\u0434\u0456\u0457 \u0437\u0430\u043f\u0440\u043e\u043f\u043e\u043d\u0443\u044e\u0442\u044c \u0446\u0456\u043d\u0443 \u0442\u0430 \u0443\u043c\u043e\u0432\u0438";
const LOCAL_DISTANCE_HINT_TEXT =
  "\u041c\u0456\u0441\u0446\u0435\u0432\u0456 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u043d\u0430\u0439\u043a\u0440\u0430\u0449\u0435 \u043f\u0456\u0434\u0445\u043e\u0434\u044f\u0442\u044c \u0434\u043b\u044f \u043c\u0456\u0441\u0442\u0430 \u0442\u0430 \u043f\u0435\u0440\u0435\u0434\u043c\u0456\u0441\u0442\u044c";
const LOCAL_PRICE_HINT_TEXT =
  "\u0412\u043e\u0434\u0456\u0457 \u043d\u0430\u0434\u0456\u0448\u043b\u044e\u0442\u044c \u043f\u0440\u043e\u043f\u043e\u0437\u0438\u0446\u0456\u0457 \u0437 \u043f\u043e\u0433\u043e\u0434\u0438\u043d\u043d\u043e\u044e \u043e\u043f\u043b\u0430\u0442\u043e\u044e";
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

function normalizeLocationCoords(value) {
  if (!value) return null;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    const latitude = Number(parsed?.latitude);
    const longitude = Number(parsed?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}

async function getCachedLocationCoords() {
  for (const key of LOCATION_STORAGE_KEYS) {
    const stored = await AsyncStorage.getItem(key);
    const coords = normalizeLocationCoords(stored);
    if (coords) return coords;
  }
  return null;
}

async function storeLocationCoords(coords) {
  const value = JSON.stringify(coords);
  await Promise.all(
    LOCATION_STORAGE_KEYS.map((key) => AsyncStorage.setItem(key, value))
  );
}

function isIntraCityRoute(pickupCity, dropoffCity) {
  const pickup = normalizeCityName(pickupCity);
  const dropoff = normalizeCityName(dropoffCity);
  return Boolean(pickup && dropoff && pickup === dropoff);
}

function hasDifferentRouteCities(pickupCity, dropoffCity) {
  const pickup = normalizeCityName(pickupCity);
  const dropoff = normalizeCityName(dropoffCity);
  return Boolean(pickup && dropoff && pickup !== dropoff);
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

function buildQuickSchedule(timingOption = TIMING_ASAP) {
  const now = new Date();
  const loadFrom =
    timingOption === TIMING_WITHIN_1_HOUR
      ? new Date(now.getTime() + 60 * 60 * 1000)
      : now;
  const loadTo = new Date(loadFrom.getTime() + 60 * 60 * 1000);
  const unloadFrom = new Date(loadTo);
  const unloadTo = new Date(unloadFrom.getTime() + 60 * 60 * 1000);

  return { loadFrom, loadTo, unloadFrom, unloadTo, freeDateUntil: null };
}

export default function CreateOrderScreen({ navigation }) {
  const { token } = useAuth();
  const toast = useToast();

  const [selectedOrderType, setSelectedOrderType] = useState(null);
  const [localTiming, setLocalTiming] = useState(TIMING_ASAP);
  const [additionalInfoExpanded, setAdditionalInfoExpanded] = useState(false);
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
  const [currentLocation, setCurrentLocation] = useState(null);
  const isSameCityRoute = isIntraCityRoute(pickup?.city, dropoff?.city);
  const hasDifferentCities = hasDifferentRouteCities(
    pickup?.city,
    dropoff?.city
  );
  const isLocalSelected = selectedOrderType === ORDER_TYPE_LOCAL;
  const isLocalQuickOrder =
    isLocalSelected && localTiming !== TIMING_SCHEDULED;
  const isEffectiveLocalOrder = isLocalSelected || isSameCityRoute;

  useEffect(() => {
    let mounted = true;

    async function loadCurrentLocation() {
      try {
        const cached = await getCachedLocationCoords();
        if (cached && mounted) {
          setCurrentLocation(cached);
        }

        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") return;

        const loc = await Location.getCurrentPositionAsync({});
        const coords = normalizeLocationCoords({
          latitude: loc?.coords?.latitude,
          longitude: loc?.coords?.longitude,
        });
        if (!coords) return;

        await storeLocationCoords(coords);
        if (mounted) {
          setCurrentLocation(coords);
        }
      } catch {
        // The map screen will fall back to cached coords or the default region.
      }
    }

    loadCurrentLocation();
    return () => {
      mounted = false;
    };
  }, []);

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
    setSelectedOrderType(null);
    setLocalTiming(TIMING_ASAP);
    setAdditionalInfoExpanded(false);
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
      const shouldUseQuickSchedule = isLocalQuickOrder;
      const effectiveFreeDate = shouldUseQuickSchedule ? false : freeDate;
      const schedule = shouldUseQuickSchedule
        ? buildQuickSchedule(localTiming)
        : effectiveFreeDate
        ? buildFlexibleSchedule()
        : { loadFrom, loadTo, unloadFrom, unloadTo, freeDateUntil: null };

      const fd = new FormData();
      fd.append("requestedOrderType", selectedOrderType);
      if (isLocalSelected) {
        fd.append("timingOption", localTiming);
      }

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
      fd.append("freeDate", effectiveFreeDate ? "true" : "false");
      if (schedule.freeDateUntil) {
        fd.append("freeDateUntil", schedule.freeDateUntil.toISOString());
      }

      fd.append("insurance", "false");
      fd.append("loadHelp", loadHelp ? "true" : "false");
      fd.append("unloadHelp", unloadHelp ? "true" : "false");
      fd.append("payment", payment);
      if (!isEffectiveLocalOrder) {
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
    if (!selectedOrderType) {
      toast.show("\u041e\u0431\u0435\u0440\u0456\u0442\u044c \u0442\u0438\u043f \u043f\u0435\u0440\u0435\u0432\u0435\u0437\u0435\u043d\u043d\u044f");
      return;
    }
    if (isLocalSelected && !localTiming) {
      toast.show("\u041e\u0431\u0435\u0440\u0456\u0442\u044c \u0447\u0430\u0441 \u043f\u043e\u0434\u0430\u0447\u0456 \u0430\u0432\u0442\u043e");
      return;
    }
    if (!pickup || !dropoff) {
      toast.show("Вкажіть адреси завантаження та розвантаження");
      return;
    }
    if (isLocalSelected && hasDifferentCities) {
      Alert.alert(
        "Міське перевезення",
        "Зараз вибрано міське перевезення. Оберіть розвантаження в тому ж населеному пункті або передмісті, або змініть тип перевезення на далеке.",
        [{ text: "Зрозуміло" }]
      );
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
    if (!isEffectiveLocalOrder && !agreedPrice && parseLocaleNumber(systemPrice) <= 0) {
      toast.show("Потрібно вказати ціну");
      return;
    }

    if (!freeDate && !isLocalQuickOrder) {
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

  function chooseOrderType(type) {
    setSelectedOrderType(type);
    if (type === ORDER_TYPE_LOCAL) {
      setLocalTiming(TIMING_ASAP);
      setAdditionalInfoExpanded(false);
    }
  }

  function renderChoiceBullet(text) {
    return (
      <View style={styles.choiceBulletRow}>
        <AppText style={styles.choiceBulletMarker}>{"\u2022"}</AppText>
        <AppText style={styles.choiceCardText}>{text}</AppText>
      </View>
    );
  }

  function renderAdditionalFields() {
    return (
      <>
        <View style={styles.section}>
          <Ionicons name="cube" size={20} color={colors.green} />
          <AppText style={styles.label}>
            {"\u0413\u0430\u0431\u0430\u0440\u0438\u0442\u0438 (\u0414 x \u0428 x \u0412, \u043c\u0435\u0442\u0440\u0438)"}
          </AppText>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <AppInput
            style={styles.dim}
            value={cargoLength}
            onChangeText={setCargoLength}
            keyboardType="numeric"
            placeholder={"\u0414"}
          />
          <AppInput
            style={styles.dim}
            value={cargoWidth}
            onChangeText={setCargoWidth}
            keyboardType="numeric"
            placeholder={"\u0428"}
          />
          <AppInput
            style={styles.dim}
            value={cargoHeight}
            onChangeText={setCargoHeight}
            keyboardType="numeric"
            placeholder={"\u0412"}
          />
        </View>
        {parseLocaleNumber(cargoVolume) > 0 && (
          <AppText style={{ marginTop: 4, color: "#6B7280" }}>
            {"\u041e\u0431'\u0454\u043c"}: {cargoVolume} {"\u043c3"}
          </AppText>
        )}

        <AppText style={styles.labelStandalone}>{"\u0412\u0430\u0433\u0430, \u043a\u0433"}</AppText>
        <AppInput
          value={cargoWeight}
          onChangeText={setCargoWeight}
          keyboardType="numeric"
          placeholder={"\u0412\u0430\u0433\u0430 \u0432\u0430\u043d\u0442\u0430\u0436\u0443"}
        />

        {distance !== null && (
          <AppText style={{ marginTop: 8, color: "#6B7280" }}>
            ~{distance} {"\u043a\u043c \u043f\u043e \u0434\u043e\u0440\u043e\u0437\u0456"}
          </AppText>
        )}

        <View>
          <AppText style={styles.labelStandalone}>{"\u0414\u043e\u0434\u0430\u0442\u043a\u043e\u0432\u0456 \u043f\u043e\u0441\u043b\u0443\u0433\u0438"}</AppText>
          <View style={styles.serviceRow}>
            <CheckBox
              value={loadHelp}
              onChange={setLoadHelp}
              label={"\u0417\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0435\u043d\u043d\u044f"}
            />
            <CheckBox
              value={unloadHelp}
              onChange={setUnloadHelp}
              label={"\u0420\u043e\u0437\u0432\u0430\u043d\u0442\u0430\u0436\u0435\u043d\u043d\u044f"}
            />
          </View>
        </View>

        <AppText style={styles.labelStandalone}>{"\u041e\u043f\u043b\u0430\u0442\u0430"}</AppText>
        <OptionSwitch
          options={[
            { label: "\u0413\u043e\u0442\u0456\u0432\u043a\u0430", value: "cash" },
            { label: "\u041a\u0430\u0440\u0442\u0430", value: "card" },
          ]}
          value={payment}
          onChange={setPayment}
        />
      </>
    );
  }

  if (!selectedOrderType) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <AppText style={styles.choiceTitle}>{"\u042f\u043a\u0435 \u043f\u0435\u0440\u0435\u0432\u0435\u0437\u0435\u043d\u043d\u044f \u043f\u043e\u0442\u0440\u0456\u0431\u043d\u0435?"}</AppText>
        <AppText style={styles.choiceSubtitle}>
          {"\u041e\u0431\u0435\u0440\u0456\u0442\u044c \u0444\u043e\u0440\u043c\u0430\u0442, \u0449\u043e\u0431 \u043c\u0438 \u043f\u043e\u043a\u0430\u0437\u0430\u043b\u0438 \u043f\u043e\u0442\u0440\u0456\u0431\u043d\u0456 \u043f\u043e\u043b\u044f."}
        </AppText>

        <TouchableOpacity
          style={styles.choiceCard}
          activeOpacity={0.85}
          onPress={() => chooseOrderType(ORDER_TYPE_LOCAL)}
        >
          <View style={styles.choiceIcon}>
            <Ionicons name="time-outline" size={24} color={colors.green} />
          </View>
          <AppText style={styles.choiceCardTitle}>{"\u041c\u0456\u0441\u0446\u0435\u0432\u0435 \u043f\u0435\u0440\u0435\u0432\u0435\u0437\u0435\u043d\u043d\u044f"}</AppText>
          {renderChoiceBullet(LOCAL_ORDER_HINT_TEXT)}
          {renderChoiceBullet("\u041c\u0456\u0441\u0442\u043e \u0442\u0430 \u043f\u0435\u0440\u0435\u0434\u043c\u0456\u0441\u0442\u044f")}
          {renderChoiceBullet("\u041f\u043e\u0433\u043e\u0434\u0438\u043d\u043d\u0430 \u043e\u043f\u043b\u0430\u0442\u0430")}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.choiceCard}
          activeOpacity={0.85}
          onPress={() => chooseOrderType(ORDER_TYPE_LONG_DISTANCE)}
        >
          <View style={[styles.choiceIcon, styles.choiceIconOrange]}>
            <Ionicons name="trail-sign-outline" size={24} color={colors.orange} />
          </View>
          <AppText style={styles.choiceCardTitle}>{"\u0414\u0430\u043b\u0435\u043a\u0435 \u043f\u0435\u0440\u0435\u0432\u0435\u0437\u0435\u043d\u043d\u044f"}</AppText>
          {renderChoiceBullet(
            "\u0412\u0438 \u043f\u0440\u043e\u043f\u043e\u043d\u0443\u0454\u0442\u0435 \u0446\u0456\u043d\u0443 \u0430\u0431\u043e \u043e\u0431\u0438\u0440\u0430\u0454\u0442\u0435 \u00ab\u0414\u043e\u0433\u043e\u0432\u0456\u0440\u043d\u0430\u00bb"
          )}
          {renderChoiceBullet("\u0414\u043b\u044f \u043c\u0430\u0440\u0448\u0440\u0443\u0442\u0456\u0432 \u043f\u043e\u0437\u0430 \u043c\u0456\u0441\u0442\u043e\u043c")}
        </TouchableOpacity>
      </ScrollView>
    );
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
          <View style={styles.selectedTypeHeader}>
            <View>
              <AppText style={styles.selectedTypeEyebrow}>{"\u0422\u0438\u043f \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f"}</AppText>
              <AppText style={styles.selectedTypeTitle}>
                {isLocalSelected
                  ? "\u041c\u0456\u0441\u0446\u0435\u0432\u0435 \u043f\u0435\u0440\u0435\u0432\u0435\u0437\u0435\u043d\u043d\u044f"
                  : "\u0414\u0430\u043b\u0435\u043a\u0435 \u043f\u0435\u0440\u0435\u0432\u0435\u0437\u0435\u043d\u043d\u044f"}
              </AppText>
            </View>
            <TouchableOpacity
              style={styles.changeTypeButton}
              onPress={() => setSelectedOrderType(null)}
            >
              <AppText style={styles.changeTypeText}>{"\u0417\u043c\u0456\u043d\u0438\u0442\u0438"}</AppText>
            </TouchableOpacity>
          </View>

          {isLocalSelected && (
            <AppText style={styles.localDistanceHint}>
              {LOCAL_DISTANCE_HINT_TEXT}
            </AppText>
          )}

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
            currentLocation={currentLocation}
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
            currentLocation={currentLocation}
            provider="google"
            googleApiKey={GOOGLE_PLACES_API_KEY}
            suggestionStyles={{
              box: styles.suggestionsBoxWrapper,
              item: styles.suggestionItem,
              main: styles.suggestionMain,
              sub: styles.suggestionSub,
            }}
          />

          {isLocalSelected && (
            <>
              <View style={styles.section}>
                <Ionicons name="timer-outline" size={20} color={colors.green} />
                <AppText style={styles.label}>{"\u041a\u043e\u043b\u0438 \u043f\u043e\u0442\u0440\u0456\u0431\u043d\u0435 \u0430\u0432\u0442\u043e"}</AppText>
              </View>
              <OptionSwitch
                style={styles.timingSwitch}
                options={[
                  { label: "\u042f\u043a\u043d\u0430\u0439\u0448\u0432\u0438\u0434\u0448\u0435", value: TIMING_ASAP },
                  { label: "\u0414\u043e 1 \u0433\u043e\u0434", value: TIMING_WITHIN_1_HOUR },
                  { label: "\u0417\u0430\u043f\u043b\u0430\u043d\u0443\u0432\u0430\u0442\u0438", value: TIMING_SCHEDULED },
                ]}
                value={localTiming}
                onChange={(value) => {
                  setLocalTiming(value);
                  if (value !== TIMING_SCHEDULED) {
                    setAdditionalInfoExpanded(false);
                    setFreeDate(false);
                  }
                }}
              />
            </>
          )}

          {!isLocalQuickOrder && (
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
          )}

          {!freeDate && !isLocalQuickOrder && (
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

          {isLocalQuickOrder ? (
            <View style={styles.additionalInfoBox}>
              <TouchableOpacity
                style={styles.additionalInfoHeader}
                onPress={() => setAdditionalInfoExpanded((value) => !value)}
                accessibilityRole="button"
              >
                <View>
                  <AppText style={styles.additionalInfoTitle}>{"\u0414\u043e\u0434\u0430\u0442\u043a\u043e\u0432\u0430 \u0456\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0456\u044f"}</AppText>
                  <AppText style={styles.additionalInfoSubtitle}>{"\u0413\u0430\u0431\u0430\u0440\u0438\u0442\u0438, \u0432\u0430\u0433\u0430, \u043f\u043e\u0441\u043b\u0443\u0433\u0438 \u0442\u0430 \u043e\u043f\u043b\u0430\u0442\u0430"}</AppText>
                </View>
                <Ionicons
                  name={additionalInfoExpanded ? "remove-circle-outline" : "add-circle-outline"}
                  size={28}
                  color={colors.green}
                />
              </TouchableOpacity>
              {additionalInfoExpanded && renderAdditionalFields()}
            </View>
          ) : (
            <>
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

            </>
          )}

          {isLocalQuickOrder && (
            <>
              <AppText style={styles.labelStandalone}>{"\u041e\u043f\u0438\u0441 \u0432\u0430\u043d\u0442\u0430\u0436\u0443"}</AppText>
              <AppInput
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                style={{ height: 100, textAlignVertical: "top" }}
              />
            </>
          )}

          <PhotoPicker photos={photos} onChange={setPhotos} />
          <View style={{ marginTop: 16 }}>
            {isEffectiveLocalOrder ? (
              <View style={styles.intraCityHintBox}>
                <AppText style={styles.intraCityHintText}>
                  {isLocalSelected ? LOCAL_PRICE_HINT_TEXT : INTRA_CITY_HINT_TEXT}
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
  choiceTitle: {
    marginTop: 24,
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  choiceSubtitle: {
    marginTop: 8,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  choiceCard: {
    marginTop: 16,
    padding: 18,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
  },
  choiceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary100,
    marginBottom: 12,
  },
  choiceIconOrange: {
    backgroundColor: "#FFEDD5",
  },
  choiceCardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  choiceBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 4,
  },
  choiceBulletMarker: {
    width: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  choiceCardText: {
    flex: 1,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  selectedTypeHeader: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectedTypeEyebrow: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  selectedTypeTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },
  changeTypeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary100,
  },
  changeTypeText: {
    color: colors.green,
    fontWeight: "800",
  },
  timingSwitch: {
    marginTop: 10,
  },
  localDistanceHint: {
    marginTop: 8,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  additionalInfoBox: {
    marginTop: 24,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
  },
  additionalInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  additionalInfoTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 16,
  },
  additionalInfoSubtitle: {
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 18,
  },
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
