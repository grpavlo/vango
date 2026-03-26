import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Marker } from "react-native-maps";

import AppMap from "./AppMap";
import { colors } from "./Colors";

function formatDate(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}

function isOrderDateOutdated(order) {
  const backendOutdated = parseBooleanLike(order?.isDateOutdated);
  if (backendOutdated === true) return true;

  const staleDays = Number(order?.staleDays);
  if (Number.isFinite(staleDays) && staleDays > 0) return true;

  const staleSinceFromBackend = parseOrderDate(order?.staleSince);
  if (staleSinceFromBackend && new Date() >= staleSinceFromBackend) return true;

  const ref =
    order?.unloadTo ||
    order?.freeDateUntil ||
    order?.loadTo ||
    order?.loadFrom;
  if (!ref) return false;

  const baseDate = parseOrderDate(ref);
  if (!baseDate) return false;

  const staleSince = new Date(baseDate);
  staleSince.setHours(0, 0, 0, 0);
  staleSince.setDate(staleSince.getDate() + 1);

  return new Date() >= staleSince;
}

function parseBooleanLike(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return null;
}

function parseOrderDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  if (typeof value === "number") {
    const parsedNumberDate = new Date(value);
    return Number.isNaN(parsedNumberDate.getTime()) ? null : parsedNumberDate;
  }
  if (typeof value !== "string") return null;

  const raw = value.trim().replace(",", " ");
  if (!raw) return null;

  if (/^\d{10,13}$/.test(raw)) {
    const ts = Number(raw);
    const parsedTsDate = new Date(raw.length === 10 ? ts * 1000 : ts);
    if (!Number.isNaN(parsedTsDate.getTime())) return parsedTsDate;
  }

  const ddMmYyyyMatch = raw.match(
    /^(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?(?:\s+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/
  );
  if (ddMmYyyyMatch) {
    const day = Number(ddMmYyyyMatch[1]);
    const month = Number(ddMmYyyyMatch[2]);
    const now = new Date();
    let year = ddMmYyyyMatch[3] ? Number(ddMmYyyyMatch[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    const hours = ddMmYyyyMatch[4] ? Number(ddMmYyyyMatch[4]) : 0;
    const minutes = ddMmYyyyMatch[5] ? Number(ddMmYyyyMatch[5]) : 0;
    const seconds = ddMmYyyyMatch[6] ? Number(ddMmYyyyMatch[6]) : 0;
    const parsedDate = new Date(year, month - 1, day, hours, minutes, seconds);
    if (
      parsedDate.getFullYear() === year &&
      parsedDate.getMonth() === month - 1 &&
      parsedDate.getDate() === day &&
      parsedDate.getHours() === hours &&
      parsedDate.getMinutes() === minutes
    ) {
      return parsedDate;
    }
  }

  const isoLikeDateMatch = raw.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?/
  );
  if (isoLikeDateMatch) {
    const year = Number(isoLikeDateMatch[1]);
    const month = Number(isoLikeDateMatch[2]);
    const day = Number(isoLikeDateMatch[3]);
    const hours = isoLikeDateMatch[4] ? Number(isoLikeDateMatch[4]) : 0;
    const minutes = isoLikeDateMatch[5] ? Number(isoLikeDateMatch[5]) : 0;
    const seconds = isoLikeDateMatch[6] ? Number(isoLikeDateMatch[6]) : 0;
    const parsedDate = new Date(year, month - 1, day, hours, minutes, seconds);
    if (
      parsedDate.getFullYear() === year &&
      parsedDate.getMonth() === month - 1 &&
      parsedDate.getDate() === day
    ) {
      return parsedDate;
    }
  }

  const dateOnlyFromTextMatch = raw.match(
    /(\d{1,2}[.\-/]\d{1,2}(?:[.\-/]\d{2,4})?)/
  );
  if (dateOnlyFromTextMatch) {
    return parseOrderDate(dateOnlyFromTextMatch[1]);
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function OrderCard({
  order,
  onPress,
  highlighted,
  showResponseCount = true,
}) {
  const CITY_PIN_COLOR = "#fffb0b";
  const OUTDATED_MARKER_COLOR = "#85898f";
  const pickupCity =
    order.pickupCity ||
    ((order.pickupLocation || "").split(",")[1] || "").trim();
  const dropoffCity =
    order.dropoffCity ||
    ((order.dropoffLocation || "").split(",")[1] || "").trim();

  let region;
  const pLat = order.pickupLat;
  const pLon = order.pickupLon;
  const dLat = order.dropoffLat;
  const dLon = order.dropoffLon;

  if (pLat && pLon && dLat && dLon) {
    const midLat = (pLat + dLat) / 2;
    const midLon = (pLon + dLon) / 2;
    const latDelta = Math.max(Math.abs(pLat - dLat), 0.01) * 2.5;
    const lonDelta = Math.max(Math.abs(pLon - dLon), 0.01) * 2.5;
    region = {
      latitude: midLat,
      longitude: midLon,
      latitudeDelta: latDelta,
      longitudeDelta: lonDelta,
    };
  } else {
    region = {
      latitude: pLat || dLat || 50.45,
      longitude: pLon || dLon || 30.523,
      latitudeDelta: 0.4,
      longitudeDelta: 0.4,
    };
  }

  const isDateOutdated = isOrderDateOutdated(order);
  const isIntraCityOrder = Boolean(order?.isIntraCity);
  const mainPinColor = isDateOutdated
    ? OUTDATED_MARKER_COLOR
    : isIntraCityOrder
    ? CITY_PIN_COLOR
    : colors.orange;
  const secondPinColor = isDateOutdated
    ? OUTDATED_MARKER_COLOR
    : isIntraCityOrder
    ? CITY_PIN_COLOR
    : colors.green;
  const iconColor = isDateOutdated ? colors.gray500 : colors.green;
  const helperColor = isDateOutdated ? colors.gray500 : colors.red;

  const freeDateLabel = order.freeDate
    ? order.freeDateUntil
      ? `Вільна дата до ${formatDate(order.freeDateUntil)}`
      : "Вільна дата"
    : `Завантаження: ${formatDate(order.loadFrom)}`;

  const priceLabel = isIntraCityOrder
    ? "Водій пропонує ціну"
    : `Р¦С–РЅР°: ${Math.round(order.price)} РіСЂРЅ${
        order.agreedPrice ? " (Р”РѕРіРѕРІС–СЂРЅР°)" : ""
      }`;

  return (
    <View
      style={[
        styles.card,
        isDateOutdated && styles.cardOutdated,
        isIntraCityOrder && !isDateOutdated && styles.cardIntraCity,
        highlighted && styles.highlighted,
      ]}
    >
      <View style={styles.mapContainer}>
        <AppMap style={{ flex: 1 }} initialRegion={region}>
          {order.pickupLat && order.pickupLon && (
            <Marker
              coordinate={{
                latitude: Number(order.pickupLat),
                longitude: Number(order.pickupLon),
              }}
              pinColor={mainPinColor}
            />
          )}
          {order.dropoffLat && order.dropoffLon && (
            <Marker
              coordinate={{
                latitude: Number(order.dropoffLat),
                longitude: Number(order.dropoffLon),
              }}
              pinColor={secondPinColor}
            />
          )}
        </AppMap>
      </View>

      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={styles.infoContainer}
      >
        <Text style={[styles.route, isDateOutdated && styles.mutedText]}>
          {pickupCity} {"->"} {dropoffCity}

        </Text>
        <Text style={[styles.info, isDateOutdated && styles.mutedText]}>
          {freeDateLabel}
        </Text>
        <Text
          style={[
            styles.info,
            isDateOutdated && styles.mutedText,
            isIntraCityOrder && styles.hiddenPrice,
          ]}
        >
          {`Ціна: ${Math.round(order.price)} грн${
            order.agreedPrice ? " (Договірна)" : ""
          }`}
        </Text>
        {isIntraCityOrder && (
          <Text style={[styles.info, isDateOutdated && styles.mutedText]}>
            Водій пропонує ціну
          </Text>
        )}

        <View style={styles.iconRow}>
          <Ionicons
            name={order.payment === "card" ? "card" : "cash"}
            size={20}
            color={iconColor}
          />
          {order.loadHelp && (
            <Ionicons
              name="arrow-down-circle-outline"
              size={20}
              color={helperColor}
              style={{ marginLeft: 8 }}
            />
          )}
          {order.unloadHelp && (
            <Ionicons
              name="arrow-up-circle-outline"
              size={20}
              color={helperColor}
              style={{ marginLeft: 4 }}
            />
          )}
          {order.freeDate && (
            <Ionicons
              name="calendar-clear-outline"
              size={20}
              color={iconColor}
              style={{ marginLeft: 4 }}
            />
          )}
        </View>

        {showResponseCount && order.responseCount > 0 && (
          <View style={styles.responseCountRow}>
            <Ionicons name="people-outline" size={16} color="#6B7280" />
            <Text style={styles.responseCountText}>
              {order.responseCount}{" "}
              {order.responseCount === 1
                ? "водій обговорює"
                : "водіїв обговорюють"}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 8,
    borderRadius: 8,
    elevation: 2,
  },
  cardOutdated: {
    backgroundColor: "#F3F4F6",
  },
  cardIntraCity: {
    borderWidth: 1,
    borderColor: "#230bff",
  },
  highlighted: {
    borderWidth: 2,
    borderColor: colors.orange,
  },
  mapContainer: { height: 120, borderRadius: 8, overflow: "hidden" },
  infoContainer: { paddingVertical: 4 },
  route: { fontWeight: "bold", marginTop: 8 },
  info: { marginTop: 2, color: "#333" },
  hiddenPrice: { height: 0, opacity: 0, marginTop: 0, fontSize: 1 },
  mutedText: { color: colors.gray600 },
  iconRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  responseCountRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  responseCountText: {
    marginLeft: 4,
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
});
