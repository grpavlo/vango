import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Ionicons } from "@expo/vector-icons";

import AppText from "../components/AppText";
import AppInput from "../components/AppInput";
import AppButton from "../components/AppButton";
import DateInput from "../components/DateInput";
import TimeInput from "../components/TimeInput";
import AddressSearchInput from "../components/AddressSearchInput";
import Screen from "../components/Screen";
import PhotoPicker from "../components/PhotoPicker";
import OptionSwitch from "../components/OptionSwitch";
import CheckBox from "../components/CheckBox";
import { colors } from "../components/Colors";
import { apiFetch, HOST_URL } from "../api";
import { useAuth } from "../AuthContext";
import { useToast } from "../components/Toast";
import { GOOGLE_PLACES_API_KEY } from "../config";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const FREE_DATE_TTL_DAYS = 7;

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

export default function EditOrderScreen({ route, navigation }) {
  const { token } = useAuth();
  const toast = useToast();
  const { order } = route.params;
  const hasFooter = AppButton.length > 0;

  const [pickupQuery, setPickupQuery] = useState(order.pickupLocation || "");
  const [pickup, setPickup] = useState(
    order.pickupLat
      ? {
          text: order.pickupLocation,
          lat: order.pickupLat,
          lon: order.pickupLon,
          city: order.pickupCity,
          address: order.pickupAddress,
          country: order.pickupCountry,
          postcode: order.pickupPostcode,
        }
      : null
  );
  const [dropoffQuery, setDropoffQuery] = useState(order.dropoffLocation || "");
  const [dropoff, setDropoff] = useState(
    order.dropoffLat
      ? {
          text: order.dropoffLocation,
          lat: order.dropoffLat,
          lon: order.dropoffLon,
          city: order.dropoffCity,
          address: order.dropoffAddress,
          country: order.dropoffCountry,
          postcode: order.dropoffPostcode,
        }
      : null
  );
  const [cargoLength, setCargoLength] = useState(
    order.cargoLength ? String(order.cargoLength) : ""
  );
  const [cargoWidth, setCargoWidth] = useState(
    order.cargoWidth ? String(order.cargoWidth) : ""
  );
  const [cargoHeight, setCargoHeight] = useState(
    order.cargoHeight ? String(order.cargoHeight) : ""
  );
  const [cargoWeight, setCargoWeight] = useState(
    order.cargoWeight ? String(order.cargoWeight) : ""
  );
  const [cargoVolume, setCargoVolume] = useState(
    order.cargoVolume ? String(order.cargoVolume) : "0"
  );
  const [loadHelp, setLoadHelp] = useState(order.loadHelp);
  const [unloadHelp, setUnloadHelp] = useState(order.unloadHelp);
  const [freeDate, setFreeDate] = useState(!!order.freeDate);
  const [payment, setPayment] = useState(order.payment || "cash");
  const [loadFrom, setLoadFrom] = useState(new Date(order.loadFrom));
  const [loadTo, setLoadTo] = useState(new Date(order.loadTo));
  const [unloadFrom, setUnloadFrom] = useState(new Date(order.unloadFrom));
  const [unloadTo, setUnloadTo] = useState(new Date(order.unloadTo));
  const [photos, setPhotos] = useState(
    order.photos ? order.photos.map((p) => `${HOST_URL}${p}`) : []
  );
  const [description, setDescription] = useState(order.cargoType || "");
  const [systemPrice, setSystemPrice] = useState(order.price || null);
  const [agreedPrice, setAgreedPrice] = useState(!!order.agreedPrice);

  useEffect(() => {
    const l = parseFloat(cargoLength) || 0;
    const w = parseFloat(cargoWidth) || 0;
    const h = parseFloat(cargoHeight) || 0;
    const volume = l * w * h;
    setCargoVolume(volume > 0 ? volume.toFixed(2) : "0");
  }, [cargoLength, cargoWidth, cargoHeight]);

  function handleFreeDateChange(value) {
    setFreeDate(value);
    if (value) {
      Alert.alert(
        "Вільна дата",
        "Якщо дата розвантаження вільна, замовлення буде актуальним 7 днів і показуватиметься водіям у вибраному місті завантаження."
      );
      return;
    }

    if (order.freeDate) {
      const defaults = buildDefaultSchedule();
      setLoadFrom(defaults.loadFrom);
      setLoadTo(defaults.loadTo);
      setUnloadFrom(defaults.unloadFrom);
      setUnloadTo(defaults.unloadTo);
    }
  }

  async function save() {
    try {
      const freeDateSchedule = freeDate
        ? order.freeDate && order.freeDateUntil
          ? {
              loadFrom: new Date(order.loadFrom || new Date()),
              loadTo: new Date(
                order.loadTo || new Date(Date.now() + 60 * 60 * 1000)
              ),
              unloadFrom: new Date(order.unloadFrom || order.freeDateUntil),
              unloadTo: new Date(
                order.unloadTo ||
                  new Date(
                    new Date(order.freeDateUntil).getTime() + 60 * 60 * 1000
                  )
              ),
              freeDateUntil: new Date(order.freeDateUntil),
            }
          : buildFlexibleSchedule()
        : null;

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
      if (cargoLength) fd.append("cargoLength", cargoLength);
      if (cargoWidth) fd.append("cargoWidth", cargoWidth);
      if (cargoHeight) fd.append("cargoHeight", cargoHeight);
      if (cargoWeight) fd.append("cargoWeight", cargoWeight);
      if (parseFloat(cargoVolume) > 0) fd.append("cargoVolume", cargoVolume);

      fd.append(
        "loadFrom",
        (freeDate ? freeDateSchedule.loadFrom : loadFrom).toISOString()
      );
      fd.append(
        "loadTo",
        (freeDate ? freeDateSchedule.loadTo : loadTo).toISOString()
      );
      fd.append(
        "unloadFrom",
        (freeDate ? freeDateSchedule.unloadFrom : unloadFrom).toISOString()
      );
      fd.append(
        "unloadTo",
        (freeDate ? freeDateSchedule.unloadTo : unloadTo).toISOString()
      );
      fd.append("freeDate", freeDate ? "true" : "false");
      if (freeDate && freeDateSchedule?.freeDateUntil) {
        fd.append("freeDateUntil", freeDateSchedule.freeDateUntil.toISOString());
      }

      fd.append("insurance", "false");
      fd.append("loadHelp", loadHelp ? "true" : "false");
      fd.append("unloadHelp", unloadHelp ? "true" : "false");
      fd.append("payment", payment);
      fd.append("price", String(Math.round(Number(systemPrice || 0))));
      fd.append("agreedPrice", agreedPrice ? "true" : "false");

      if (photos.length > 0) {
        photos
          .filter((uri) => !uri.startsWith("http"))
          .forEach((uri) => {
            const filename = uri.split("/").pop();
            const match = /\.([a-zA-Z0-9]+)$/.exec(filename || "");
            const type = match ? `image/${match[1]}` : "image";
            fd.append("photos", { uri, name: filename, type });
          });
      }

      await apiFetch(`/orders/${order.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      toast.show("Змінено");
      navigation.pop(2);
    } catch (err) {
      console.log(err);
    }
  }

  async function confirmSave() {
    if (!pickup || !dropoff) {
      toast.show("Вкажіть адреси завантаження та розвантаження");
      return;
    }
    if (!description.trim()) {
      toast.show("Вкажіть опис вантажу");
      return;
    }
    if (systemPrice === null) {
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

    Alert.alert("Підтвердження", "Зберегти зміни?", [
      { text: "Скасувати" },
      { text: "OK", onPress: save },
    ]);
  }

  return (
    <Screen hasFooter={hasFooter}>
      <KeyboardAwareScrollView
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={80}
        enableOnAndroid
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={32} color="#333" />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
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
              setPickupQuery(point?.text || "");
            }}
            navigation={navigation}
            lat={pickup?.lat}
            lon={pickup?.lon}
            provider="google"
            googleApiKey={GOOGLE_PLACES_API_KEY}
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
              setDropoffQuery(point?.text || "");
            }}
            navigation={navigation}
            lat={dropoff?.lat}
            lon={dropoff?.lon}
            provider="google"
            googleApiKey={GOOGLE_PLACES_API_KEY}
          />

          <View style={styles.freeDateBox}>
            <CheckBox
              value={freeDate}
              onChange={handleFreeDateChange}
              label="Вільна дата"
            />
            {freeDate && (
              <AppText style={styles.freeDateHint}>
                Поля завантаження та розвантаження приховані. Замовлення активне
                7 днів.
              </AppText>
            )}
          </View>

          {!freeDate && (
            <>
              <View style={styles.section}>
                <Ionicons name="arrow-down-circle" size={20} color={colors.green} />
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
                <Ionicons name="arrow-up-circle" size={20} color={colors.orange} />
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
            <AppText style={styles.label}>Габарити (Д x Ш x В, м)</AppText>
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
          {parseFloat(cargoVolume) > 0 && (
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
            <AppText style={styles.labelStandalone}>Ціна</AppText>
            <View style={styles.priceRow}>
              <AppInput
                style={{ marginRight: 8, flex: 1 }}
                value={systemPrice ? String(systemPrice) : ""}
                onChangeText={setSystemPrice}
                keyboardType="number-pad"
              />
              <CheckBox
                value={agreedPrice}
                onChange={setAgreedPrice}
                label="Договірна"
              />
            </View>
          </View>

          <View style={styles.actions}>
            <AppButton
              title="Зберегти"
              onPress={confirmSave}
              style={{ flex: 1, height: 56, borderRadius: 16 }}
              textStyle={{ fontSize: 18, fontWeight: "600" }}
            />
          </View>
        </ScrollView>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  dim: { flex: 1, textAlign: "center" },
  section: { flexDirection: "row", alignItems: "center", marginTop: 24 },
  label: { marginLeft: 8, color: colors.text, fontWeight: "600" },
  labelStandalone: { marginTop: 24, color: colors.text, fontWeight: "600" },
  freeDateBox: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
  },
  freeDateHint: {
    marginTop: 8,
    color: "#166534",
  },
  back: {
    position: "absolute",
    top: 40,
    left: 20,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 6,
    zIndex: 100,
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
  actions: { flexDirection: "row", marginTop: 32 },
});
