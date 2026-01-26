import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  SafeAreaView,
} from "react-native";
import AppText from "../components/AppText";
import AppInput from "../components/AppInput";
import AppButton from "../components/AppButton";
import DateInput from "../components/DateInput";
import TimeInput from "../components/TimeInput";
import { colors } from "../components/Colors";
import Screen from "../components/Screen";
import Slider from "@react-native-community/slider";
import PhotoPicker from "../components/PhotoPicker";
import OptionSwitch from "../components/OptionSwitch";
import CheckBox from "../components/CheckBox";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch, API_URL, HOST_URL } from "../api";
import { useAuth } from "../AuthContext";
import { useToast } from "../components/Toast";
import { registerCallback } from "../callbackRegistry";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { GOOGLE_PLACES_API_KEY } from "../config";

export default function EditOrderScreen({ route, navigation }) {
  const { token } = useAuth();
  const toast = useToast();
  const { order } = route.params;
  const hasFooter = AppButton.length > 0;
  const googleApiKey = GOOGLE_PLACES_API_KEY;

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
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
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
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  // const [length, setLength] = useState(order.dimensions.split('x')[0] || '');
  // const [width, setWidth] = useState(order.dimensions.split('x')[1] || '');
  // const [height, setHeight] = useState(order.dimensions.split('x')[2] || '');
  // const [weight, setWeight] = useState(String(order.weight || ''));
  // const [volWeight, setVolWeight] = useState(String(order.volWeight || '0'));
  const [loadHelp, setLoadHelp] = useState(order.loadHelp);
  const [unloadHelp, setUnloadHelp] = useState(order.unloadHelp);
  const [payment, setPayment] = useState(order.payment || "cash");

  const pickupTimer = useRef(null);
  const dropoffTimer = useRef(null);
  const now = new Date();
  const startDay = new Date(order.loadFrom);
  const endDay = new Date(order.loadTo);
  const [loadFrom, setLoadFrom] = useState(new Date(order.loadFrom));
  const [loadTo, setLoadTo] = useState(new Date(order.loadTo));
  const [unloadFrom, setUnloadFrom] = useState(new Date(order.unloadFrom));
  const [unloadTo, setUnloadTo] = useState(new Date(order.unloadTo));
  const [photos, setPhotos] = useState(
    order.photos ? order.photos.map((p) => `${HOST_URL}${p}`) : []
  );
  const [description, setDescription] = useState(order.cargoType || "");
  const [systemPrice, setSystemPrice] = useState(order.price || null);
  const [adjust, setAdjust] = useState(0);
  const [agreedPrice, setAgreedPrice] = useState(!!order.agreedPrice);

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

  async function save() {
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
        photos
          .filter((p) => !p.startsWith("http"))
          .forEach((p) => {
            const filename = p.split("/").pop();
            const match = /\.([a-zA-Z0-9]+)$/.exec(filename || "");
            const type = match ? `image/${match[1]}` : "image";
            fd.append("photos", { uri: p, name: filename, type });
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
    Alert.alert("Підтвердження", "Зберегти зміни?", [
      { text: "Скасувати" },
      { text: "OK", onPress: save },
    ]);
  }

  async function loadSuggestions(text, setter) {
    if (text.length < 3 || !googleApiKey) {
      setter([]);
      return;
    }
    try {
      const url =
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
        `input=${encodeURIComponent(text)}` +
        `&key=${googleApiKey}` +
        `&components=country:ua` +
        `&language=uk`;
      const res = await fetch(url);
      const json = await res.json();
      // json.predictions — масив об’єктів
      setter(json.predictions);
    } catch (error) {
      console.warn("Autocomplete error:", error);
    }
  }

  async function fetchPlaceDetails(placeId) {
    if (!googleApiKey) return null;

    const url =
      "https://maps.googleapis.com/maps/api/place/details/json" +
      `?place_id=${placeId}` +
      `&fields=geometry,formatted_address,address_components` +
      `&language=uk&key=${googleApiKey}`;

    const res = await fetch(url);
    const json = await res.json();
    return json.result;
  }

  function extractParts(components = []) {
    const get = (t) =>
      components.find((c) => c.types.includes(t))?.long_name || "";
    return {
      city:
        get("locality") ||
        get("administrative_area_level_2") ||
        get("administrative_area_level_1"),
      address: [get("route"), get("street_number")].filter(Boolean).join(" "),
      country: get("country"),
      postcode: get("postal_code"),
    };
  }

  return (
    <Screen hasFooter={hasFooter}>
      <KeyboardAwareScrollView
        //contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={80} // щоб підняло поле
        enableOnAndroid={true}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.back}
          onPress={() => navigation.goBack()}
        >
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
          <View style={{ position: "relative", zIndex: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <AppInput
                style={{
                  flex: 1,
                  height: pickupQuery && pickupQuery.length > 60 ? 112 : 56,
                  textAlignVertical: pickupQuery && pickupQuery.length > 60 ? 'top' : 'center',
                  paddingTop: pickupQuery && pickupQuery.length > 60 ? 10 : 0,
                }}
                multiline
                value={pickupQuery}
                onChangeText={(t) => {
                  setPickupQuery(t);
                  setPickup(null);
                  if (pickupTimer.current) clearTimeout(pickupTimer.current);
                  pickupTimer.current = setTimeout(
                    () => loadSuggestions(t, setPickupSuggestions),
                    1000
                  );
                }}
              />
              <TouchableOpacity
                style={styles.mapBtn}
                onPress={() => {
                  const onSelectId = registerCallback((p) => {
                    setPickup(p);
                    setPickupQuery(p.text || pickupQuery);
                  });
                  navigation.navigate("MapSelect", {
                    address: pickupQuery,
                    lat: pickup?.lat,
                    lon: pickup?.lng,
                    onSelectId,
                  });
                }}
              >
                <Ionicons name="map" size={24} color={colors.orange} />
              </TouchableOpacity>
            </View>
            {pickupSuggestions.length > 0 && (
              <View style={[styles.suggestionsDropdown, styles.suggestionsBox]}>
                <ScrollView
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="always"
                  showsVerticalScrollIndicator
                  contentContainerStyle={{ flexGrow: 1 }}
                >
                  {pickupSuggestions.map((item) => (
                    <TouchableOpacity
                      key={item.place_id}
                      style={styles.suggestionItem}
                      onPress={async () => {
                        const det = await fetchPlaceDetails(item.place_id);
                        if (!det?.geometry?.location) return;
                        const { lat, lng } = det.geometry.location;
                        const parts = extractParts(det.address_components);
                        setPickup({
                          text: det.formatted_address,
                          lat: Number(lat),
                          lon: Number(lng),
                          city: parts.city,
                          address: parts.address,
                          country: parts.country,
                          postcode: parts.postcode,
                        });
                        setPickupQuery(det.formatted_address);
                        setPickupSuggestions([]);
                      }}
                    >
                      <AppText style={styles.suggestionMain}>
                        {item.structured_formatting?.main_text ||
                          item.description}
                      </AppText>
                      <AppText style={styles.suggestionSub}>
                        {item.structured_formatting?.secondary_text}
                      </AppText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Ionicons name="location" size={20} color={colors.orange} />
            <AppText style={styles.label}>Куди</AppText>
          </View>
          <View style={{ position: "relative", zIndex: 9 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <AppInput
                style={{
                  flex: 1,
                  height: dropoffQuery && dropoffQuery.length > 60 ? 112 : 56,
                  textAlignVertical: dropoffQuery && dropoffQuery.length > 60 ? 'top' : 'center',
                  paddingTop: dropoffQuery && dropoffQuery.length > 60 ? 10 : 0,
                }}
                multiline
                value={dropoffQuery}
                onChangeText={(t) => {
                  setDropoffQuery(t);
                  setDropoff(null);
                  if (dropoffTimer.current) clearTimeout(dropoffTimer.current);
                  dropoffTimer.current = setTimeout(
                    () => loadSuggestions(t, setDropoffSuggestions),
                    1000
                  );
                }}
              />
              <TouchableOpacity
                style={styles.mapBtn}
                onPress={() => {
                  const onSelectId = registerCallback((p) => {
                    setDropoff(p);
                    setDropoffQuery(p.text || dropoffQuery);
                  });
                  navigation.navigate("MapSelect", {
                    address: dropoffQuery,
                    lat: dropoff?.lat,
                    lon: dropoff?.lon,
                    onSelectId,
                  });
                }}
              >
                <Ionicons name="map" size={24} color={colors.green} />
              </TouchableOpacity>
            </View>
            {dropoffSuggestions.length > 0 && (
              <View style={[styles.suggestionsDropdown, styles.suggestionsBox]}>
                <ScrollView keyboardShouldPersistTaps="handled">
                  {dropoffSuggestions.map((item) => (
                    <TouchableOpacity
                      key={item.place_id}
                      style={styles.suggestionItem}
                      onPress={async () => {
                        const det = await fetchPlaceDetails(item.place_id);
                        if (!det?.geometry?.location) return;
                        const { lat, lng } = det.geometry.location;
                        const parts = extractParts(det.address_components);

                        setDropoff({
                          // ✅ правильний стейт
                          text: det.formatted_address,
                          lat: Number(lat),
                          lon: Number(lng),
                          city: parts.city,
                          address: parts.address,
                          country: parts.country,
                          postcode: parts.postcode,
                        });

                        setDropoffQuery(det.formatted_address); // ✅ правильне поле
                        setPickupSuggestions([]);
                        setDropoffSuggestions([]);
                      }}
                    >
                      <AppText style={styles.suggestionMain}>
                        {item.structured_formatting?.main_text ||
                          item.description}
                      </AppText>
                      <AppText style={styles.suggestionSub}>
                        {item.structured_formatting?.secondary_text}
                      </AppText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

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
  // dim: { width: 88, textAlign: 'center', height: 88 },
  suggestionsBox: {
    backgroundColor: "#fff",
    borderRadius: 8,
    maxHeight: 200,
    overflow: "hidden",
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
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
  suggestionsDropdown: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    zIndex: 100,
    elevation: 5,
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
  mapBtn: { marginLeft: 8 },
  actions: { flexDirection: "row", marginTop: 32 },
});
