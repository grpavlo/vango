import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Modal,
  SafeAreaView,
  ScrollView,
  Platform,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Host } from "react-native-portalize";
import { Marker, Circle, Polygon } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import AppMap from "../components/AppMap";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useAuth } from "../AuthContext";
import { apiFetch, HOST_URL } from "../api";
import AppText from "../components/AppText";
import AppInput from "../components/AppInput";
import AddressSearchInput from "../components/AddressSearchInput";
import AppButton from "../components/AppButton";
import DateRangeInput from "../components/DateRangeInput";
import OrderCard from "../components/OrderCard";
import OrderCardSkeleton from "../components/OrderCardSkeleton";
import BottomSheet from "../components/BottomSheet";
import { colors } from "../components/Colors";
import { GOOGLE_PLACES_API_KEY } from "../config";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useToast } from "../components/Toast";

export default function AllOrdersScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const toast = useToast();

  const [dateFrom, setDateFrom] = useState(() => new Date());
  const [dateTo, setDateTo] = useState(() => new Date());
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
  const filtersRef = useRef(null);
  const fetchIdRef = useRef(0);
  const fetchOrdersRef = useRef(null);
  const [savedSearches, setSavedSearches] = useState([]);
  const [savedSearchesLoading, setSavedSearchesLoading] = useState(false);
  const [savingSearch, setSavingSearch] = useState(false);
  const [deletingSearchId, setDeletingSearchId] = useState(null);
  const [savedSearchesExpanded, setSavedSearchesExpanded] = useState(false);

  const CORRIDOR_HALF_WIDTH_KM = 50; // С‚СѓС‚ Р·РјС–РЅСЋС”С€ С€РёСЂРёРЅСѓ РєРѕСЂРёРґРѕСЂСѓ

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

  // РўРµРєСЃС‚РѕРІС– С„С–Р»СЊС‚СЂРё РїРѕ РјС–СЃС‚Р°С… (Р· СѓСЂР°С…СѓРІР°РЅРЅСЏРј РІРёР±РѕСЂСѓ Р· РєР°СЂС‚Рё)
  const pickupCityFilter = (pickupPoint?.city || pickupCity || "").trim();
  const dropoffCityFilter = (dropoffPoint?.city || dropoffCity || "").trim();

  // РћРґРЅР°РєРѕРІРµ РјС–СЃС‚Рѕ Р·Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ/СЂРѕР·РІР°РЅС‚Р°Р¶РµРЅРЅСЏ (РЅР°РїСЂРёРєР»Р°Рґ, РљРёС—РІвЂ“РљРёС—РІ Сѓ С„С–Р»СЊС‚СЂС–)
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
      // РјР°С” Р±СѓС‚Рё РјС–РЅС–РјСѓРј 4 С‚РѕС‡РєРё + РїРѕРІС‚РѕСЂ РїРµСЂС€РѕС— (5)
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

  fetchOrdersRef.current = fetchOrders;

  useEffect(() => {
    if (!detected) return;
    fetchOrders();
  }, [detected, pickupPoint, dropoffPoint]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      if (fetchOrdersRef.current) fetchOrdersRef.current();
      loadSavedSearches();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (!token) return;
    loadSavedSearches();
  }, [token]);

  useEffect(() => {
    if (!detected) return;
    connectWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, [detected, token, location, pickupPoint, dropoffPoint]);

  useEffect(() => {
    filtersRef.current = { passesFilters, hasCorridor };
  });

  function buildSavedSearchPayload() {
    const currentPickupCity = (pickupPoint?.city || pickupCity || "").trim();
    const currentDropoffCity = (dropoffPoint?.city || dropoffCity || "").trim();
    if (!currentPickupCity) {
      toast.show("Вкажіть місто завантаження");
      return null;
    }
    if (!hasOrigin) {
      toast.show("Не вдалося визначити центр пошуку");
      return null;
    }
    if (!hasRadius) {
      toast.show("Вкажіть радіус пошуку");
      return null;
    }

    return {
      pickupCity: currentPickupCity,
      dropoffCity: currentDropoffCity || null,
      lat: Number(originPoint.latitude),
      lon: Number(originPoint.longitude),
      dropoffLat: dropoffPoint ? Number(dropoffPoint.lat) : null,
      dropoffLon: dropoffPoint ? Number(dropoffPoint.lon) : null,
      radius: radiusKm,
    };
  }

  async function loadSavedSearches() {
    try {
      setSavedSearchesLoading(true);
      const data = await apiFetch("/saved-searches", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSavedSearches(Array.isArray(data) ? data : []);
    } catch (err) {
      console.log("loadSavedSearches error", err);
    } finally {
      setSavedSearchesLoading(false);
    }
  }

  async function saveCurrentSearch() {
    const payload = buildSavedSearchPayload();
    if (!payload) return;

    try {
      setSavingSearch(true);
      await apiFetch("/saved-searches", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      await loadSavedSearches();
      toast.show("Критерій пошуку збережено");
    } catch (err) {
      toast.show(err.message || "Не вдалося зберегти критерій");
    } finally {
      setSavingSearch(false);
    }
  }

  async function removeSavedSearch(id) {
    try {
      setDeletingSearchId(id);
      await apiFetch(`/saved-searches/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setSavedSearches((prev) => prev.filter((item) => item.id !== id));
      toast.show("Критерій видалено");
    } catch (err) {
      toast.show(err.message || "Не вдалося видалити критерій");
    } finally {
      setDeletingSearchId(null);
    }
  }

  function applySavedSearch(savedSearch) {
    const nextPoint = {
      city: savedSearch.pickupCity,
      lat: Number(savedSearch.lat),
      lon: Number(savedSearch.lon),
    };
    const hasSavedDropoffCity = !!String(savedSearch.dropoffCity || "").trim();
    const hasSavedDropoffPoint =
      Number.isFinite(Number(savedSearch.dropoffLat)) &&
      Number.isFinite(Number(savedSearch.dropoffLon));
    const nextDropoffPoint = hasSavedDropoffPoint
      ? {
          city: savedSearch.dropoffCity || "",
          lat: Number(savedSearch.dropoffLat),
          lon: Number(savedSearch.dropoffLon),
        }
      : null;

    setPickupCity(savedSearch.pickupCity || "");
    setPickupPoint(nextPoint);
    setDropoffCity(hasSavedDropoffCity ? savedSearch.dropoffCity : "");
    setDropoffPoint(nextDropoffPoint);
    setRadius(String(Math.round(Number(savedSearch.radius))));
    setFiltersVisible(false);
    toast.show("Критерій застосовано");
  }

  async function fetchOrders(overrideRadiusQuery = null) {
    // skip navigation focus event objects
    if (overrideRadiusQuery && typeof overrideRadiusQuery === 'object' && overrideRadiusQuery.type === 'focus') {
      overrideRadiusQuery = null;
    }
    const currentFetchId = ++fetchIdRef.current;
    const useRadiusOverride =
      overrideRadiusQuery &&
      overrideRadiusQuery.lat != null &&
      overrideRadiusQuery.lon != null &&
      overrideRadiusQuery.radius != null;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateFrom && dateTo) {
        params.append("dateFrom", formatDateFull(dateFrom));
        params.append("dateTo", formatDateFull(dateTo));
      }
      const hasOriginForRadius = !useRadiusOverride && originPoint && hasRadius;
      const hasDropoffForRadius = !useRadiusOverride && dropoffPointRad && hasRadius;
      const useRadiusOnBackend = !hasCorridor && (hasOriginForRadius || hasDropoffForRadius);

      if (useRadiusOverride) {
        params.append("lat", overrideRadiusQuery.lat.toString());
        params.append("lon", overrideRadiusQuery.lon.toString());
        params.append("radius", overrideRadiusQuery.radius.toString());
      } else {
        if (useRadiusOnBackend) {
          if (hasOriginForRadius) {
            params.append("lat", originPoint.latitude.toString());
            params.append("lon", originPoint.longitude.toString());
            params.append("radius", radiusKm.toString());
          }
          if (hasDropoffForRadius) {
            params.append("dropoffLat", dropoffPointRad.latitude.toString());
            params.append("dropoffLon", dropoffPointRad.longitude.toString());
            params.append("dropoffRadius", radiusKm.toString());
          }
        }
        if (!useRadiusOnBackend && !hasCorridor) {
          if (sameCityFilter && pickupCityFilter) {
            params.append("pickupCity", pickupCityFilter);
            params.append("dropoffCity", dropoffCityFilter);
          } else {
            if (shouldFilterByPickupCity && pickupCityFilter) {
              params.append("pickupCity", pickupCityFilter);
            }
            if (shouldFilterByDropoffCity && dropoffCityFilter) {
              params.append("dropoffCity", dropoffCityFilter);
            }
          }
        }
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

      const effectiveHasCorridor = useRadiusOverride ? false : !!(originPoint && dropoffPoint);
      const effectiveOrigin = useRadiusOverride
        ? { latitude: overrideRadiusQuery.lat, longitude: overrideRadiusQuery.lon }
        : originPoint;
      const effectiveRadiusKm = useRadiusOverride
        ? parseFloat(overrideRadiusQuery.radius)
        : radiusKm;
      const effectiveCanUsePickupR = useRadiusOverride || canUsePickupRadius;
      const effectiveCanUseDropoffR = useRadiusOverride ? false : canUseDropoffRadius;

      const hasCorridor = effectiveHasCorridor;
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

      const rKm = effectiveRadiusKm;
      const canUsePickupR = effectiveCanUsePickupR;
      const canUseDropoffR = effectiveCanUseDropoffR;

      if (currentFetchId !== fetchIdRef.current) return;

      list = list.filter((o) => {
        if (useRadiusOverride) {
          const P1 =
            o.pickupLat && o.pickupLon
              ? { lat: Number(o.pickupLat), lon: Number(o.pickupLon) }
              : null;
          return P1 && inRadiusKm(P1, effectiveOrigin, rKm);
        }
        if (useRadiusOnBackend) {
          return true;
        }
        // РЇРєС‰Рѕ РјС–СЃС‚Рѕ Р·Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ С‚Р° СЂРѕР·РІР°РЅС‚Р°Р¶РµРЅРЅСЏ РѕРґРЅР°РєРѕРІС– РІ С„С–Р»СЊС‚СЂС–
        // (РЅР°РїСЂРёРєР»Р°Рґ, РљРёС—РІвЂ“РљРёС—РІ) С– РЅРµРјР°С” РєРѕСЂРёРґРѕСЂСѓ / СЂР°РґС–СѓСЃР°:
        // РїРѕРєР°Р·СѓС”РјРѕ РўР†Р›Р¬РљР Р·Р°РјРѕРІР»РµРЅРЅСЏ, РґРµ РѕР±РёРґРІР° РјС–СЃС‚Р° СЃРїС–РІРїР°РґР°СЋС‚СЊ
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

        // Р’РёРїР°РґРѕРє Р· РєРѕСЂРёРґРѕСЂРѕРј: РїРѕРєР°Р·СѓС”РјРѕ Р·Р°РјРѕРІР»РµРЅРЅСЏ РІ СЂР°РґС–СѓСЃС– РІС–Рґ С‚РѕС‡РѕРє РђР‘Рћ РІ РєРѕСЂРёРґРѕСЂС–
        if (hasCorridor) {
          let matchesPickupCity = true;
          if (pickupCityFilter) {
            const pc = pickupCityFilter.toLowerCase();
            const orderPickup = (o.pickupCity || "").toLowerCase();
            matchesPickupCity = orderPickup.includes(pc);
          }
          return matchesPickupCity || inCorridor || inPickupRadius || inDropoffRadius;
        }

        // РЇРєС‰Рѕ РЅРµРјР°С” РєРѕСЂРёРґРѕСЂСѓ, Р°Р»Рµ С” СЂР°РґС–СѓСЃ(Рё) вЂ“ РїСЂР°С†СЋС”РјРѕ РїРѕ СЂР°РґС–СѓСЃСѓ
        if (canUsePickupR || canUseDropoffR) {
          return inPickupRadius || inDropoffRadius;
        }

        // Р‘РµР· РіРµРѕРјРµС‚СЂС–С— вЂ“ Р·Р°Р»РёС€Р°С”РјРѕ Р·Р°РјРѕРІР»РµРЅРЅСЏ
        return true;
      });

      if (currentFetchId !== fetchIdRef.current) return;
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
      // ... РїС–СЃР»СЏ setOrders(list) вЂ” Р—РђРњР†РќР РЅР°:
      // if (originPoint && dropoffPoint) {
      //   const A = {
      //     lat: parseFloat(originPoint.latitude),
      //     lon: parseFloat(originPoint.longitude),
      //   };
      //   const B = {
      //     lat: parseFloat(dropoffPoint.lat),
      //     lon: parseFloat(dropoffPoint.lon),
      //   };
      //   const D = CORRIDOR_HALF_WIDTH_KM; // РєРј РІС–РґСЃС‚СѓРї РІС–Рґ РїСЂСЏРјРѕС—

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
    if (dateFrom && dateTo) {
      const orderDay = new Date(o.loadFrom);
      orderDay.setHours(0, 0, 0, 0);
      const fromDay = new Date(dateFrom);
      fromDay.setHours(0, 0, 0, 0);
      const toDay = new Date(dateTo);
      toDay.setHours(0, 0, 0, 0);
      if (orderDay < fromDay || orderDay > toDay) return false;
    }

    // РЇРєС‰Рѕ РјС–СЃС‚Рѕ Р·Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ С‚Р° СЂРѕР·РІР°РЅС‚Р°Р¶РµРЅРЅСЏ РѕРґРЅР°РєРѕРІС– РІ С„С–Р»СЊС‚СЂС–
    // (РЅР°РїСЂРёРєР»Р°Рґ, РљРёС—РІвЂ“РљРёС—РІ) С– РЅРµРјР°С” РєРѕСЂРёРґРѕСЂСѓ / СЂР°РґС–СѓСЃР°:
    // РїРѕРєР°Р·СѓС”РјРѕ РўР†Р›Р¬РљР Р·Р°РјРѕРІР»РµРЅРЅСЏ, РґРµ РѕР±РёРґРІР° РјС–СЃС‚Р° СЃРїС–РІРїР°РґР°СЋС‚СЊ
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

    // Р’РёРїР°РґРѕРє Р· РєРѕСЂРёРґРѕСЂРѕРј: РїРѕРєР°Р·СѓС”РјРѕ Р·Р°РјРѕРІР»РµРЅРЅСЏ РІ СЂР°РґС–СѓСЃС– РІС–Рґ С‚РѕС‡РѕРє РђР‘Рћ РІ РєРѕСЂРёРґРѕСЂС–
    if (hasCorridor) {
      let matchesPickupCity = true;
      if (pickupCityFilter) {
        const pc = pickupCityFilter.toLowerCase();
        const orderPickup = (o.pickupCity || "").toLowerCase();
        matchesPickupCity = orderPickup.includes(pc);
      }
      return matchesPickupCity || inCorridor || inPickupRadius || inDropoffRadius;
    }

    // РЇРєС‰Рѕ РЅРµРјР°С” РєРѕСЂРёРґРѕСЂСѓ, Р°Р»Рµ С” СЂР°РґС–СѓСЃ(Рё) вЂ“ РїСЂР°С†СЋС”РјРѕ РїРѕ СЂР°РґС–СѓСЃСѓ
    if (canUsePickupR || canUseDropoffR) {
      return inPickupRadius || inDropoffRadius;
    }

    // Р‘РµР· РіРµРѕРјРµС‚СЂС–С— вЂ“ Р·Р°Р»РёС€Р°С”РјРѕ Р·Р°РјРѕРІР»РµРЅРЅСЏ
    return true;
  }

  function connectWs() {
    if (!token) return;
    if (wsRef.current) wsRef.current.close();
    const params = new URLSearchParams();
    if (dateFrom && dateTo) {
      params.append("dateFrom", formatDateFull(dateFrom));
      params.append("dateTo", formatDateFull(dateTo));
    }
    // РЇРєС‰Рѕ РјС–СЃС‚Рѕ Р·Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ С‚Р° СЂРѕР·РІР°РЅС‚Р°Р¶РµРЅРЅСЏ РѕРґРЅР°РєРѕРІС– - РґРѕРґР°С”РјРѕ РѕР±РёРґРІР° РїР°СЂР°РјРµС‚СЂРё
    if (sameCityFilter && pickupCityFilter && !shouldUseRadiusQuery && !hasCorridor) {
      params.append("pickupCity", pickupCityFilter);
      params.append("dropoffCity", dropoffCityFilter);
    } else {
      // РЇРєС‰Рѕ РјС–СЃС‚Р° СЂС–Р·РЅС– Р°Р±Рѕ РЅРµ Р·Р°РґР°РЅС– - РґРѕРґР°С”РјРѕ РѕРєСЂРµРјРѕ
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
        const { passesFilters: passes, hasCorridor: inCorridor } = filtersRef.current || {};
        setOrders((prev) => {
          if (order.deleted) {
            return prev.filter((o) => o.id !== order.id);
          }
          if (inCorridor) {
            if (order.status !== "CREATED" && prev.some((o) => o.id === order.id)) {
              return prev.filter((o) => o.id !== order.id);
            }
            return prev;
          }
          const idx = prev.findIndex((o) => o.id === order.id);
          if (passes && !passes(order)) {
            if (idx >= 0 && order.status !== "CREATED") {
              return prev.filter((o) => o.id !== order.id);
            }
            return prev;
          }
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
    const now = new Date();
    setDateFrom(now);
    setDateTo(now);
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
        onLocationCentered={(coords) => {
          setLocation(coords);
          setPickupPoint(null);
          setDropoffPoint(null);
          setPickupCity("");
          setDropoffCity("");
          setRadius("30");
          fetchOrders({
            lat: coords.latitude,
            lon: coords.longitude,
            radius: "30",
          });
        }}
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

        {hasOrigin && hasDropoff && (
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
             4 РєСѓС‚Рё С„С–РѕР»РµС‚РѕРІРёРјРё РїС–РЅРєР°РјРё вЂ” СЏРєС‰Рѕ С—С… РІРёРґРЅРѕ, РіРµРѕРјРµС‚СЂС–СЏ РѕРє 
            {corridorCorners.slice(0, 4).map((c, i) => (
              <Marker key={`cr-${i}`} coordinate={c} pinColor="purple" />
            ))}

             СЃР°Рј РїРѕР»С–РіРѕРЅ 
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
            transparent
            onRequestClose={() => setFiltersVisible(false)}
          >
            <Host>
              <View style={styles.modalRoot}>
                <View style={[styles.modalOverlay, { top: -insets.top }]}>
                  <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  activeOpacity={1}
                  onPress={() => setFiltersVisible(false)}
                />
                <View style={styles.modalPanel}>
                  <SafeAreaView style={styles.modalContent}>
                    <View style={styles.modalBody}>
                    <ScrollView
                      contentContainerStyle={styles.filters}
                      showsVerticalScrollIndicator={false}
                    >
                <AppText style={styles.dateLabel}>Дата завантаження</AppText>
                <DateRangeInput
                  valueFrom={dateFrom}
                  valueTo={dateTo}
                  onChange={(from, to) => {
                    setDateFrom(from);
                    setDateTo(to);
                  }}
                  placeholder="З ... по ..."
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
                  // РіРѕР»РѕРІРЅРµ:
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
                    title="Пошук"
                    onPress={() => {
                      fetchOrders();
                      connectWs();
                      setFiltersVisible(false);
                    }}
                    style={styles.actionBtn}
                  />
                  <AppButton
                    title="Очистити"
                    color="#777"
                    onPress={clearFilters}
                    style={styles.actionBtn}
                  />
                </View>
                <AppButton
                  title={savingSearch ? "Збереження..." : "Додати критерій в обране"}
                  onPress={saveCurrentSearch}
                  disabled={savingSearch}
                  color={colors.orange}
                  style={styles.savedSearchAction}
                />
                <AppButton
                  title="Закрити"
                  color="#333"
                  onPress={() => setFiltersVisible(false)}
                  style={styles.closeBtn}
                />
                 <View style={styles.savedSearchSection}>
                  <TouchableOpacity
                    style={styles.savedSearchHeader}
                    activeOpacity={savedSearches.length > 0 ? 0.8 : 1}
                    disabled={savedSearches.length === 0}
                    onPress={() => setSavedSearchesExpanded((prev) => !prev)}
                  >
                    <View style={styles.savedSearchHeaderTextWrap}>
                      <AppText style={styles.savedSearchTitle}>
                        Збережені критерії
                      </AppText>
                      <AppText style={styles.savedSearchSummary}>
                        {savedSearches.length > 0
                          ? `${savedSearches.length} ${savedSearches.length === 1 ? "критерій" : "критерії"}`
                          : "Сповіщення за обраними критеріями"}
                      </AppText>
                    </View>
                    <View style={styles.savedSearchHeaderRight}>
                      <AppText style={styles.savedSearchCount}>
                        {savedSearches.length}
                      </AppText>
                      {savedSearches.length > 0 && (
                        <Ionicons
                          name={savedSearchesExpanded ? "chevron-up" : "chevron-down"}
                          size={18}
                          color={colors.textSecondary}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                  {savedSearchesLoading ? (
                    <AppText style={styles.savedSearchHint}>
                      Завантаження...
                    </AppText>
                  ) : savedSearches.length === 0 ? (
                    <AppText style={styles.savedSearchHint}>
                      Тут з'являться критерії пошуку для сповіщень про нові замовлення.
                    </AppText>
                  ) : savedSearchesExpanded ? (
                    savedSearches.map((item) => (
                      <View key={item.id} style={styles.savedSearchCard}>
                        <View style={styles.savedSearchTextWrap}>
                          <AppText style={styles.savedSearchCardTitle}>
                            {item.pickupCity} - {item.dropoffCity || "будь-яке місце"}
                          </AppText>
                          <AppText style={styles.savedSearchCardMeta}>
                            Радіус: {Math.round(Number(item.radius) || 0)} км
                          </AppText>
                          {/* {!!item.dropoffCity && (
                            <AppText style={styles.savedSearchCardMeta}>
                              Розвантаження: {item.dropoffCity}
                            </AppText>
                          )} */}
                        </View>
                        <View style={styles.savedSearchButtons}>
                          <TouchableOpacity
                            style={styles.savedSearchApplyBtn}
                            onPress={() => applySavedSearch(item)}
                          >
                            <AppText style={styles.savedSearchApplyText}>
                              Застосувати
                            </AppText>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.savedSearchDeleteBtn}
                            disabled={deletingSearchId === item.id}
                            onPress={() => removeSavedSearch(item.id)}
                          >
                            <AppText style={styles.savedSearchDeleteText}>
                              {deletingSearchId === item.id ? "..." : "Видалити"}
                            </AppText>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  ) : (
                    <AppText style={styles.savedSearchHint}>
                      Обрані критерії згорнуті. Натисніть, щоб переглянути список.
                    </AppText>
                  )}
                </View>
                    </ScrollView>
                    </View>
                  </SafeAreaView>
                </View>
                </View>
              </View>
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

function formatDateFull(d) {
  if (!d) return "";
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

const styles = StyleSheet.create({
  filters: {
    padding: 12,
    paddingBottom: 12,
  },
  dateLabel: {
    marginTop: 2,
    marginBottom: 2,
    color: colors.text,
  },
  input: {
    marginVertical: 2,
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
  savedSearchAction: { marginTop: 4 },
  savedSearchSection: {
    marginTop: 8,
    padding: 10,
    borderRadius: 16,
    backgroundColor: colors.gray100,
  },
  savedSearchHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  savedSearchHeaderTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  savedSearchHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  savedSearchTitle: {
    fontWeight: "600",
    color: colors.text,
  },
  savedSearchSummary: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },
  savedSearchCount: {
    minWidth: 24,
    marginRight: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    textAlign: "center",
    color: colors.primary,
    backgroundColor: colors.primary100,
    fontWeight: "600",
  },
  savedSearchHint: {
    marginTop: 6,
    color: colors.textSecondary,
  },
  savedSearchCard: {
    marginTop: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  savedSearchTextWrap: {
    marginBottom: 8,
  },
  savedSearchCardTitle: {
    fontWeight: "600",
    color: colors.text,
  },
  savedSearchCardMeta: {
    marginTop: 2,
    color: colors.textSecondary,
  },
  savedSearchButtons: {
    flexDirection: "row",
  },
  savedSearchApplyBtn: {
    flex: 1,
    marginRight: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary100,
    alignItems: "center",
  },
  savedSearchApplyText: {
    color: colors.primary,
    fontWeight: "600",
  },
  savedSearchDeleteBtn: {
    flex: 1,
    marginLeft: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
  },
  savedSearchDeleteText: {
    color: colors.red,
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexBasis: "100%",
    marginTop: 2,
  },
  actionBtn: { flex: 1, marginHorizontal: 4 },
  closeBtn: { marginTop: 2 },
  modalRoot: {
    flex: 1,
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
    backgroundColor: "transparent",
    overflow: "visible",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalPanel: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: "90%",
    overflow: "hidden",
  },
  modalContent: {
    flex: 1,
  },
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
  // РїРѕРІРµСЂС‚Р°С” РєРѕРѕСЂРґРёРЅР°С‚Рё РІ РєС–Р»РѕРјРµС‚СЂР°С… Сѓ Р»РѕРєР°Р»СЊРЅС–Р№ РїР»РѕС‰РёРЅС–
  const kLat = 111.0;
  const kLon = 111.0 * Math.cos((lat0 * Math.PI) / 180);
  return { x: lon * kLon, y: lat * kLat };
}

function toLatLon(x, y, lat0) {
  const kLat = 111.0;
  const kLon = 111.0 * Math.cos((lat0 * Math.PI) / 180);
  return { lat: y / kLat, lon: x / kLon };
}

// РљСѓС‚Рё РїСЂСЏРјРѕРєСѓС‚РЅРёРєР° Р· РІС–РґСЃС‚СѓРїРѕРј dKm РІС–Рґ РїСЂСЏРјРѕС— Aв†’B
function rectCornersFromAB(A, B, dKm = 50) {
  const lat0 = (A.lat + B.lat) / 2;
  const a = toXY(A.lat, A.lon, lat0);
  const b = toXY(B.lat, B.lon, lat0);
  const vx = b.x - a.x,
    vy = b.y - a.y;
  const L = Math.hypot(vx, vy) || 1;
  const nx = -vy / L,
    ny = vx / L; // РѕРґРёРЅРёС‡РЅРёР№ РїРµСЂРїРµРЅРґРёРєСѓР»СЏСЂ
  const c1 = { x: a.x + nx * dKm, y: a.y + ny * dKm };
  const c2 = { x: a.x - nx * dKm, y: a.y - ny * dKm };
  const c3 = { x: b.x - nx * dKm, y: b.y - ny * dKm };
  const c4 = { x: b.x + nx * dKm, y: b.y + ny * dKm };
  // РЅР°Р·Р°Рґ Сѓ lat/lon
  const p1 = toLatLon(c1.x, c1.y, lat0);
  const p2 = toLatLon(c2.x, c2.y, lat0);
  const p3 = toLatLon(c3.x, c3.y, lat0);
  const p4 = toLatLon(c4.x, c4.y, lat0);
  return [p1, p2, p3, p4, p1]; // Р·Р°РјРєРЅРµРЅР° Р»С–РЅС–СЏ РґР»СЏ Polygon
}

// РџРµСЂРµРІС–СЂРєР°: С‡Рё Р»РµР¶РёС‚СЊ С‚РѕС‡РєР° P СѓСЃРµСЂРµРґРёРЅС– РїСЂСЏРјРѕРєСѓС‚РЅРёРєР° РІР·РґРѕРІР¶ Aв†’B Р· РЅР°РїС–РІС€РёСЂРёРЅРѕСЋ dKm
function isInsideCorridor(P, A, B, dKm = 50) {
  const lat0 = (A.lat + B.lat) / 2;
  const a = toXY(A.lat, A.lon, lat0);
  const b = toXY(B.lat, B.lon, lat0);
  const p = toXY(P.lat, P.lon, lat0);
  const vx = b.x - a.x,
    vy = b.y - a.y;
  const L = Math.hypot(vx, vy) || 1;
  const ux = vx / L,
    uy = vy / L; // РІР·РґРѕРІР¶
  const nx = -uy,
    ny = ux; // РїРѕРїРµСЂРµРє
  // РєРѕРѕСЂРґРёРЅР°С‚Рё С‚РѕС‡РєРё Сѓ Р±Р°Р·РёСЃС– (u,n)
  const t = (p.x - a.x) * ux + (p.y - a.y) * uy; // РІР·РґРѕРІР¶ 0..L
  const s = (p.x - a.x) * nx + (p.y - a.y) * ny; // РїРѕРїРµСЂРµРє -d..d
  return t >= 0 && t <= L && Math.abs(s) <= dKm;
}




