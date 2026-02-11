import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Modal,
  SafeAreaView,
  ScrollView,
  Platform,
} from "react-native";
import { Host } from "react-native-portalize";
import { Marker, Circle, Polygon } from "react-native-maps";
import AppMap from "../components/AppMap";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useAuth } from "../AuthContext";
import { apiFetch, HOST_URL } from "../api";
import AppInput from "../components/AppInput";
import AddressSearchInput from "../components/AddressSearchInput";
import AppButton from "../components/AppButton";
import DateInput from "../components/DateInput";
import OrderCard from "../components/OrderCard";
import OrderCardSkeleton from "../components/OrderCardSkeleton";
import BottomSheet from "../components/BottomSheet";
import { colors } from "../components/Colors";
import { GOOGLE_PLACES_API_KEY } from "../config";

export default function AllOrdersScreen({ navigation }) {
  const { token } = useAuth();

  const [date, setDate] = useState(new Date());
  const [pickupCity, setPickupCity] = useState("");
  const [pickupPoint, setPickupPoint] = useState(null);
  const [dropoffCity, setDropoffCity] = useState("");
  const [dropoffPoint, setDropoffPoint] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [radius, setRadius] = useState("30");
  const [location, setLocation] = useState(null);
  const wsRef = useRef(null);
  const [detected, setDetected] = useState(false);
  const sheetRef = useRef(null);
  const listRef = useRef(null);
  const mapRef = useRef(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const highlightTimer = useRef(null);

  const CORRIDOR_HALF_WIDTH_KM = 50; // тут змінюєш ширину коридору

  const originPoint = pickupPoint
    ? {
        latitude: parseFloat(pickupPoint.lat),
        longitude: parseFloat(pickupPoint.lon),
      }
    : location;
  const dropoffPointRad = dropoffPoint
    ? {
        latitude: parseFloat(dropoffPoint.lat),
        longitude: parseFloat(dropoffPoint.lon),
      }
    : null;

  const radiusKm = Number.parseFloat(radius || "0");
  const hasOrigin =
    !!originPoint &&
    Number.isFinite(originPoint.latitude) &&
    Number.isFinite(originPoint.longitude);
  const hasDropoff =
    !!dropoffPointRad &&
    Number.isFinite(dropoffPointRad.latitude) &&
    Number.isFinite(dropoffPointRad.longitude);
  const hasRadius = Number.isFinite(radiusKm) && radiusKm > 0;
  const canUsePickupRadius = hasRadius && hasOrigin;
  const canUseDropoffRadius = hasRadius && hasDropoff;
  const hasCorridor = Boolean(originPoint && dropoffPoint);
  const shouldUseRadiusQuery = canUsePickupRadius && !hasCorridor;

  // Текстові фільтри по містах (з урахуванням вибору з карти)
  const pickupCityFilter = (pickupPoint?.city || pickupCity || "").trim();
  const dropoffCityFilter = (dropoffPoint?.city || dropoffCity || "").trim();

  // Однакове місто завантаження/розвантаження (наприклад, Київ–Київ у фільтрі)
  const sameCityFilter =
    pickupCityFilter &&
    dropoffCityFilter &&
    pickupCityFilter.toLowerCase() === dropoffCityFilter.toLowerCase();

  const shouldFilterByPickupCity =
    !!pickupCityFilter && !shouldUseRadiusQuery && !hasCorridor;
  const shouldFilterByDropoffCity =
    !!dropoffCityFilter && !shouldUseRadiusQuery && !hasCorridor;

  const corridorCorners = useMemo(() => {
    if (!originPoint || !dropoffPoint) return null;
    const A = {
      lat: Number(originPoint.latitude),
      lon: Number(originPoint.longitude),
    };
    const B = { lat: Number(dropoffPoint.lat), lon: Number(dropoffPoint.lon) };
    try {
      const corners = rectCornersFromAB(A, B, CORRIDOR_HALF_WIDTH_KM).map(
        (p) => ({
          latitude: Number(p.lat),
          longitude: Number(p.lon),
        })
      );
      // має бути мінімум 4 точки + повтор першої (5)
      if (
        corners.some(
          (c) => Number.isNaN(c.latitude) || Number.isNaN(c.longitude)
        )
      )
        return null;
      return corners;
    } catch (e) {
      console.log("rectCornersFromAB error:", e);
      return null;
    }
  }, [pickupPoint, dropoffPoint]);

  useEffect(() => {
    async function detectCity() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({});
          const locObj = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setLocation(locObj);
          await AsyncStorage.setItem("location", JSON.stringify(locObj));
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${loc.coords.latitude}&lon=${loc.coords.longitude}&format=json&addressdetails=1`,
            { headers: { "User-Agent": "vango-app" } }
          );
          const data = await res.json();
          const addr = data.address || {};
          const city =
            addr.city || addr.town || addr.village || addr.state || "";
          setPickupCity(city);
          setPickupPoint(null);
          if (city) await AsyncStorage.setItem("pickupCity", city);
        }
      } catch {}
      setDetected(true);
    }

    async function init() {
      try {
        const storedCity = await AsyncStorage.getItem("pickupCity");
        const locStr = await AsyncStorage.getItem("location");
        if (storedCity) {
          setPickupCity(storedCity);
          setPickupPoint(null);
        }
        if (locStr) setLocation(JSON.parse(locStr));
        if (storedCity || locStr) {
          setDetected(true);
          return;
        }
      } catch {}
      detectCity();
    }

    init();
  }, []);

  useEffect(() => {
    if (!detected) return;
    fetchOrders();
    const unsubscribe = navigation.addListener("focus", fetchOrders);
    return unsubscribe;
  }, [detected, navigation]);

  useEffect(() => {
    if (!detected) return;
    connectWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, [detected, token, location, pickupPoint, dropoffPoint]);

  async function fetchOrders() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (date) params.append("date", formatDate(date));
      // Якщо місто завантаження та розвантаження однакові - додаємо обидва параметри
      if (sameCityFilter && pickupCityFilter && !shouldUseRadiusQuery && !hasCorridor) {
        params.append("pickupCity", pickupCityFilter);
        params.append("dropoffCity", dropoffCityFilter);
      } else {
        // Якщо міста різні або не задані - додаємо окремо
        if (shouldFilterByPickupCity && pickupCityFilter) {
          params.append("pickupCity", pickupCityFilter);
        }
        if (shouldFilterByDropoffCity && dropoffCityFilter) {
          params.append("dropoffCity", dropoffCityFilter);
        }
      }
      if (shouldUseRadiusQuery && originPoint) {
        params.append("lat", originPoint.latitude.toString());
        params.append("lon", originPoint.longitude.toString());
        params.append("radius", radiusKm.toString());
      }
      // const origin = pickupPoint
      //   ? {
      //       latitude: parseFloat(pickupPoint.lat),
      //       longitude: parseFloat(pickupPoint.lon),
      //     }
      //   : location;

      // const useRadius =
      //   !(pickupPoint && dropoffPoint) &&
      //   radius &&
      //   origin &&
      //   !isNaN(parseFloat(radius));
      // if (!useRadius && pickupCity)
      //   params.append("pickupCity", pickupPoint?.city || pickupCity);
      // if (useRadius) {
      //   params.append("lat", origin.latitude);
      //   params.append("lon", origin.longitude);
      //   params.append("radius", parseFloat(radius));
      // }
      const query = params.toString();
      const data = await apiFetch(`/orders${query ? `?${query}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      let list = data.available;

      const hasCorridor = !!(originPoint && dropoffPoint);
      const A = hasCorridor
        ? {
            lat: Number(originPoint.latitude),
            lon: Number(originPoint.longitude),
          }
        : null;
      const B = hasCorridor
        ? { lat: Number(dropoffPoint.lat), lon: Number(dropoffPoint.lon) }
        : null;
      const D = CORRIDOR_HALF_WIDTH_KM;

      const rKm = radiusKm;
      const canUsePickupR = canUsePickupRadius;
      const canUseDropoffR = canUseDropoffRadius;

      list = list.filter((o) => {
        // Якщо місто завантаження та розвантаження однакові в фільтрі
        // (наприклад, Київ–Київ) і немає коридору / радіуса:
        // показуємо ТІЛЬКИ замовлення, де обидва міста співпадають
        if (sameCityFilter && !shouldUseRadiusQuery && !hasCorridor) {
          const city = pickupCityFilter.toLowerCase();
          const orderPickup = (o.pickupCity || "").toLowerCase();
          const orderDropoff = (o.dropoffCity || "").toLowerCase();
          return orderPickup.includes(city) && orderDropoff.includes(city);
        }

        const P1 =
          o.pickupLat && o.pickupLon
            ? { lat: Number(o.pickupLat), lon: Number(o.pickupLon) }
            : null;
        const P2 =
          o.dropoffLat && o.dropoffLon
            ? { lat: Number(o.dropoffLat), lon: Number(o.dropoffLon) }
            : null;

        const inCorridor = hasCorridor && P1 && isInsideCorridor(P1, A, B, D);

        const inPickupRadius =
          canUsePickupR && P1 && inRadiusKm(P1, originPoint, rKm);

        const inDropoffRadius =
          canUseDropoffR && P2 && inRadiusKm(P2, dropoffPointRad, rKm);

        // Випадок з коридором (різні міста завантаження/розвантаження):
        // показуємо, якщо
        //   - місто завантаження співпадає з текстовим фільтром АБО
        //   - точка завантаження входить у прямокутник-коридор.
        if (hasCorridor) {
          let matchesPickupCity = true;
          if (pickupCityFilter) {
            const pc = pickupCityFilter.toLowerCase();
            const orderPickup = (o.pickupCity || "").toLowerCase();
            matchesPickupCity = orderPickup.includes(pc);
          }
          return matchesPickupCity || inCorridor;
        }

        // Якщо немає коридору, але є радіус(и) – працюємо по радіусу
        if (canUsePickupR || canUseDropoffR) {
          return inPickupRadius || inDropoffRadius;
        }

        // Без геометрії – залишаємо замовлення
        return true;
      });

      setOrders(list);

      // if (!(pickupPoint && dropoffPoint) && radius && origin) {
      //   const r = parseFloat(radius);
      //   if (!isNaN(r) && r > 0) {
      //     list = list.filter((o) => {
      //       if (!o.pickupLat || !o.pickupLon) return false;
      //       const dist = haversine(
      //         origin.latitude,
      //         origin.longitude,
      //         o.pickupLat,
      //         o.pickupLon
      //       );
      //       return dist <= r;
      //     });
      //   }
      // }
      // ... після setOrders(list) — ЗАМІНИ на:
      // if (originPoint && dropoffPoint) {
      //   const A = {
      //     lat: parseFloat(originPoint.latitude),
      //     lon: parseFloat(originPoint.longitude),
      //   };
      //   const B = {
      //     lat: parseFloat(dropoffPoint.lat),
      //     lon: parseFloat(dropoffPoint.lon),
      //   };
      //   const D = CORRIDOR_HALF_WIDTH_KM; // км відступ від прямої

      //   list = list.filter((o) => {
      //     if (!o.pickupLat || !o.pickupLon || !o.dropoffLat || !o.dropoffLon)
      //       return false;
      //     const P1 = { lat: Number(o.pickupLat), lon: Number(o.pickupLon) };
      //     const P2 = { lat: Number(o.dropoffLat), lon: Number(o.dropoffLon) };
      //     return isInsideCorridor(P1, A, B, D) || isInsideCorridor(P2, A, B, D);
      //   });
      // }
      // setOrders(list);

      setLoading(false);
    } catch (err) {
      console.log(err);
      setLoading(false);
    }
  }

  function inRadiusKm(point, center, rKm) {
    if (!point || !center) return false;
    return (
      haversine(center.latitude, center.longitude, point.lat, point.lon) <= rKm
    );
  }

  function passesFilters(o) {
    if (o.deleted) return false;
    const now = new Date();
    if (o.status !== "CREATED") return false;
    if (o.reservedBy && o.reservedUntil && new Date(o.reservedUntil) > now)
      return false;
    if (date && formatDate(new Date(o.loadFrom)) !== formatDate(date))
      return false;

    // Якщо місто завантаження та розвантаження однакові в фільтрі
    // (наприклад, Київ–Київ) і немає коридору / радіуса:
    // показуємо ТІЛЬКИ замовлення, де обидва міста співпадають
    if (sameCityFilter && !shouldUseRadiusQuery && !hasCorridor) {
      const city = pickupCityFilter.toLowerCase();
      const orderPickup = (o.pickupCity || "").toLowerCase();
      const orderDropoff = (o.dropoffCity || "").toLowerCase();
      return orderPickup.includes(city) && orderDropoff.includes(city);
    }

    const rKm = radiusKm;
    const canUsePickupR = canUsePickupRadius;
    const canUseDropoffR = canUseDropoffRadius;

    if (shouldFilterByPickupCity) {
      const pc = pickupCityFilter.toLowerCase();
      if (pc) {
        const orderPickup = (o.pickupCity || "").toLowerCase();
        if (!orderPickup.includes(pc)) return false;
      }
    }

    if (shouldFilterByDropoffCity) {
      const dc = dropoffCityFilter.toLowerCase();
      if (dc) {
        const orderDropoff = (o.dropoffCity || "").toLowerCase();
        if (!orderDropoff.includes(dc)) return false;
      }
    }

    const P1 =
      o.pickupLat && o.pickupLon
        ? { lat: Number(o.pickupLat), lon: Number(o.pickupLon) }
        : null;
    const P2 =
      o.dropoffLat && o.dropoffLon
        ? { lat: Number(o.dropoffLat), lon: Number(o.dropoffLon) }
        : null;

    const A = hasCorridor
      ? {
          lat: Number(originPoint.latitude),
          lon: Number(originPoint.longitude),
        }
      : null;
    const B = hasCorridor
      ? { lat: Number(dropoffPoint.lat), lon: Number(dropoffPoint.lon) }
      : null;
    const D = CORRIDOR_HALF_WIDTH_KM;

    const inCorridor =
      hasCorridor && P1 && isInsideCorridor(P1, A, B, D);

    const inPickupRadius =
      canUsePickupR && P1 && inRadiusKm(P1, originPoint, rKm);

    const inDropoffRadius =
      canUseDropoffR && P2 && inRadiusKm(P2, dropoffPointRad, rKm);

    // Випадок з коридором (різні міста завантаження/розвантаження):
    // показуємо, якщо
    //   - місто завантаження співпадає з текстовим фільтром АБО
    //   - точка завантаження входить у прямокутник-коридор.
    if (hasCorridor) {
      let matchesPickupCity = true;
      if (pickupCityFilter) {
        const pc = pickupCityFilter.toLowerCase();
        const orderPickup = (o.pickupCity || "").toLowerCase();
        matchesPickupCity = orderPickup.includes(pc);
      }
      return matchesPickupCity || inCorridor;
    }

    // Якщо немає коридору, але є радіус(и) – працюємо по радіусу
    if (canUsePickupR || canUseDropoffR) {
      return inPickupRadius || inDropoffRadius;
    }

    // Без геометрії – залишаємо замовлення
    return true;
  }

  function connectWs() {
    if (!token) return;
    if (wsRef.current) wsRef.current.close();
    const params = new URLSearchParams();
    if (date) params.append("date", formatDate(date));
    // Якщо місто завантаження та розвантаження однакові - додаємо обидва параметри
    if (sameCityFilter && pickupCityFilter && !shouldUseRadiusQuery && !hasCorridor) {
      params.append("pickupCity", pickupCityFilter);
      params.append("dropoffCity", dropoffCityFilter);
    } else {
      // Якщо міста різні або не задані - додаємо окремо
      if (shouldFilterByPickupCity && pickupCityFilter) {
        params.append("pickupCity", pickupCityFilter);
      }
      if (shouldFilterByDropoffCity && dropoffCityFilter) {
        params.append("dropoffCity", dropoffCityFilter);
      }
    }
    if (shouldUseRadiusQuery && originPoint) {
      params.append("lat", originPoint.latitude.toString());
      params.append("lon", originPoint.longitude.toString());
      params.append("radius", radiusKm.toString());
    }
    // const useRadius =
    //   !(pickupPoint && dropoffPoint) &&
    //   radius &&
    //   origin &&
    //   !isNaN(parseFloat(radius));
    // if (!useRadius && pickupCity)
    //   params.append("pickupCity", pickupPoint?.city || pickupCity);
    // if (useRadius) {
    //   params.append("lat", origin.latitude);
    //   params.append("lon", origin.longitude);
    //   params.append("radius", parseFloat(radius));
    // }
    const url = `${HOST_URL.replace(
      /^http/,
      "ws"
    )}/api/orders/stream?${params.toString()}`;
    const ws = new WebSocket(url, null, {
      headers: { Authorization: `Bearer ${token}` },
    });
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const order = JSON.parse(ev.data);
        setOrders((prev) => {
          if (order.deleted) {
            return prev.filter((o) => o.id !== order.id);
          }
          if (!passesFilters(order)) {
            return prev.filter((o) => o.id !== order.id);
          }
          const idx = prev.findIndex((o) => o.id === order.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = order;
            return copy;
          }
          return [order, ...prev];
        });
      } catch (e) {
        console.log("ws message error", e);
      }
    };
    ws.onerror = (e) => console.log("ws error", e.message);
  }

  function clearFilters() {
    setDate(new Date());
    setPickupCity("");
    setPickupPoint(null);
    setDropoffCity("");
    setDropoffPoint(null);
    setRadius("30");
  }

  async function refresh() {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  }

  function renderItem({ item }) {
    return (
      <OrderCard
        order={item}
        highlighted={item.id === highlightedId}
        onPress={() =>
          navigation.navigate("OrderDetail", { order: item, token })
        }
      />
    );
  }

  function onMarkerPress(id) {
    const index = orders.findIndex((o) => o.id === id);
    if (index >= 0 && listRef.current) {
      listRef.current.scrollToIndex({ index, animated: true });
    }
    setHighlightedId(id);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedId(null), 3000);
    sheetRef.current?.expand();
  }

  useEffect(() => {
    if (!mapRef.current) return;
    const origin = pickupPoint
      ? {
          latitude: parseFloat(pickupPoint.lat),
          longitude: parseFloat(pickupPoint.lon),
        }
      : location;

    let coords = orders
      .filter((o) => o.pickupLat && o.pickupLon)
      .map((o) => ({ latitude: o.pickupLat, longitude: o.pickupLon }));

    if (origin && radius) {
      const r = parseFloat(radius);
      if (!isNaN(r) && r > 0) {
        const latDelta = r / 111;
        const lonDelta =
          r / (111 * Math.cos((origin.latitude * Math.PI) / 180));
        coords = coords.concat([
          {
            latitude: origin.latitude + latDelta,
            longitude: origin.longitude + lonDelta,
          },
          {
            latitude: origin.latitude + latDelta,
            longitude: origin.longitude - lonDelta,
          },
          {
            latitude: origin.latitude - latDelta,
            longitude: origin.longitude + lonDelta,
          },
          {
            latitude: origin.latitude - latDelta,
            longitude: origin.longitude - lonDelta,
          },
        ]);
      }
    }
    if (dropoffPoint && radius) {
      const r = parseFloat(radius);
      if (!isNaN(r) && r > 0) {
        const latDelta = r / 111;
        const lonDelta =
          r / (111 * Math.cos((dropoffPoint.latitude * Math.PI) / 180));
        coords = coords.concat([
          {
            latitude: dropoffPoint.latitude + latDelta,
            longitude: dropoffPoint.longitude + lonDelta,
          },
          {
            latitude: dropoffPoint.latitude + latDelta,
            longitude: dropoffPoint.longitude - lonDelta,
          },
          {
            latitude: dropoffPoint.latitude - latDelta,
            longitude: dropoffPoint.longitude + lonDelta,
          },
          {
            latitude: dropoffPoint.latitude - latDelta,
            longitude: dropoffPoint.longitude - lonDelta,
          },
        ]);
      }
    }

    if (coords.length) {
      if (originPoint && dropoffPoint) {
        const A = {
          lat: parseFloat(originPoint.latitude),
          lon: parseFloat(originPoint.longitude),
        };
        const B = {
          lat: parseFloat(dropoffPoint.lat),
          lon: parseFloat(dropoffPoint.lon),
        };
        const corners = rectCornersFromAB(A, B, 100).map((p) => ({
          latitude: p.lat,
          longitude: p.lon,
        }));
        coords = coords.concat(corners);
      }
      if (corridorCorners) coords = coords.concat(corridorCorners);
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
        animated: true,
      });
    }
  }, [orders, radius, pickupPoint, dropoffPoint, location]);

  const region = originPoint
    ? {
        latitude: originPoint.latitude,
        longitude: originPoint.longitude,
        latitudeDelta: 0.2,
        longitudeDelta: 0.2,
      }
    : {
        latitude: 50.45,
        longitude: 30.523,
        latitudeDelta: 0.2,
        longitudeDelta: 0.2,
      };

  return (
    <View style={{ flex: 1 }}>
      <AppMap
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={region}
        showsUserLocation
      >
        {hasOrigin && hasRadius && (
          <Circle
            center={{
              latitude: originPoint.latitude,
              longitude: originPoint.longitude,
            }}
            radius={radiusKm * 1000}
            fillColor="rgba(22,163,74,0.15)"
            strokeColor="rgba(22,163,74,0.4)"
          />
        )}

        {hasDropoff && hasRadius && (
          <Circle
            center={{
              latitude: dropoffPointRad.latitude,
              longitude: dropoffPointRad.longitude,
            }}
            radius={radiusKm * 1000}
            fillColor="rgba(163, 22, 22, 0.15)"
            strokeColor="rgba(22,163,74,0.4)"
          />
        )}
        {/* {originPoint && !(originPoint && dropoffPoint) && (
         
        )} */}
        {orders.map(
          (o) =>
            o.pickupLat &&
            o.pickupLon && (
              <Marker
                key={o.id}
                coordinate={{
                  latitude: Number(o.pickupLat),
                  longitude: Number(o.pickupLon),
                }}
                pinColor={colors.orange}
                onPress={() => onMarkerPress(o.id)}
              />
            )
        )}

        {originPoint && dropoffPoint && (
          <Polygon
            coordinates={rectCornersFromAB(
              { lat: originPoint.latitude, lon: originPoint.longitude },
              {
                lat: parseFloat(dropoffPoint.lat),
                lon: parseFloat(dropoffPoint.lon),
              },
              CORRIDOR_HALF_WIDTH_KM
            ).map((p) => ({ latitude: p.lat, longitude: p.lon }))}
            strokeColor="rgba(0,0,0,0.8)"
            fillColor="rgba(95, 95, 95, 0.15)"
            strokeWidth={2}
          />
        )}
        {/* {corridorCorners && (
          <>
             4 кути фіолетовими пінками — якщо їх видно, геометрія ок 
            {corridorCorners.slice(0, 4).map((c, i) => (
              <Marker key={`cr-${i}`} coordinate={c} pinColor="purple" />
            ))}

             сам полігон 
            <Polygon
              coordinates={corridorCorners}
              strokeColor="rgba(0,0,0,0.9)"
              strokeWidth={2}
              fillColor="rgba(0,0,0,0.18)"
              zIndex={10}
            />
          </>
        )} */}
      </AppMap>
      <BottomSheet ref={sheetRef}>
        <View style={{ paddingHorizontal: 12, flex: 1 }}>
          <AppButton
            title="Фільтр"
            onPress={() => setFiltersVisible(true)}
            style={styles.toggle}
          />
          <Modal
            visible={filtersVisible}
            animationType="slide"
            onRequestClose={() => setFiltersVisible(false)}
          >
            <Host>
              <SafeAreaView style={styles.modalContainer}>
                <ScrollView contentContainerStyle={styles.filters}>
                <DateInput
                  value={date}
                  onChange={setDate}
                  style={styles.input}
                />
                <AddressSearchInput
                  placeholder="Місце завантаження"
                  value={pickupCity}
                  onChangeText={(t) => {
                    setPickupCity(t);
                    if (!t) setPickupPoint(null);
                  }}
                  onSelect={setPickupPoint}
                  navigation={navigation}
                  onOpenMap={() => setFiltersVisible(false)}
                  onCloseMap={() => setFiltersVisible(true)}
                  lat={pickupPoint?.lat}
                  lon={pickupPoint?.lon}
                  currentLocation={location}
                  provider="google"
                  googleApiKey={GOOGLE_PLACES_API_KEY}
                />
                <AddressSearchInput
                  placeholder="Місце розвантаження"
                  value={dropoffCity}
                  onChangeText={(t) => {
                    setDropoffCity(t);
                    if (!t) setDropoffPoint(null);
                  }}
                  onSelect={setDropoffPoint}
                  navigation={navigation}
                  onOpenMap={() => setFiltersVisible(false)}
                  onCloseMap={() => setFiltersVisible(true)}
                  lat={dropoffPoint?.lat}
                  lon={dropoffPoint?.lon}
                  currentLocation={location}
                  // головне:
                  provider="google"
                  googleApiKey={GOOGLE_PLACES_API_KEY}
                />

                <View style={styles.radiusRow}>
                  <AppButton
                    title="-"
                    onPress={() =>
                      setRadius((r) =>
                        Math.max(0, (parseFloat(r) || 0) - 10).toString()
                      )
                    }
                    style={styles.radiusButton}
                  />
                  <AppInput
                    placeholder="Радіус км"
                    value={radius.toString()}
                    onChangeText={setRadius}
                    keyboardType="numeric"
                    style={[styles.input, styles.radiusInput]}
                  />
                  <AppButton
                    title="+"
                    onPress={() =>
                      setRadius((r) => ((parseFloat(r) || 0) + 10).toString())
                    }
                    style={styles.radiusButton}
                  />
                </View>
                <View style={styles.actionsRow}>
                  <AppButton
                    title="Очистити"
                    color="#777"
                    onPress={clearFilters}
                    style={styles.actionBtn}
                  />
                  <AppButton
                    title="Пошук"
                    onPress={() => {
                      fetchOrders();
                      connectWs();
                      setFiltersVisible(false);
                    }}
                    style={styles.actionBtn}
                  />
                </View>
                <AppButton
                  title="Закрити"
                  color="#333"
                  onPress={() => setFiltersVisible(false)}
                  style={styles.closeBtn}
                />
              </ScrollView>
            </SafeAreaView>
            </Host>
          </Modal>
          <FlatList
            ref={listRef}
            data={orders}
            renderItem={renderItem}
            keyExtractor={(o) => o.id.toString()}
            onRefresh={refresh}
            refreshing={refreshing}
            ListEmptyComponent={
              loading ? (
                <View style={styles.empty}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <OrderCardSkeleton key={i} />
                  ))}
                </View>
              ) : null
            }
            contentContainerStyle={styles.listContent}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

function formatDate(d) {
  if (!d) return "";
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}

const styles = StyleSheet.create({
  filters: {
    padding: 16,
  },
  input: {
    marginVertical: 4,
    width: "100%",
  },
  toggle: { marginVertical: 8, width: "100%" },
  radiusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexBasis: "100%",
  },
  radiusButton: { flex: 1, marginHorizontal: 4 },
  radiusInput: { flex: 2, textAlign: "center" },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexBasis: "100%",
    marginTop: 8,
  },
  actionBtn: { flex: 1, marginHorizontal: 4 },
  closeBtn: { marginTop: 8 },
  modalContainer: { flex: 1 },
  empty: { paddingVertical: 8 },
  listContent: { paddingBottom: 260 },
});

function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function toXY(lat, lon, lat0) {
  // повертає координати в кілометрах у локальній площині
  const kLat = 111.0;
  const kLon = 111.0 * Math.cos((lat0 * Math.PI) / 180);
  return { x: lon * kLon, y: lat * kLat };
}

function toLatLon(x, y, lat0) {
  const kLat = 111.0;
  const kLon = 111.0 * Math.cos((lat0 * Math.PI) / 180);
  return { lat: y / kLat, lon: x / kLon };
}

// Кути прямокутника з відступом dKm від прямої A→B
function rectCornersFromAB(A, B, dKm = 50) {
  const lat0 = (A.lat + B.lat) / 2;
  const a = toXY(A.lat, A.lon, lat0);
  const b = toXY(B.lat, B.lon, lat0);
  const vx = b.x - a.x,
    vy = b.y - a.y;
  const L = Math.hypot(vx, vy) || 1;
  const nx = -vy / L,
    ny = vx / L; // одиничний перпендикуляр
  const c1 = { x: a.x + nx * dKm, y: a.y + ny * dKm };
  const c2 = { x: a.x - nx * dKm, y: a.y - ny * dKm };
  const c3 = { x: b.x - nx * dKm, y: b.y - ny * dKm };
  const c4 = { x: b.x + nx * dKm, y: b.y + ny * dKm };
  // назад у lat/lon
  const p1 = toLatLon(c1.x, c1.y, lat0);
  const p2 = toLatLon(c2.x, c2.y, lat0);
  const p3 = toLatLon(c3.x, c3.y, lat0);
  const p4 = toLatLon(c4.x, c4.y, lat0);
  return [p1, p2, p3, p4, p1]; // замкнена лінія для Polygon
}

// Перевірка: чи лежить точка P усередині прямокутника вздовж A→B з напівшириною dKm
function isInsideCorridor(P, A, B, dKm = 50) {
  const lat0 = (A.lat + B.lat) / 2;
  const a = toXY(A.lat, A.lon, lat0);
  const b = toXY(B.lat, B.lon, lat0);
  const p = toXY(P.lat, P.lon, lat0);
  const vx = b.x - a.x,
    vy = b.y - a.y;
  const L = Math.hypot(vx, vy) || 1;
  const ux = vx / L,
    uy = vy / L; // вздовж
  const nx = -uy,
    ny = ux; // поперек
  // координати точки у базисі (u,n)
  const t = (p.x - a.x) * ux + (p.y - a.y) * uy; // вздовж 0..L
  const s = (p.x - a.x) * nx + (p.y - a.y) * ny; // поперек -d..d
  return t >= 0 && t <= L && Math.abs(s) <= dKm;
}




