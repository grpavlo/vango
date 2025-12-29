import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";


import AppText from "../components/AppText";
import AppInput from "../components/AppInput";
import AppButton from "../components/AppButton";
import DateInput from "../components/DateInput";
import TimeInput from "../components/TimeInput";
import AddressSearchInput from "../components/AddressSearchInput";
import { colors } from "../components/Colors";
import { GOOGLE_PLACES_API_KEY } from "../config";
import Slider from "@react-native-community/slider";
import PhotoPicker from "../components/PhotoPicker";
import OptionSwitch from "../components/OptionSwitch";
import CheckBox from "../components/CheckBox";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../api";
import { useAuth } from "../AuthContext";
import { useToast } from "../components/Toast";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

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

export default function CreateOrderScreen({ navigation }) {
  const { token } = useAuth();
  const toast = useToast();

  const [pickupQuery, setPickupQuery] = useState("");
  const [pickup, setPickup] = useState(null);
  const [dropoffQuery, setDropoffQuery] = useState("");
  const [dropoff, setDropoff] = useState(null);
  // const [length, setLength] = useState('');
  // const [width, setWidth] = useState('');
  // const [height, setHeight] = useState('');
  // const [weight, setWeight] = useState('');
  // const [volWeight, setVolWeight] = useState('0');
  const [loadHelp, setLoadHelp] = useState(false);
  const [unloadHelp, setUnloadHelp] = useState(false);
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
  const [adjust, setAdjust] = useState(0);
  const [agreedPrice, setAgreedPrice] = useState(false);

  // useEffect(() => {
  //   async function calcPrice() {
  //     if (pickup && dropoff) {
  //       try {
  //         const res = await fetch(
  //           `https://router.project-osrm.org/route/v1/driving/${pickup.lon},${pickup.lat};${dropoff.lon},${dropoff.lat}?overview=false`
  //         );
  //         const data = await res.json();
  //         if (data.routes && data.routes[0]) {
  //           const km = data.routes[0].distance / 1000;
  //           const base = km * 50;
  //           setSystemPrice(base);
  //         }
  //       } catch (err) {
  //         console.log(err);
  //       }
  //     }
  //   }
  //   calcPrice();
  // }, [pickup, dropoff]);

  // useEffect(() => {
  //   const l = parseFloat(length) || 0;
  //   const w = parseFloat(width) || 0;
  //   const h = parseFloat(height) || 0;
  //   const v = l * w * h * 250;
  //   setVolWeight(v.toFixed(2));
  // }, [length, width, height]);

  function resetForm() {
    const defaults = buildDefaultSchedule();
    setPickupQuery("");
    setPickup(null);
    if (typeof setPickupSuggestions === "function") {
      setPickupSuggestions([]);
    }
    setDropoffQuery("");
    setDropoff(null);
    if (typeof setDropoffSuggestions === "function") {
      setDropoffSuggestions([]);
    }
    setLoadFrom(defaults.loadFrom);
    setLoadTo(defaults.loadTo);
    setUnloadFrom(defaults.unloadFrom);
    setUnloadTo(defaults.unloadTo);
    setLoadHelp(false);
    setUnloadHelp(false);
    setPayment("cash");
    setDescription("");
    setPhotos([]);
    setSystemPrice(null);
    setAdjust(0);
    setAgreedPrice(false);
  }

  async function create() {
    try {
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
      // fd.append('dimensions', `${length}x${width}x${height}`);
      // fd.append('weight', weight || '0');
      fd.append("loadFrom", loadFrom.toISOString());
      fd.append("loadTo", loadTo.toISOString());
      fd.append("unloadFrom", unloadFrom.toISOString());
      fd.append("unloadTo", unloadTo.toISOString());
      fd.append("insurance", "false");
      // fd.append('volWeight', volWeight);
      fd.append("loadHelp", loadHelp ? "true" : "false");
      fd.append("unloadHelp", unloadHelp ? "true" : "false");
      fd.append("payment", payment);
      const finalPrice = Math.round((systemPrice || 0) * (1 + adjust / 100));
      fd.append("price", finalPrice.toString());
      fd.append("agreedPrice", agreedPrice ? "true" : "false");
      if (photos && photos.length > 0) {
        photos.forEach((p) => {
          const filename = p.split("/").pop();
          const match = /\.([a-zA-Z0-9]+)$/.exec(filename || "");
          const type = match ? `image/${match[1]}` : "image";
          fd.append("photos", { uri: p, name: filename, type });
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
    if (systemPrice === null) {
      toast.show("Потрібно вказати ціну");
      return;
    }
    if (loadFrom < new Date()) {
      toast.show("Дата завантаження не може бути в минулому");
      return;
    }
    if (loadTo <= loadFrom) {
      toast.show("Кінцева дата завантаження повинна бути пізніше початкової");
      return;
    }
    if (unloadFrom <= loadTo) {
      toast.show(
        "Дата початку розвантаження повинна бути після закінчення завантаження"
      );
      return;
    }
    if (unloadTo <= unloadFrom) {
      toast.show("Кінцева дата розвантаження повинна бути пізніше початкової");
      return;
    }
    Alert.alert("Підтвердження", "Ви впевнені що хочете розмістити вантаж?", [
      { text: "Скасувати" },
      { text: "OK", onPress: create },
    ]);
  }

  return (
    <KeyboardAwareScrollView
      //contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      extraScrollHeight={80} // щоб підняло поле
      enableOnAndroid={true}
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
              if (!text) {
                setPickup(null);
              }
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
              if (!text) {
                setDropoff(null);
              }
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
            suggestionStyles={{
              box: styles.suggestionsBoxWrapper,
              item: styles.suggestionItem,
              main: styles.suggestionMain,
              sub: styles.suggestionSub,
            }}
          />

          <View style={styles.section}>
            <Ionicons name="arrow-down-circle" size={20} color={colors.green} />
            <AppText style={styles.label}>Завантаження</AppText>
          </View>
          <DateInput
            value={loadFrom}
            onChange={(d) => {
              const from = new Date(loadFrom);
              from.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
              const to = new Date(loadTo);
              to.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
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
            <AppText style={styles.label}>Вивантаження</AppText>
          </View>
          <DateInput
            value={unloadFrom}
            onChange={(d) => {
              const from = new Date(unloadFrom);
              from.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
              const to = new Date(unloadTo);
              to.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
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

          {/*
      <View style={styles.section}>
        <Ionicons name="cube" size={20} color={colors.green} />
        <AppText style={styles.label}>Габарити (Д x Ш x В, м)</AppText>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <AppInput style={styles.dim} value={length} onChangeText={setLength} keyboardType="numeric" placeholder="Д" />
        <AppInput style={styles.dim} value={width} onChangeText={setWidth} keyboardType="numeric" placeholder="Ш" />
        <AppInput style={styles.dim} value={height} onChangeText={setHeight} keyboardType="numeric" placeholder="В" />
      </View>

      <AppText style={styles.labelStandalone}>Вага, кг</AppText>
      <AppInput value={weight} onChangeText={setWeight} keyboardType="numeric" />

      <AppText style={styles.labelStandalone}>Об'ємна вага, кг</AppText>
      <AppInput value={volWeight} editable={false} />
      */}
<View>
            <AppText style={styles.labelStandalone}>Додаткові послуги</AppText>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginTop: 8,
                marginLeft: 24,
              }}
            >
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

          {/* {systemPrice !== null && ( */}
          <View style={{ marginTop: 16 }}>
            <AppText style={styles.labelStandalone}>
              Ціна
              {/* : {Math.round(systemPrice * (1 + adjust / 100))} грн */}
            </AppText>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <AppInput
                style={{ marginRight: 8, flex: 1 }}
                value={systemPrice ? systemPrice.toString() : ""}
                onChangeText={(t) => {
                  setSystemPrice(t);
                }}
                keyboardType={'number-pad'}
              />
              <CheckBox
                value={agreedPrice}
                onChange={setAgreedPrice}
                label="Договірна"
              />
            </View>

            {/* <Slider
              minimumValue={-5}
              maximumValue={15}
              step={1}
              value={adjust}
              onValueChange={setAdjust}
              thumbTintColor={colors.green}
            />
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <AppText>-5%</AppText>
              <AppText>+15%</AppText>
            </View>*/}
          </View>
          {/* )} */}
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
  dim: { width: 88, textAlign: "center", height: 88 },
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
  suggestionsBoxWrapper: {
    backgroundColor: "#fff",
    borderRadius: 8,
    maxHeight: 200,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  actions: { flexDirection: "row", marginTop: 32 },
});
