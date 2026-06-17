import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  Linking,
  Platform,
  AppState,
  Keyboard,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import { Ionicons } from '@expo/vector-icons';
import {
  apiFetch,
  HOST_URL,
  respondToOrder,
  markCallMade,
  submitCallResult,
  confirmResponse,
  submitCounterOffer,
  submitCounterDecision,
  rejectResponse,
  withdrawResponse,
  fetchOrderResponses,
  fetchMyResponse,
} from '../api';
import { colors } from '../components/Colors';
import { useAuth } from '../AuthContext';
import StatusTimeline from '../components/StatusTimeline';
import AppText from '../components/AppText';
import Screen from '../components/Screen';
import { markOrderUpdatesSeen } from '../orderUpdates';
import { openLocationInMaps } from '../maps';
import DriverCompletionCelebration, {
  getOrderCompletionEarnings,
} from '../components/DriverCompletionCelebration';

const MAX_ACTIVE_RESPONSES = 5;

const FEATURE_FLAGS = {
  NEW_RESPONSE_FLOW: true,
  SHOW_CARGO_DIMENSIONS: true,
  SHOW_DISTANCE: true,
  SECONDARY_CTA: true,
  DISCUSSING_STATE: true,
};

const CUSTOMER_IN_PROGRESS_HISTORY_DELAY_MS = 3 * 24 * 60 * 60 * 1000;
const MOVE_TO_HISTORY_TITLE =
  "\u041f\u0435\u0440\u0435\u043c\u0456\u0441\u0442\u0438 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u0432 \u0456\u0441\u0442\u043e\u0440\u0456\u044e";
const MOVE_TO_HISTORY_WAIT_TEXT =
  "\u041a\u043d\u043e\u043f\u043a\u0430 \u043f\u0435\u0440\u0435\u043c\u0456\u0449\u0435\u043d\u043d\u044f \u0432 \u0456\u0441\u0442\u043e\u0440\u0456\u044e \u0437'\u044f\u0432\u0438\u0442\u044c\u0441\u044f";

const statusLabels = {
  CREATED: 'Створено',
  ACCEPTED: 'Водій в дорозі',
  IN_PROGRESS: 'Водій отримав вантаж',
  DELIVERED: 'Замовлення доставлено',
  COMPLETED: 'Виконано',
  PENDING: 'Очікує підтвердження',
  CANCELLED: 'Скасовано',
  REJECTED: 'Відмовлено',
};

const responseStatusLabelsDriver = {
  RESPONDED: 'Ви відгукнулися',
  CALL_MADE: 'Дзвінок здійснений',
  PENDING_CONFIRM: 'Очікується рішення замовника',
  DISCUSSING: 'Ведеться обговорення',
  COUNTER_OFFERED: 'Очікується рішення водія',
  CONFIRMED: 'Підтверджено',
  DECLINED: 'Відхилено',
  REJECTED: 'Відхилено замовником',
  EXPIRED: 'Час вичерпано',
};

const responseStatusLabelsCustomer = {
  RESPONDED: 'Відгукнувся',
  CALL_MADE: 'Дзвонив',
  PENDING_CONFIRM: 'Готовий виконати',
  DISCUSSING: 'Обговорює',
  COUNTER_OFFERED: 'Очікується відповідь водія',
  CONFIRMED: 'Підтверджено',
  DECLINED: 'Відмовився',
  REJECTED: 'Відхилено',
  EXPIRED: 'Час вичерпано',
};

const responseStatusIcons = {
  RESPONDED: '🟢',
  CALL_MADE: '📞',
  PENDING_CONFIRM: '⏳',
  DISCUSSING: '🟡',
  COUNTER_OFFERED: '\uD83D\uDCAC',
  CONFIRMED: '✅',
  DECLINED: '❌',
  REJECTED: '❌',
  EXPIRED: '⏰',
};

const CITY_ARRIVAL_ETA_OPTIONS = [
  { value: 'UP_TO_15_MIN', label: 'до 15 хв' },
  { value: 'UP_TO_30_MIN', label: 'до 30 хв' },
  { value: 'UP_TO_1_HOUR', label: 'до 1 год' },
  { value: 'SEVERAL_HOURS', label: 'кілька годин' },
  { value: 'AT_APPOINTED_TIME', label: 'на призначений час' },
];

const CITY_ARRIVAL_ETA_LABELS = CITY_ARRIVAL_ETA_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const responseStatusIconsSafe = {
  RESPONDED: '\uD83D\uDFE2',
  CALL_MADE: '\uD83D\uDCDE',
  PENDING_CONFIRM: '\u23F3',
  DISCUSSING: '\uD83D\uDFE1',
  COUNTER_OFFERED: '\uD83D\uDCAC',
  CONFIRMED: '\u2705',
  DECLINED: '\u274C',
  REJECTED: '\u274C',
  EXPIRED: '\u23F0',
};

function normalizeCityKey(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function getOrderCityKey(order) {
  const pickup = normalizeCityKey(order?.pickupCity);
  if (pickup) return pickup;
  return normalizeCityKey(order?.dropoffCity);
}

function formatCityOfferSummary(response) {
  if (!response) return null;
  const hourly = Number(response.hourlyRate);
  const minHours = Number(response.minHours);
  const eta = CITY_ARRIVAL_ETA_LABELS[response.arrivalEta] || response.arrivalEta || '';
  if (!Number.isFinite(hourly) || !Number.isFinite(minHours)) return null;
  return `${Math.round(hourly)} грн/год • мін ${Math.round(minHours)} год • ${eta}`;
}

function formatResponseFinalPrice(response) {
  const offered = Number(response?.finalPriceOffer);
  if (!Number.isFinite(offered) || offered <= 0) return null;
  return `${Math.round(offered)} грн`;
}

const historyActorLabels = {
  DRIVER: 'Водій',
  CUSTOMER: 'Замовник',
  BOTH: 'Користувач',
};

const priceFieldLabels = {
  finalPrice: 'фінальну ціну',
  price: 'ціну',
};

function statusColor(status) {
  switch (status) {
    case 'CREATED':
      return colors.green;
    case 'PENDING':
      return '#FBBF24';
    case 'REJECTED':
    case 'CANCELLED':
      return colors.red;
    case 'COMPLETED':
      return colors.gray900;
    default:
      return colors.green;
  }
}

function formatTime(dateStr) {
  const d = toLocalDate(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(dateStr) {
  const d = toLocalDate(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function toLocalDate(value) {
  if (!value) return new Date(NaN);
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

function parseBooleanLike(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return null;
}

function isOrderDateOutdated(order) {
  const backendOutdated = parseBooleanLike(order?.isDateOutdated);
  if (backendOutdated === true) return true;

  const staleDays = Number(order?.staleDays);
  if (Number.isFinite(staleDays) && staleDays > 0) return true;

  const staleSince = toLocalDate(order?.staleSince);
  if (!Number.isNaN(staleSince.getTime()) && new Date() >= staleSince) return true;

  const referenceValue = order?.freeDate
    ? order?.freeDateUntil || order?.unloadTo || order?.loadTo || order?.loadFrom
    : order?.unloadTo || order?.loadTo || order?.loadFrom;
  const referenceDate = toLocalDate(referenceValue);
  if (Number.isNaN(referenceDate.getTime())) return false;

  const staleStart = new Date(referenceDate);
  staleStart.setHours(0, 0, 0, 0);
  staleStart.setDate(staleStart.getDate() + 1);
  return new Date() >= staleStart;
}

function formatDateTimeLocal(value) {
  const d = toLocalDate(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => (n < 10 ? `0${n}` : n);
  const date = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${date} ${time}`;
}

function calcVolume(dimensions) {
  if (!dimensions) return null;
  const parts = dimensions.split('x').map((n) => parseFloat(n));
  if (parts.length !== 3 || parts.some((n) => isNaN(n))) return null;
  return parts[0] * parts[1] * parts[2];
}

function fullPhotoUrl(path) {
  if (!path) return null;
  if (/^https?:/i.test(path)) return path;
  return `${HOST_URL}${path}`;
}

function formatPriceValue(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return `${Math.round(num).toLocaleString('uk-UA')} грн`;
}

function shouldShowAgreedPriceOnly(order) {
  const price = Number(order?.price);
  return Boolean(order?.agreedPrice) && (!Number.isFinite(price) || price <= 0);
}

function formatOrderPriceValue(order) {
  const price = Number(order?.price);
  if (shouldShowAgreedPriceOnly(order)) return 'Договірна';
  if (!Number.isFinite(price)) return order?.agreedPrice ? 'Договірна' : '-';
  return `${Math.round(price)} грн${order?.agreedPrice ? ' (Договірна)' : ''}`;
}

function formatHistoryEntries(history) {
  if (!Array.isArray(history)) return [];
  const acceptedEntry = history.find((entry) => entry?.status === 'ACCEPTED' && entry?.at);
  const acceptedAtMs = acceptedEntry ? new Date(acceptedEntry.at).getTime() : null;
  return history.filter((entry) => {
    if (entry?.status !== 'PRICE_UPDATED' || entry?.field !== 'finalPrice') return true;
    if (!acceptedAtMs || !Number.isFinite(acceptedAtMs)) return false;
    const entryAtMs = new Date(entry.at).getTime();
    return Number.isFinite(entryAtMs) && entryAtMs >= acceptedAtMs;
  }).map((entry) => {
    if (entry.status === 'PRICE_UPDATED') {
      const actor =
        historyActorLabels[entry.changedByRole] ||
        (entry.changedByRole ? 'Користувач' : 'Система');
      const fieldLabel = priceFieldLabels[entry.field] || priceFieldLabels.price;
      const from = formatPriceValue(entry.fromPrice);
      const to = formatPriceValue(entry.toPrice);
      let label;
      if (from && to) {
        label = `${actor} змінив ${fieldLabel} з ${from} на ${to}`;
      } else if (to) {
        label = `${actor} встановив ${fieldLabel} ${to}`;
      } else {
        label = `${actor} змінив ${fieldLabel}`;
      }
      return { ...entry, label };
    }
    return {
      ...entry,
      label: entry.label || statusLabels[entry.status] || entry.status,
    };
  });
}

function formatMinutesLeft(expiresAt) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt) - new Date();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 60000);
}

function toPhotoArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
  if (!value) return [];
  const single = String(value).trim();
  return single ? [single] : [];
}

function uniqPhotos(items) {
  return Array.from(new Set((items || []).filter(Boolean)));
}

function getHistoryPhotosByStatus(history, targetStatus) {
  if (!Array.isArray(history)) return [];
  const photos = [];
  history.forEach((entry) => {
    if (entry?.status !== targetStatus) return;
    photos.push(...toPhotoArray(entry?.photos));
    photos.push(...toPhotoArray(entry?.photo));
  });
  return uniqPhotos(photos);
}

function parseOrderHistory(order) {
  if (Array.isArray(order?.history)) return order.history;
  if (typeof order?.history === 'string') {
    try {
      const parsed = JSON.parse(order.history);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getLatestStatusTimeMs(order, status) {
  const history = parseOrderHistory(order);
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    if (!entry || entry.status !== status || !entry.at) continue;
    const ms = new Date(entry.at).getTime();
    if (Number.isFinite(ms) && ms > 0) return ms;
  }
  const fallbackMs = new Date(order?.updatedAt || 0).getTime();
  return Number.isFinite(fallbackMs) && fallbackMs > 0 ? fallbackMs : 0;
}

function canCustomerMoveInProgressOrderToHistory(order, role, currentTimeMs = Date.now()) {
  if (role !== 'CUSTOMER' || order?.status !== 'IN_PROGRESS') return false;
  const inProgressAtMs = getLatestStatusTimeMs(order, 'IN_PROGRESS');
  if (!inProgressAtMs) return false;
  return currentTimeMs - inProgressAtMs >= CUSTOMER_IN_PROGRESS_HISTORY_DELAY_MS;
}

function getMoveToHistoryWaitText(order, role, currentTimeMs = Date.now()) {
  if (role !== 'CUSTOMER' || order?.status !== 'IN_PROGRESS') return '';
  const inProgressAtMs = getLatestStatusTimeMs(order, 'IN_PROGRESS');
  if (!inProgressAtMs) return '';
  const remainingMs = CUSTOMER_IN_PROGRESS_HISTORY_DELAY_MS - (currentTimeMs - inProgressAtMs);
  if (remainingMs <= 0) return '';
  const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
  if (remainingHours >= 24) {
    return `${MOVE_TO_HISTORY_WAIT_TEXT} через ${Math.ceil(remainingHours / 24)} дн.`;
  }
  return `${MOVE_TO_HISTORY_WAIT_TEXT} через ${remainingHours} год.`;
}

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function isStreetLike(value) {
  return /(вул|вулиця|ул|улица|просп|проспект|бульвар|бул\.?|провул|пров\.?|площа|пл\.?|наб(ережна)?|шосе|дорога|алея|street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?)/i.test(
    normalizeText(value)
  );
}

function isLikelyHouseNumber(value) {
  const text = normalizeText(value);
  if (!text) return false;
  if (/\s/.test(text)) return false;
  // Postal indexes like 18005 should not be treated as house numbers.
  if (/^\d{5,}$/.test(text)) return false;
  return /^\d{1,4}[A-Za-zА-Яа-яІіЇїЄє]?(?:[\/-]\d{1,4}[A-Za-zА-Яа-яІіЇїЄє]?)?$/.test(text);
}

function formatStreetAndHouse(value) {
  const parts = normalizeText(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) {
    if (isStreetLike(parts[0]) && /\d/.test(parts[0])) return parts[0];
    return isLikelyHouseNumber(parts[0]) ? parts[0] : '';
  }

  const combinedPart = parts.find((part) => isStreetLike(part) && /\d/.test(part));
  if (combinedPart) return combinedPart;

  for (let i = 1; i < parts.length; i += 1) {
    if (!isLikelyHouseNumber(parts[i])) continue;
    if (!isStreetLike(parts[i - 1])) continue;
    return `${parts[i - 1]}, ${parts[i]}`;
  }
  return '';
}

function prependCity(city, value) {
  const cityPart = normalizeText(city);
  const text = normalizeText(value);
  if (!cityPart) return text;
  if (!text) return cityPart;
  if (text.toLowerCase().includes(cityPart.toLowerCase())) return text;
  return `${cityPart}, ${text}`;
}

function formatOrderAddress(city, address, location) {
  const streetAndHouse = formatStreetAndHouse(address) || formatStreetAndHouse(location);
  if (streetAndHouse) return prependCity(city, streetAndHouse);

  const locationText = normalizeText(location);
  const addressText = normalizeText(address);
  if (locationText) {
    if (addressText && !locationText.toLowerCase().includes(addressText.toLowerCase())) {
      return `${addressText}, ${locationText}`;
    }
    return locationText;
  }

  if (addressText) return prependCity(city, addressText);

  return normalizeText(city) || '-';
}

export default function OrderDetailScreen({ route, navigation }) {
  const params = route?.params ?? {};
  const initialOrder = params.order ?? null;
  const orderId = params.orderId ?? params.order?.id ?? null;
  const notificationReminderStep = params.notificationReminderStep ?? null;
  const [order, setOrder] = useState(initialOrder);
  const [previewPhotoUri, setPreviewPhotoUri] = useState(null);
  const photoPreviewTouchStartRef = useRef(null);
  const closePhotoPreview = useCallback(() => setPreviewPhotoUri(null), []);

  function handlePhotoPreviewTouchStart(event) {
    const touch = event.nativeEvent?.touches?.[0] || event.nativeEvent;
    photoPreviewTouchStartRef.current = {
      x: touch?.pageX || 0,
      y: touch?.pageY || 0,
      at: Date.now(),
    };
  }

  function handlePhotoPreviewTouchEnd(event) {
    const start = photoPreviewTouchStartRef.current;
    photoPreviewTouchStartRef.current = null;
    if (!start) return;
    const touch =
      event.nativeEvent?.changedTouches?.[0] ||
      event.nativeEvent?.touches?.[0] ||
      event.nativeEvent;
    const dx = (touch?.pageX || 0) - start.x;
    const dy = (touch?.pageY || 0) - start.y;
    const elapsed = Math.max(Date.now() - start.at, 1);
    const distance = Math.max(Math.abs(dx), Math.abs(dy));
    const velocity = distance / elapsed;
    if (distance > 45 || velocity > 0.35) {
      closePhotoPreview();
    }
  }
  const { token, role } = useAuth();

  // Legacy reserve state (kept for old flow fallback)
  const [reserved, setReserved] = useState(false);
  const [reservedUntil, setReservedUntil] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [phone, setPhone] = useState(null);
  const [customerName, setCustomerName] = useState(null);

  // New response flow state
  const [myResponse, setMyResponse] = useState(null);
  const [responses, setResponses] = useState([]);
  const [showResultScreen, setShowResultScreen] = useState(false);
  const [respondLoading, setRespondLoading] = useState(false);
  const [confirmTimeLeft, setConfirmTimeLeft] = useState(null);
  const [actionHeight, setActionHeight] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [finalPrice, setFinalPrice] = useState(order?.price ? String(order.price) : '');
  const [cityHourlyRate, setCityHourlyRate] = useState('');
  const [cityMinHours, setCityMinHours] = useState('');
  const [cityArrivalEta, setCityArrivalEta] = useState('UP_TO_30_MIN');
  const [cityOfferExpanded, setCityOfferExpanded] = useState(false);
  const [counterOfferModalVisible, setCounterOfferModalVisible] = useState(false);
  const [counterOfferValue, setCounterOfferValue] = useState('');
  const [counterOfferResponse, setCounterOfferResponse] = useState(null);
  const [counterOfferLoading, setCounterOfferLoading] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [completionCelebration, setCompletionCelebration] = useState(null);
  const wsRef = useRef(null);
  const wsShouldReconnectRef = useRef(true);
  const wsReconnectTimerRef = useRef(null);
  const priceInputRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const callingRef = useRef(false);

  const useNewFlow = FEATURE_FLAGS.NEW_RESPONSE_FLOW;
  const HALF_FINAL_PRICE_INPUT_HEIGHT = 0;
  const actionAreaBottom = Platform.OS === 'ios' ? keyboardHeight + 20 : 20;
  const isCityOrder = Boolean(order?.isIntraCity);
  const cityOrderKey = useMemo(() => getOrderCityKey(order), [order?.pickupCity, order?.dropoffCity, order?.id]);
  const cityTemplateStorageKey = useMemo(
    () => (cityOrderKey ? `city-offer-template:${cityOrderKey}` : null),
    [cityOrderKey]
  );
  const cityOfferTotalPreview = useMemo(() => {
    const hourly = Number(cityHourlyRate);
    const hours = Number(cityMinHours);
    if (!Number.isFinite(hourly) || !Number.isFinite(hours) || hourly <= 0 || hours <= 0) return null;
    return Math.round(hourly * hours);
  }, [cityHourlyRate, cityMinHours]);

  const contactPhone = useMemo(() => {
    if (useNewFlow) return myResponse?.customerPhone || null;
    return order ? phone || (order.customer ? order.customer.phone : null) : phone;
  }, [useNewFlow, myResponse, order, phone]);

  const contactName = useMemo(() => {
    if (useNewFlow) return myResponse?.customerName || null;
    return order ? customerName || (order.customer ? order.customer.name : null) : customerName;
  }, [useNewFlow, myResponse, order, customerName]);

  const showContact = useMemo(() => {
    if (useNewFlow) return Boolean(myResponse?.customerPhone);
    return Boolean(order && (order.reservedBy || order.driverId));
  }, [useNewFlow, myResponse, order, myResponse?.customerPhone]);

  const effectiveMyResponseStatus = useMemo(() => {
    const status = myResponse?.status || null;
    if (!status) return null;
    if (status === 'PENDING_CONFIRM' && order?.status && order.status !== 'CREATED') {
      if (['ACCEPTED', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED'].includes(order.status)) {
        return 'CONFIRMED';
      }
    }
    return status;
  }, [myResponse?.status, order?.status]);

  const assignedDriver = useMemo(() => {
    if (!order) return null;
    return order.driver || order.reservedDriver || order.candidateDriver || null;
  }, [order?.driver, order?.reservedDriver, order?.candidateDriver]);

  const driverPhotoUri = useMemo(
    () => fullPhotoUrl(assignedDriver?.driverProfile?.selfiePhoto),
    [assignedDriver?.driverProfile?.selfiePhoto]
  );

  const openDriverProfile = useCallback(() => {
    if (!assignedDriver) return;
    navigation.navigate('DriverProfile', { driver: assignedDriver });
  }, [assignedDriver, navigation]);

  const volume = order ? calcVolume(order.dimensions) : null;

  const cargoVolumeDisplay = useMemo(() => {
    if (order?.cargoVolume && parseFloat(order.cargoVolume) > 0) {
      return parseFloat(order.cargoVolume).toFixed(2);
    }
    if (order?.cargoLength && order?.cargoWidth && order?.cargoHeight) {
      const v = parseFloat(order.cargoLength) * parseFloat(order.cargoWidth) * parseFloat(order.cargoHeight);
      return v > 0 ? v.toFixed(2) : null;
    }
    return volume ? volume.toFixed(2) : null;
  }, [order?.cargoVolume, order?.cargoLength, order?.cargoWidth, order?.cargoHeight, volume]);

  const formattedHistory = useMemo(
    () => formatHistoryEntries(order?.history),
    [order?.history]
  );
  const receivedStatusPhotos = useMemo(
    () => getHistoryPhotosByStatus(order?.history, 'IN_PROGRESS'),
    [order?.history]
  );
  const deliveredStatusPhotos = useMemo(
    () => getHistoryPhotosByStatus(order?.history, 'DELIVERED'),
    [order?.history]
  );
  const orderCreationPhotos = useMemo(() => {
    const statusPhotoSet = new Set([...receivedStatusPhotos, ...deliveredStatusPhotos]);
    return toPhotoArray(order?.photos).filter((photo) => !statusPhotoSet.has(photo));
  }, [order?.photos, receivedStatusPhotos, deliveredStatusPhotos]);
  const photoSections = useMemo(
    () => [
      { key: 'order', title: '1. Замовлення', photos: orderCreationPhotos },
      { key: 'received', title: '2. Отримання', photos: receivedStatusPhotos },
      { key: 'delivered', title: '3. Доставка', photos: deliveredStatusPhotos },
    ].filter((section) => section.photos.length > 0),
    [orderCreationPhotos, receivedStatusPhotos, deliveredStatusPhotos]
  );
  const pickupAddressDisplay = useMemo(
    () => formatOrderAddress(order?.pickupCity, order?.pickupAddress, order?.pickupLocation),
    [order?.pickupCity, order?.pickupAddress, order?.pickupLocation]
  );
  const dropoffAddressDisplay = useMemo(
    () => formatOrderAddress(order?.dropoffCity, order?.dropoffAddress, order?.dropoffLocation),
    [order?.dropoffCity, order?.dropoffAddress, order?.dropoffLocation]
  );

  const refreshOrderState = useCallback(async () => {
    const id = initialOrder ? initialOrder.id : orderId;
    if (!id || !token) return;
    try {
      const data = await apiFetch(`/orders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrder(data);

      if (useNewFlow && role === 'CUSTOMER') {
        try {
          const nextResponses = await fetchOrderResponses(id, token);
          setResponses(Array.isArray(nextResponses) ? nextResponses : []);
        } catch {
          setResponses([]);
        }
      } else if (useNewFlow && role === 'DRIVER') {
        try {
          const resp = await fetchMyResponse(id, token);
          setMyResponse(resp);
        } catch {
          setMyResponse(null);
        }
      }
    } catch (err) {
      console.log(err);
    }
  }, [initialOrder, orderId, token, role, useNewFlow]);
  // ── WebSocket ──
  useEffect(() => {
    wsShouldReconnectRef.current = true;
    connectWs();
    return () => {
      wsShouldReconnectRef.current = false;
      if (wsReconnectTimerRef.current) {
        clearTimeout(wsReconnectTimerRef.current);
        wsReconnectTimerRef.current = null;
      }
      if (wsRef.current) wsRef.current.close();
    };
  }, [token, initialOrder?.id, orderId]);

  useEffect(() => {
    setFinalPrice(order?.price ? String(order.price) : '');
  }, [order?.price]);

  useEffect(() => {
    if (!order?.id || !role || !token) return;
    markOrderUpdatesSeen(role, token, order).catch((err) =>
      console.log('mark order updates seen error', err)
    );
  }, [order?.id, order?.status, order?.history, order?.updatedAt, role, token]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (role !== 'DRIVER' || !isCityOrder || !cityTemplateStorageKey) return;
    if (myResponse) return;

    let isMounted = true;
    setCityHourlyRate('');
    setCityMinHours('');
    setCityArrivalEta('UP_TO_30_MIN');

    async function loadTemplate() {
      try {
        const saved = await AsyncStorage.getItem(cityTemplateStorageKey);
        if (!saved || !isMounted) return;
        const parsed = JSON.parse(saved);
        if (parsed?.hourlyRate) setCityHourlyRate(String(parsed.hourlyRate));
        if (parsed?.minHours) setCityMinHours(String(parsed.minHours));
        if (parsed?.arrivalEta) setCityArrivalEta(parsed.arrivalEta);
      } catch {}
    }

    loadTemplate();
    return () => {
      isMounted = false;
    };
  }, [role, isCityOrder, cityTemplateStorageKey, myResponse?.id, order?.id]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event?.endCoordinates?.height || 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  function connectWs() {
    if (!token) return;
    if (wsReconnectTimerRef.current) {
      clearTimeout(wsReconnectTimerRef.current);
      wsReconnectTimerRef.current = null;
    }
    if (wsRef.current) wsRef.current.close();
    const url = `${HOST_URL.replace(/^http/, 'ws')}/api/orders/stream`;
    const ws = new WebSocket(url, null, {
      headers: { Authorization: `Bearer ${token}` },
    });
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        const id = initialOrder ? initialOrder.id : orderId;
        if (id != null && data?.id != null && String(data.id) === String(id)) {
          refreshOrderState();
        }
      } catch (e) {
        console.log('ws message error', e);
      }
    };
    ws.onclose = () => {
      if (!wsShouldReconnectRef.current || !token) return;
      wsReconnectTimerRef.current = setTimeout(() => {
        connectWs();
      }, 1500);
    };
    ws.onerror = (e) => console.log('ws error', e.message);
  }

  // в”Ђв”Ђ Fetch order в”Ђв”Ђ
  useEffect(() => {
    refreshOrderState();
    const sub = navigation.addListener('focus', refreshOrderState);
    return sub;
  }, [navigation, refreshOrderState]);

  // ── Fetch my response (new flow) ──
  useEffect(() => {
    if (!useNewFlow || role !== 'DRIVER' || !order?.id || !token) return;
    loadMyResponse();
  }, [useNewFlow, role, order?.id, token]);

  async function loadMyResponse() {
    try {
      const resp = await fetchMyResponse(order.id, token);
      setMyResponse(resp);
    } catch {
      setMyResponse(null);
    }
  }

  // ── Fetch responses for customer ──
  useEffect(() => {
    if (!useNewFlow || role !== 'CUSTOMER' || !order?.id || !token) return;
    loadResponses();
  }, [useNewFlow, role, order?.id, token]);

  async function loadResponses() {
    try {
      const data = await fetchOrderResponses(order.id, token);
      setResponses(Array.isArray(data) ? data : []);
    } catch {
      setResponses([]);
    }
  }

  // ── Legacy reserve state ──
  useEffect(() => {
    if (!useNewFlow && order?.reservedBy && order?.reservedUntil) {
      const until = new Date(order.reservedUntil);
      if (until > new Date()) setReserved(true);
      setReservedUntil(until);
    }
  }, [order, useNewFlow]);

  useEffect(() => {
    if (useNewFlow) return;
    async function loadPhone() {
      if (reserved && !phone) {
        try {
          const stored = await AsyncStorage.getItem('reservedPhones');
          if (stored) {
            const map = JSON.parse(stored);
            if (map[order.id]) {
              setPhone(map[order.id].phone);
              setCustomerName(map[order.id].name);
            }
          }
        } catch {}
      }
    }
    loadPhone();
  }, [reserved, phone, order?.id, useNewFlow]);

  // Legacy reserve timer
  useEffect(() => {
    if (useNewFlow) return;
    let interval;
    if (reserved && reservedUntil) {
      const update = () => {
        const diff = reservedUntil - new Date();
        if (diff <= 0) {
          clearInterval(interval);
          cancelReserve();
        } else {
          setTimeLeft(diff);
        }
      };
      update();
      interval = setInterval(update, 1000);
    }
    return () => clearInterval(interval);
  }, [reserved, reservedUntil, useNewFlow]);

  // ── PENDING_CONFIRM timer ──
  useEffect(() => {
    if (!myResponse || effectiveMyResponseStatus !== 'PENDING_CONFIRM' || !myResponse.expiresAt) return;
    const update = () => {
      const diff = new Date(myResponse.expiresAt) - new Date();
      setConfirmTimeLeft(diff > 0 ? diff : 0);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [effectiveMyResponseStatus, myResponse?.expiresAt, myResponse]);

  // ── AppState listener for post-call detection ──
  useEffect(() => {
    if (!useNewFlow) return;
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        callingRef.current &&
        myResponse
      ) {
        callingRef.current = false;
        if (!isCityOrder && (myResponse.status === 'RESPONDED' || myResponse.status === 'CALL_MADE')) {
          setShowResultScreen(true);
        }
      }
      appStateRef.current = nextAppState;
    });
    return () => subscription?.remove();
  }, [useNewFlow, myResponse, isCityOrder]);

  // ── New flow: Respond ──
  async function handleRespond() {
    try {
      setRespondLoading(true);
      let payload = {};

      if (isCityOrder) {
        const hourlyRate = Number(cityHourlyRate);
        const minHours = Number(cityMinHours);
        if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
          Alert.alert('Помилка', 'Вкажіть коректну ставку за годину');
          setRespondLoading(false);
          return;
        }
        if (!Number.isFinite(minHours) || minHours <= 0) {
          Alert.alert('Помилка', 'Вкажіть коректний мінімум годин');
          setRespondLoading(false);
          return;
        }
        payload = {
          hourlyRate: String(Math.round(hourlyRate)),
          minHours: String(Math.round(minHours)),
          arrivalEta: cityArrivalEta,
        };
      } else if (finalPrice !== '' && !Number.isNaN(Number(finalPrice)) && Number(finalPrice) > 0) {
        payload = { finalPrice: String(Math.round(Number(finalPrice))) };
      }

      const resp = await respondToOrder(order.id, token, payload);
      setMyResponse(resp);
      if (isCityOrder && cityTemplateStorageKey) {
        try {
          await AsyncStorage.setItem(
            cityTemplateStorageKey,
            JSON.stringify({
              hourlyRate: payload.hourlyRate,
              minHours: payload.minHours,
              arrivalEta: payload.arrivalEta,
            })
          );
        } catch {}
      }
      setRespondLoading(false);
    } catch (err) {
      setRespondLoading(false);
      const msg = err?.message || '';
      if (msg.includes('limit') || msg.includes('MAX')) {
        Alert.alert('Ліміт відгуків', 'Завершіть поточні обговорення перед новими відгуками');
      } else {
        Alert.alert('Помилка', msg || 'Не вдалося відгукнутися');
      }
    }
  }

  async function handleRespondImmediate() {
    if (isCityOrder) return;
    try {
      setRespondLoading(true);
      const payload = { immediateConfirm: true };
      if (finalPrice !== '' && !Number.isNaN(Number(finalPrice)) && Number(finalPrice) > 0) {
        payload.finalPrice = String(Math.round(Number(finalPrice)));
      }
      const resp = await respondToOrder(order.id, token, payload);
      setMyResponse(resp);
      setRespondLoading(false);
    } catch (err) {
      setRespondLoading(false);
      const msg = err?.message || '';
      if (msg.includes('limit') || msg.includes('MAX')) {
        Alert.alert('Ліміт відгуків', 'Завершіть поточні обговорення перед новими відгуками');
      } else {
        Alert.alert('Помилка', msg || 'Не вдалося підтвердити');
      }
    }
  }

  // ── New flow: Make call ──
  function handleCall() {
    if (!contactPhone) return;
    callingRef.current = true;
    if (myResponse && myResponse.status === 'RESPONDED') {
      markCallMade(order.id, myResponse.id, token)
        .then((resp) => setMyResponse(resp))
        .catch(() => {});
    }
    Linking.openURL(`tel:${contactPhone}`);
  }

  // ── New flow: Submit call result ──
  async function handleCallResult(result) {
    try {
      const resp = await submitCallResult(order.id, myResponse.id, token, result);
      setMyResponse(resp);
      setShowResultScreen(false);
      if (result === 'declined') {
        navigation.goBack();
      }
    } catch (err) {
      Alert.alert('Помилка', err?.message || 'Не вдалося зберегти результат');
    }
  }

  // ── New flow: Cancel request ──
  async function handleWithdraw() {
    try {
      await withdrawResponse(order.id, myResponse.id, token);
      setMyResponse(null);
    } catch (err) {
      Alert.alert('Помилка', err?.message || 'Не вдалося відкликати відгук');
    }
  }

  // ── New flow: Re-call from DISCUSSING ──
  function handleReCall() {
    callingRef.current = true;
    Linking.openURL(`tel:${contactPhone}`);
  }

  // ── New flow: Agree from DISCUSSING ──
  async function handleAgreeFromDiscussing() {
    try {
      const resp = await submitCallResult(order.id, myResponse.id, token, 'agreed');
      setMyResponse(resp);
    } catch (err) {
      Alert.alert('Помилка', err?.message || 'Не вдалося підтвердити');
    }
  }

  // ── Customer: confirm/reject response ──
  async function handleConfirmResponse(responseId) {
    try {
      const updated = await confirmResponse(order.id, responseId, token);
      setOrder(updated);
      loadResponses();
    } catch (err) {
      Alert.alert('Помилка', err?.message || 'Не вдалося підтвердити');
    }
  }

  function openCounterOfferModal(response) {
    const baseValue = Number(response?.customerCounterPrice);
    const fallbackValue = Number(response?.finalPriceOffer);
    const initial = Number.isFinite(baseValue) && baseValue > 0
      ? String(Math.round(baseValue))
      : Number.isFinite(fallbackValue) && fallbackValue > 0
      ? String(Math.round(fallbackValue))
      : '';
    setCounterOfferResponse(response || null);
    setCounterOfferValue(initial);
    setCounterOfferModalVisible(true);
  }

  function closeCounterOfferModal() {
    if (counterOfferLoading) return;
    setCounterOfferModalVisible(false);
    setCounterOfferResponse(null);
    setCounterOfferValue('');
  }

  async function submitCounterOfferForSelected() {
    const value = Number(counterOfferValue);
    if (!Number.isFinite(value) || value <= 0 || !counterOfferResponse?.id) {
      Alert.alert('Помилка', 'Вкажіть коректну ціну');
      return;
    }
    try {
      setCounterOfferLoading(true);
      await submitCounterOffer(order.id, counterOfferResponse.id, token, String(Math.round(value)));
      closeCounterOfferModal();
      await refreshOrderState();
    } catch (err) {
      Alert.alert('Помилка', err?.message || 'Не вдалося надіслати контрпропозицію');
    } finally {
      setCounterOfferLoading(false);
    }
  }

  function promptConfirmWithPrice(response) {
    const priceText = formatResponseFinalPrice(response) || '-';
    Alert.alert('Ви погоджуєтесь із фінальною ціною?', 'Запропонована: ' + priceText, [
      { text: 'Скасувати', style: 'cancel' },
      { text: 'Запропонувати іншу ціну', onPress: () => openCounterOfferModal(response) },
      { text: 'Погодитись', onPress: () => handleConfirmResponse(response.id) },
    ]);
  }

  async function handleDriverCounterDecision(decision) {
    if (!myResponse?.id) return;
    try {
      const result = await submitCounterDecision(order.id, myResponse.id, token, decision);
      if (decision === 'accept' && result?.id) {
        setOrder(result);
      } else if (decision === 'reject') {
        setMyResponse(result);
      }
      await refreshOrderState();
    } catch (err) {
      Alert.alert('Помилка', err?.message || 'Не вдалося обробити контрпропозицію');
    }
  }

  async function handleRejectResponse(responseId) {
    try {
      await rejectResponse(order.id, responseId, token);
      loadResponses();
    } catch (err) {
      Alert.alert('Помилка', err?.message || 'Не вдалося відхилити');
    }
  }

  // ── Legacy actions ──
  async function accept() {
    try {
      const payload =
        order.agreedPrice && finalPrice !== '' && !Number.isNaN(Number(finalPrice))
          ? { finalPrice: String(Math.round(Number(finalPrice))) }
          : {};
      const options = {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      };
      if (Object.keys(payload).length) {
        options.body = JSON.stringify(payload);
      }
      await apiFetch(`/orders/${order.id}/accept`, options);
      navigation.navigate('Main', { screen: 'MyOrders' });
    } catch (err) {
      console.log(err);
    }
  }

  async function reserve() {
    try {
      const payload =
        order.agreedPrice && finalPrice !== '' && !Number.isNaN(Number(finalPrice))
          ? { finalPrice: String(Math.round(Number(finalPrice))) }
          : {};
      const options = {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      };
      if (Object.keys(payload).length) {
        options.body = JSON.stringify(payload);
      }
      const data = await apiFetch(`/orders/${order.id}/reserve`, options);
      setReserved(true);
      setPhone(data.phone);
      setCustomerName(data.name);
      try {
        const stored = await AsyncStorage.getItem('reservedPhones');
        const map = stored ? JSON.parse(stored) : {};
        if (data.phone) {
          map[order.id] = { phone: data.phone, name: data.name };
          await AsyncStorage.setItem('reservedPhones', JSON.stringify(map));
        }
      } catch {}
      if (data.order && data.order.reservedUntil)
        setReservedUntil(new Date(data.order.reservedUntil));
    } catch (err) {
      console.log(err);
    }
  }

  async function cancelReserve() {
    try {
      await apiFetch(`/orders/${order.id}/cancel-reserve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setReserved(false);
      setPhone(null);
      setCustomerName(null);
      setReservedUntil(null);
      setTimeLeft(null);
      try {
        const stored = await AsyncStorage.getItem('reservedPhones');
        const map = stored ? JSON.parse(stored) : {};
        if (map[order.id]) {
          delete map[order.id];
          await AsyncStorage.setItem('reservedPhones', JSON.stringify(map));
        }
      } catch {}
      navigation.goBack();
    } catch (err) {
      console.log(err);
    }
  }

  async function remove() {
    try {
      await apiFetch(`/orders/${order.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      navigation.goBack();
    } catch (err) {
      console.log(err);
    }
  }

  function edit() {
    navigation.navigate('EditOrder', { order });
  }

  function confirmDelete() {
    Alert.alert('Підтвердження', 'Видалити вантаж?', [
      { text: 'Скасувати' },
      { text: 'OK', onPress: remove },
    ]);
  }

  function confirmAction(message) {
    return new Promise((resolve) => {
      Alert.alert('Підтвердження', message, [
        { text: 'Скасувати', onPress: () => resolve(false) },
        { text: 'OK', onPress: () => resolve(true) },
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
        fd.append('status', status);
        photoUris.forEach((uri, index) => {
          const filenameFromUri = uri.split('/').pop() || `photo-${Date.now()}-${index + 1}.jpg`;
          const extMatch = /\.(\w+)$/.exec(filenameFromUri);
          const normalizedName = extMatch ? filenameFromUri : `${filenameFromUri}.jpg`;
          const ext = (extMatch ? extMatch[1] : 'jpg').toLowerCase();
          const mime =
            ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext || 'jpeg'}`;
          const fieldName = photoUris.length === 1 ? 'statusPhoto' : 'statusPhotos';
          fd.append(fieldName, { uri, name: normalizedName, type: mime });
        });
        body = fd;
      } else {
        body = JSON.stringify({ status });
      }
      const updated = await apiFetch(`/orders/${id}/status`, {
        method: 'PATCH',
        headers,
        body,
      });
      setOrder(updated);
      return updated;
    } catch (err) {
      console.log(err);
      Alert.alert('Помилка', err?.message || 'Не вдалося оновити статус');
      return null;
    }
  }

  function askPhotoPrompt(message) {
    return new Promise((resolve) => {
      Alert.alert('Фото вантажу', message, [
        { text: 'Пропустити', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Зробити фото', onPress: () => resolve(true) },
      ]);
    });
  }

  async function captureStatusPhotos() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Доступ до камери', 'Надайте доступ до камери, щоб додати фото.');
        return [];
      }
      const collected = [];
      let keepCapturing = true;
      while (keepCapturing) {
        const result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
        if (result.canceled) break;
        const uri = result.assets?.[0]?.uri;
        if (!uri) break;
        collected.push(uri);
        keepCapturing = await askAddMorePhotoPrompt();
      }
      return collected;
    } catch (err) {
      console.log(err);
      Alert.alert('Помилка', 'Не вдалося зробити фото.');
      return [];
    }
  }

  function askAddMorePhotoPrompt() {
    return new Promise((resolve) => {
      Alert.alert('Додати ще фото?', '', [
        { text: 'Ні', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Так', onPress: () => resolve(true) },
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
    if (await confirmAction('Підтвердити отримання вантажу?')) {
      await changeStatusWithOptionalPhoto(id, 'IN_PROGRESS', 'Бажаєте додати фото отриманого вантажу?');
    }
  }

  function showCompletionCelebration(orderLike) {
    setCompletionCelebration({
      id: orderLike?.id ?? Date.now(),
      earnings: getOrderCompletionEarnings(orderLike),
    });
  }

  async function markDelivered(orderOrId) {
    const id = typeof orderOrId === 'object' ? orderOrId?.id : orderOrId;
    if (await confirmAction('Підтвердити передачу вантажу?')) {
      const updated = await changeStatusWithOptionalPhoto(id, 'DELIVERED', 'Бажаєте додати фото виданого вантажу?');
      if (updated) {
        showCompletionCelebration(updated || orderOrId);
      }
    }
  }

  async function confirmDelivery(id) {
    if (await confirmAction('Підтвердити виконання замовлення?')) {
      await updateStatus(id, 'COMPLETED');
    }
  }

  async function moveOrderToHistory(id) {
    if (await confirmAction('Перемістити замовлення в історію?')) {
      await updateStatus(id, 'COMPLETED');
    }
  }

  async function confirmDriver() {
    try {
      const updated = await apiFetch(`/orders/${order.id}/confirm-driver`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrder(updated);
    } catch (err) {
      console.log(err);
    }
  }

  async function rejectDriver() {
    try {
      const updated = await apiFetch(`/orders/${order.id}/reject-driver`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrder(updated);
    } catch (err) {
      console.log(err);
    }
  }

  // ── Render: Response status badge ──
  function renderResponseBadge() {
    if (!useNewFlow || role !== 'DRIVER' || !myResponse) return null;
    const st = effectiveMyResponseStatus || myResponse.status;
    if (st === 'DECLINED' || st === 'EXPIRED') return null;
    const icon = responseStatusIconsSafe[st] || responseStatusIcons[st] || '';
    const label = responseStatusLabelsDriver[st] || st;
    const bgColor =
      st === 'PENDING_CONFIRM' ? '#FEF3C7'
      : st === 'DISCUSSING' ? '#FEF9C3'
      : st === 'CONFIRMED' ? '#D1FAE5'
      : '#ECFDF5';
    return (
      <View style={[styles.responseBadge, { backgroundColor: bgColor }]}>
        <Text style={styles.responseBadgeText}>{icon} {label}</Text>
      </View>
    );
  }

  // ── Render: Post-call result screen ──
  function renderResultScreen() {
    return (
      <View style={styles.resultOverlay}>
        <View style={styles.resultCard}>
          <Text style={styles.resultRouteText}>
            {order.pickupCity || order.pickupLocation} → {order.dropoffCity || order.dropoffLocation}
          </Text>
          <Text style={styles.resultPriceText}>{formatOrderPriceValue(order)}</Text>
        </View>

        <View style={styles.responseBadge}>
          <Text style={styles.responseBadgeText}>📞 Дзвінок здійснений</Text>
        </View>

        <Text style={styles.resultTitle}>Який результат розмови?</Text>

        <AppButton
          title="Домовились, виконаю"
          onPress={() => handleCallResult('agreed')}
          variant="success"
          style={styles.resultBtn}
        />
        <Text style={styles.resultHint}>Замовник отримає запит на підтвердження</Text>

        <AppButton
          title="Ще обговорюємо"
          onPress={() => handleCallResult('discussing')}
          color="#FBBF24"
          style={styles.resultBtn}
        />
        <Text style={styles.resultHint}>Замовлення залишиться доступним</Text>

        <AppButton
          title="Не підходить"
          onPress={() => handleCallResult('declined')}
          color="#9CA3AF"
          style={styles.resultBtn}
        />
        <Text style={styles.resultHint}>Ви повернетесь до пошуку</Text>

        <TouchableOpacity onPress={() => setShowResultScreen(false)} style={{ marginTop: 16 }}>
          <Text style={{ color: '#6B7280', textAlign: 'center' }}>Закрити</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render: Actions (footer buttons) ──
  function renderActions() {
    const buttons = [];

    if (useNewFlow && role === 'DRIVER') {
      // New response flow
      if (!myResponse && order.status === 'CREATED') {
        // Not yet responded
        buttons.push(
          <AppButton
            key="respond"
            title="Відгукнутися"
            onPress={handleRespond}
            variant="success"
            disabled={respondLoading}
            style={{ height: 56 }}
            textStyle={{ fontSize: 18, fontWeight: '700' }}
          />
        );
        if (FEATURE_FLAGS.SECONDARY_CTA) {
          buttons.push(
            <AppButton
              key="quick-confirm"
              title="Підтвердити відразу"
              onPress={handleRespondImmediate}
              color="transparent"
              disabled={respondLoading}
              style={{ height: 40, borderWidth: 1, borderColor: colors.green, marginTop: 4 }}
              textStyle={{ color: colors.green, fontSize: 14, fontWeight: '500' }}
            />
          );
        }
        buttons.push(
          <Text key="hint" style={styles.ctaHint}>Ви зможете зв'язатися із замовником</Text>
        );
        return buttons;
      }

      if (myResponse) {
        const rs = effectiveMyResponseStatus || myResponse.status;

        if (rs === 'RESPONDED') {
          buttons.push(
            <AppButton
              key="call"
              title="Подзвонити замовнику"
              onPress={handleCall}
              variant="success"
              style={{ height: 56 }}
              textStyle={{ fontSize: 18, fontWeight: '700' }}
            />
          );
          buttons.push(
            <TouchableOpacity key="already-called" onPress={() => setShowResultScreen(true)} style={{ marginTop: 8, alignItems: 'center' }}>
              <Text style={{ color: colors.green, fontSize: 15 }}>Я вже зателефонував</Text>
            </TouchableOpacity>
          );
          return buttons;
        }

        if (rs === 'CALL_MADE') {
          buttons.push(
            <AppButton
              key="result"
              title="Вказати результат розмови"
              onPress={() => setShowResultScreen(true)}
              variant="success"
              style={{ height: 56 }}
            />
          );
          return buttons;
        }

        if (rs === 'PENDING_CONFIRM') {
          const mins = confirmTimeLeft !== null ? Math.ceil(confirmTimeLeft / 60000) : null;
          buttons.push(
            <View key="pending-info" style={styles.pendingInfoBox}>
              {/* <Text style={styles.pendingInfoIcon}>⏳</Text> */}
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingInfoTitle}>Очікується рішення замовника</Text>
                {mins !== null && mins > 0 && (
                  <Text style={styles.pendingInfoTimer}>
                    {String(Math.floor(mins)).padStart(2, '0')} хв залишилось
                  </Text>
                )}
                <Text style={styles.pendingInfoSub}>Замовник має підтвердити протягом 30 хвилин</Text>
              </View>
            </View>
          );
          buttons.push(
            <AppButton
              key="cancel-request"
              title="Скасувати запит"
              onPress={handleWithdraw}
              color="transparent"
              style={{ height: 44, borderWidth: 1, borderColor: '#EF4444' }}
              textStyle={{ color: '#EF4444', fontSize: 15 }}
            />
          );
          return buttons;
        }

        if (rs === 'COUNTER_OFFERED') {
          const offered = Number(myResponse?.customerCounterPrice);
          buttons.push(
            <View key="counter-offer-info" style={styles.pendingInfoBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingInfoTitle}>Замовник запропонував іншу ціну</Text>
                {Number.isFinite(offered) && offered > 0 && (
                  <Text style={styles.pendingInfoTimer}>{Math.round(offered)} грн</Text>
                )}
                <Text style={styles.pendingInfoSub}>Погодьтесь або відхиліть замовлення</Text>
              </View>
            </View>
          );
          buttons.push(
            <View key="counter-offer-actions" style={styles.actionRow}>
              <AppButton
                title="Погодитись"
                onPress={() => handleDriverCounterDecision('accept')}
                style={styles.smallBtn}
              />
              <AppButton
                title="Відхилити"
                onPress={() => handleDriverCounterDecision('reject')}
                variant="danger"
                style={styles.smallBtn}
              />
            </View>
          );
          buttons.push(
            <AppButton
              key="counter-offer-propose"
              title="Запропонувати свою ціну"
              onPress={() => openCounterOfferModal(myResponse)}
              color="transparent"
              style={{ height: 44, borderWidth: 1, borderColor: colors.green, marginTop: 8 }}
              textStyle={{ color: colors.green, fontSize: 15 }}
            />
          );
          return buttons;
        }

        if (rs === 'DISCUSSING') {
          const minsLeft = formatMinutesLeft(myResponse.expiresAt);
          buttons.push(
            <View key="discussing-info" style={styles.discussingInfoBox}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#92400E' }}>
                🟡 Ведеться обговорення
              </Text>
              {minsLeft !== null && minsLeft > 0 && (
                <Text style={{ fontSize: 13, color: '#92400E', marginTop: 4 }}>
                  Залишилось ~{minsLeft} хв
                </Text>
              )}
              <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
                Ви можете продовжити пошук інших замовлень
              </Text>
            </View>
          );
          buttons.push(
            <AppButton
              key="recall"
              title="Подзвонити ще раз"
              onPress={handleReCall}
              variant="success"
              style={{ height: 48 }}
            />
          );
          buttons.push(
            <AppButton
              key="agree-discussing"
              title="Домовились, виконаю"
              onPress={handleAgreeFromDiscussing}
              color="transparent"
              style={{ height: 44, borderWidth: 1, borderColor: colors.green }}
              textStyle={{ color: colors.green, fontSize: 15 }}
            />
          );
          return buttons;
        }
      }

      // Execution flow (after ACCEPTED)
      if (order.status === 'ACCEPTED') {
        buttons.push(
          <AppButton key="received" title="Отримав вантаж" onPress={() => markReceived(order.id)} />
        );
      }
      if (order.status === 'IN_PROGRESS') {
        buttons.push(
          <AppButton key="delivered" title="Віддав вантаж" onPress={() => markDelivered(order)} />
        );
      }
    } else if (!useNewFlow && role === 'DRIVER') {
      // Legacy flow
      if (!order.driverId) {
        if (!reserved) {
          buttons.push(
            <AppButton key="reserve" title="Резерв 10 хв" onPress={reserve} variant="success" />
          );
        } else {
          buttons.push(
            <AppButton key="cancel" title="Відмінити резерв" onPress={cancelReserve} variant="danger" />
          );
        }
        buttons.push(
          <AppButton key="take" title="Взяти" onPress={accept} variant="warning" />
        );
      }
      if (order.status === 'ACCEPTED') {
        buttons.push(
          <AppButton key="received" title="Вантаж отримано" onPress={() => markReceived(order.id)} />
        );
      }
      if (order.status === 'IN_PROGRESS') {
        buttons.push(
          <AppButton key="delivered" title="Вантаж доставлено" onPress={() => markDelivered(order)} />
        );
      }
    }

    if (role === 'CUSTOMER') {
      if (order.status === 'DELIVERED') {
        buttons.push(
          <AppButton key="confirm" title="Підтвердити доставку" onPress={() => confirmDelivery(order.id)} />
        );
      } else if (canCustomerMoveInProgressOrderToHistory(order, role, nowMs)) {
        buttons.push(
          <AppButton
            key="move-to-history"
            title={MOVE_TO_HISTORY_TITLE}
            onPress={() => moveOrderToHistory(order.id)}
            color="#6B7280"
          />
        );
      } else if (order.status === 'IN_PROGRESS') {
        const waitText = getMoveToHistoryWaitText(order, role, nowMs);
        if (waitText) {
          buttons.push(
            <Text key="move-to-history-wait" style={styles.ctaHint}>{waitText}</Text>
          );
        }
      } else if (!useNewFlow && order.status === 'PENDING') {
        buttons.push(
          <View key="pending" style={styles.actionRow}>
            <AppButton title="Прийняти" onPress={confirmDriver} style={styles.smallBtn} />
            <AppButton title="Відхилити" onPress={rejectDriver} variant="danger" style={styles.smallBtn} />
          </View>
        );
      } else if (!useNewFlow && order.status === 'CREATED' && order.reservedBy) {
        buttons.push(
          <AppButton key="cancel-reserve" title="Відмінити резерв" onPress={cancelReserve} variant="danger" />
        );
      }
    }

    return buttons.length > 0 ? buttons : <View style={{ height: 24 }} />;
  }

  function renderCityDriverActions() {
    const buttons = [];

    if (!myResponse && order.status === 'CREATED') {
      buttons.push(
        <View key="city-offer-form" style={styles.cityOfferForm}>
          <TouchableOpacity
            style={styles.cityOfferToggle}
            activeOpacity={0.85}
            onPress={() => setCityOfferExpanded((prev) => !prev)}
          >
            <Text style={styles.cityOfferToggleTitle}>Дані для пропозиції</Text>
            <Ionicons
              name={cityOfferExpanded ? 'chevron-down' : 'chevron-up'}
              size={20}
              color="#1E3A8A"
            />
          </TouchableOpacity>

          {cityOfferExpanded && (
            <>
              <Text style={styles.cityOfferLabel}>Ставка, грн/год</Text>
              <AppInput
                keyboardType="numeric"
                placeholder="Наприклад: 450"
                value={cityHourlyRate}
                onChangeText={(value) => setCityHourlyRate(value.replace(/[^\d]/g, ''))}
                style={styles.cityOfferInput}
              />
              <Text style={styles.cityOfferLabel}>Мінімум годин</Text>
              <AppInput
                keyboardType="numeric"
                placeholder="Наприклад: 2"
                value={cityMinHours}
                onChangeText={(value) => setCityMinHours(value.replace(/[^\d]/g, ''))}
                style={styles.cityOfferInput}
              />
              <Text style={styles.cityOfferLabel}>Час прибуття</Text>
              <View style={styles.cityEtaWrap}>
                {CITY_ARRIVAL_ETA_OPTIONS.map((eta) => (
                  <TouchableOpacity
                    key={eta.value}
                    style={[
                      styles.cityEtaChip,
                      cityArrivalEta === eta.value && styles.cityEtaChipActive,
                    ]}
                    onPress={() => setCityArrivalEta(eta.value)}
                  >
                    <Text
                      style={[
                        styles.cityEtaChipText,
                        cityArrivalEta === eta.value && styles.cityEtaChipTextActive,
                      ]}
                    >
                      {eta.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {cityOfferTotalPreview !== null && (
                <Text style={styles.cityOfferTotalText}>Разом: {cityOfferTotalPreview} грн</Text>
              )}
            </>
          )}
        </View>
      );
      buttons.push(
        <AppButton
          key="city-respond"
          title="Запропонувати ціну"
          onPress={handleRespond}
          variant="success"
          disabled={respondLoading}
          style={{ height: 56 }}
          textStyle={{ fontSize: 18, fontWeight: '700' }}
        />
      );
      buttons.push(
        <Text key="city-hint" style={styles.ctaHint}>Замовник отримає офер і підтвердить у застосунку</Text>
      );
      return buttons;
    }

    if ((effectiveMyResponseStatus || myResponse?.status) === 'PENDING_CONFIRM') {
      const mins = confirmTimeLeft !== null ? Math.ceil(confirmTimeLeft / 60000) : null;
      buttons.push(
        <View key="pending-info-city" style={styles.pendingInfoBox}>
          <Text style={styles.pendingInfoIcon}>{responseStatusIconsSafe.PENDING_CONFIRM}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.pendingInfoTitle}>Очікується рішення замовника</Text>
            {mins !== null && mins > 0 && (
              <Text style={styles.pendingInfoTimer}>
                {String(Math.floor(mins)).padStart(2, '0')} хв залишилось
              </Text>
            )}
          </View>
        </View>
      );
      buttons.push(
        <AppButton
          key="cancel-request-city"
          title="Скасувати запит"
          onPress={handleWithdraw}
          color="transparent"
          style={{ height: 44, borderWidth: 1, borderColor: '#EF4444' }}
          textStyle={{ color: '#EF4444', fontSize: 15 }}
        />
      );
      return buttons;
    }

    if (order.status === 'ACCEPTED') {
      buttons.push(
        <AppButton key="received-city" title="Отримав вантаж" onPress={() => markReceived(order.id)} />
      );
      return buttons;
    }

    if (order.status === 'IN_PROGRESS') {
      buttons.push(
        <AppButton key="delivered-city" title="Віддав вантаж" onPress={() => markDelivered(order)} />
      );
      return buttons;
    }

    return buttons.length > 0 ? buttons : <View style={{ height: 24 }} />;
  }

  function renderActionsV2() {
    if (useNewFlow && role === 'DRIVER' && isCityOrder) {
      return renderCityDriverActions();
    }
    return renderActions();
  }

  // ── Render: Customer response list ──
  function renderCustomerResponses() {
    if (!useNewFlow || role !== 'CUSTOMER' || !responses.length) return null;
    const hasConfirmedDriver =
      ['ACCEPTED', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED'].includes(order.status) ||
      responses.some((r) => r.status === 'CONFIRMED');
    if (hasConfirmedDriver) return null;
    const activeResponses = responses.filter(
      (r) => !['DECLINED', 'EXPIRED', 'REJECTED'].includes(r.status)
    );
    if (!activeResponses.length) return null;

    return (
      <View style={styles.responsesCard}>
        <Text style={styles.responsesTitle}>
          Зацікавлені водії ({activeResponses.length})
        </Text>
        {activeResponses.map((resp) => {
          const counterOfferText =
            resp.status === 'COUNTER_OFFERED' && Number.isFinite(Number(resp.customerCounterPrice)) && Number(resp.customerCounterPrice) > 0
              ? `${Math.round(Number(resp.customerCounterPrice))} грн`
              : null;
          const offerText = isCityOrder ? null : (counterOfferText || formatResponseFinalPrice(resp));
          const canSelect = ['RESPONDED', 'CALL_MADE', 'PENDING_CONFIRM', 'DISCUSSING'].includes(resp.status);

          return (
            <View key={resp.id} style={styles.responseItem}>
              <View style={styles.responseDriverRow}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                  onPress={() => resp.driver && navigation.navigate('DriverProfile', { driver: resp.driver })}
                  activeOpacity={0.7}
                >
                  <Ionicons name='person-circle' size={36} color={colors.green} />
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text style={{ fontWeight: '600' }}>{resp.driverName || 'Водій'}</Text>
                    {resp.driverRating && (
                      <Text style={{ fontSize: 13, color: '#6B7280' }}>
                        Рейтинг: {resp.driverRating.toFixed(1)}
                      </Text>
                    )}
                    <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
                      {(responseStatusIconsSafe[resp.status] || responseStatusIcons[resp.status] || '')} {responseStatusLabelsCustomer[resp.status] || resp.status}
                    </Text>
                    {offerText && <Text style={styles.responseOfferText}>Фінальна ціна: {offerText}</Text>}
                    {isCityOrder && formatCityOfferSummary(resp) && (
                      <Text style={styles.cityOfferSummary}>{formatCityOfferSummary(resp)}</Text>
                    )}
                  </View>
                </TouchableOpacity>
                {resp.driverPhone && (
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${resp.driverPhone}`)}>
                    <Ionicons name='call' size={24} color={colors.green} />
                  </TouchableOpacity>
                )}
              </View>

              {!isCityOrder && canSelect && (
                <TouchableOpacity
                  style={styles.counterOfferButton}
                  onPress={() => openCounterOfferModal(resp)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="pricetag-outline" size={18} color={colors.green} />
                  <Text style={styles.counterOfferButtonText}>Запропонувати іншу ціну</Text>
                </TouchableOpacity>
              )}

              {canSelect && (
                <View style={styles.actionRow}>
                  <AppButton
                    title='Обрати водія'
                    onPress={() => (isCityOrder ? handleConfirmResponse(resp.id) : promptConfirmWithPrice(resp))}
                    style={styles.smallBtn}
                  />
                  <AppButton
                    title='Відхилити'
                    onPress={() => handleRejectResponse(resp.id)}
                    variant='danger'
                    style={styles.smallBtn}
                  />
                </View>
              )}

              {!isCityOrder && resp.status === 'COUNTER_OFFERED' && (
                <Text style={styles.counterPendingText}>
                  Ви надіслали контрпропозицію. Очікується рішення водія.
                </Text>
              )}
            </View>
          );
        })}
      </View>
    );
  }

  function renderPhotoSection(title, photos) {
    if (!Array.isArray(photos) || photos.length === 0) return null;
    return (
      <View key={title} style={styles.photoSection}>
        <Text style={styles.photoSectionTitle}>{title}</Text>
        <ScrollView horizontal style={{ marginTop: 6 }}>
          {photos.map((photoPath, index) => {
            const uri = fullPhotoUrl(photoPath);
            if (!uri) return null;
            return (
              <TouchableOpacity key={`${title}-${index}`} onPress={() => setPreviewPhotoUri(uri)}>
                <Image source={{ uri }} style={styles.photo} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.green} />
      </SafeAreaView>
    );
  }

  // Post-call result screen overlay
  if (showResultScreen && useNewFlow && !isCityOrder) {
    return (
      <Screen>
        <SafeAreaView style={styles.container}>
          {renderResultScreen()}
        </SafeAreaView>
      </Screen>
    );
  }

  const actions = renderActionsV2();
  const openedFromDateReminder = Boolean(notificationReminderStep);
  const orderDateOutdated = isOrderDateOutdated(order);
  const showDateUpdateHint =
    role === 'CUSTOMER' &&
    order.status === 'CREATED' &&
    !order.driverId &&
    (orderDateOutdated || openedFromDateReminder);
  const dateUpdateHintText = orderDateOutdated
    ? order.freeDate
      ? 'Термін актуальності вільної дати минув. Оновіть його, щоб водії знову бачили замовлення вище у списку.'
      : 'Дата завантаження вже минула. Замовлення опускається нижче у списку пошуку, доки ви не оновите дату.'
    : order.freeDate
      ? 'Перевірте, чи вільна дата ще актуальна. Якщо потрібно, оновіть її, щоб замовлення залишалось помітним для водіїв.'
      : 'Перевірте, чи дата завантаження ще актуальна. Якщо потрібно, оновіть її, щоб замовлення залишалось вище у списку.';

  return (
    <Screen disableKeyboardAvoiding>
      <SafeAreaView style={styles.container}>

      {!useNewFlow && reserved && timeLeft !== null && (
        <View style={styles.fixedTimer}>
          <Text style={styles.timerText}>
            {String(Math.floor(timeLeft / 60000)).padStart(2, '0')}:
            {String(Math.floor((timeLeft % 60000) / 1000)).padStart(2, '0')}
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: actionHeight + 24 }]}>

      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Замовлення № {order.id}</Text>
        {role === 'CUSTOMER' && !order.driverId ? (
          <View style={styles.appActions}>
            <TouchableOpacity onPress={edit} style={styles.iconButton}>
              <Ionicons name="pencil" size={20} color={colors.green} />
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmDelete} style={styles.iconButton}>
              <Ionicons name="trash" size={20} color={colors.red} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusDate}>
          {formatDateTimeLocal(order.createdAt)}
        </Text>
        <View style={styles.statusRowCard}>
          <View style={[styles.statusDot, { backgroundColor: statusColor(order.status) }]} />
          <Text style={[styles.statusValue, { color: statusColor(order.status) }]}>
            {statusLabels[order.status] || order.status}
          </Text>
        </View>
        {useNewFlow && role === 'CUSTOMER' && order.status === 'CREATED' && (
          <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            {responses.filter((r) => !['DECLINED', 'EXPIRED', 'REJECTED'].includes(r.status)).length > 0
              ? `${responses.filter((r) => !['DECLINED', 'EXPIRED', 'REJECTED'].includes(r.status)).length} водіїв зацікавлені`
              : 'Очікуємо відгуки водіїв'}
          </Text>
        )}
      </View>

      {showDateUpdateHint && (
        <View style={styles.dateUpdateHintCard}>
          <View style={styles.dateUpdateHintHeader}>
            <Ionicons name="calendar-outline" size={22} color="#B45309" />
            <Text style={styles.dateUpdateHintTitle}>Оновіть дату замовлення</Text>
          </View>
          <Text style={styles.dateUpdateHintText}>{dateUpdateHintText}</Text>
          <TouchableOpacity
            style={styles.dateUpdateHintButton}
            onPress={edit}
            activeOpacity={0.85}
          >
            <Ionicons name="create-outline" size={18} color="#FFFFFF" />
            <Text style={styles.dateUpdateHintButtonText}>Оновити дату</Text>
          </TouchableOpacity>
        </View>
      )}

      {renderResponseBadge()}

      {role === 'DRIVER' && showContact && contactPhone && (
        <View style={styles.driverCard}>
          <View style={styles.driverRow}>
            <Ionicons name="person-circle" size={36} color={colors.green} />
            <View style={{ marginLeft: 8, flex: 1 }}>
              <Text>{contactName || 'Замовник'}</Text>
            </View>
            <TouchableOpacity onPress={useNewFlow ? handleCall : () => Linking.openURL(`tel:${contactPhone}`)}>
              <Ionicons name="call" size={28} color={colors.green} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {role === 'CUSTOMER' && assignedDriver && (
        <View style={styles.driverCard}>
          <View style={styles.driverRow}>
            <TouchableOpacity
              style={{ marginRight: 12 }}
              onPress={openDriverProfile}
              activeOpacity={0.8}
            >
              {driverPhotoUri ? (
                <Image
                  source={{ uri: driverPhotoUri }}
                  style={{ width: 48, height: 48, borderRadius: 24 }}
                />
              ) : (
                <Ionicons name="person-circle" size={48} color={colors.green} />
              )}
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text>{assignedDriver.name}</Text>
              {assignedDriver.rating && (
                <Text>Рейтинг: {assignedDriver.rating.toFixed(1)}</Text>
              )}
            </View>
            {assignedDriver.phone && (
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${assignedDriver.phone}`)}>
                <Ionicons name="call" size={28} color={colors.green} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {renderCustomerResponses()}

      {role !== 'DRIVER' && formattedHistory.length > 0 && (
        <StatusTimeline history={formattedHistory} />
      )}

      <View style={styles.detailsCard}>

      <View style={styles.row}>
        <Ionicons name="pin-outline" size={20} color={colors.orange} style={styles.rowIcon} />
        <View style={styles.rowText}>
          <Text style={styles.label}>Звідки:</Text>
          <Text style={styles.value}>{pickupAddressDisplay}</Text>
        </View>
        <TouchableOpacity
          style={styles.mapIconBtn}
          onPress={() =>
            openLocationInMaps({
              address: order.pickupLocation || order.pickupAddress || pickupAddressDisplay,
              city: order.pickupCity,
              lat: order.pickupLat,
              lon: order.pickupLon,
            })
          }
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="navigate-outline" size={20} color={colors.orange} />
        </TouchableOpacity>
      </View>

      <View style={styles.row}>
        <Ionicons name="flag-outline" size={20} color={colors.green} style={styles.rowIcon} />
        <View style={styles.rowText}>
          <Text style={styles.label}>Куди:</Text>
          <Text style={styles.value}>{dropoffAddressDisplay}</Text>
        </View>
        <TouchableOpacity
          style={styles.mapIconBtn}
          onPress={() =>
            openLocationInMaps({
              address: order.dropoffLocation || order.dropoffAddress || dropoffAddressDisplay,
              city: order.dropoffCity,
              lat: order.dropoffLat,
              lon: order.dropoffLon,
            })
          }
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="navigate-outline" size={20} color={colors.green} />
        </TouchableOpacity>
      </View>

      {FEATURE_FLAGS.SHOW_DISTANCE && order.distance && (
        <View style={styles.row}>
          <Ionicons name="speedometer-outline" size={20} color="#555" style={styles.rowIcon} />
          <Text style={styles.label}>Відстань:</Text>
          <Text style={styles.value}>~{Math.round(order.distance)} км</Text>
        </View>
      )}

      {FEATURE_FLAGS.SHOW_CARGO_DIMENSIONS && (order.cargoLength || order.dimensions) && (
        <View style={styles.row}>
          <Ionicons name="cube-outline" size={20} color="#555" style={styles.rowIcon} />
          <Text style={styles.label}>Габарити:</Text>
          <Text style={styles.value}>
            {order.cargoLength && order.cargoWidth && order.cargoHeight
              ? `${order.cargoLength}×${order.cargoWidth}×${order.cargoHeight} м`
              : order.dimensions || '—'}
            {cargoVolumeDisplay ? ` = ${cargoVolumeDisplay} м³` : ''}
          </Text>
        </View>
      )}

      {FEATURE_FLAGS.SHOW_CARGO_DIMENSIONS && order.cargoWeight && (
        <View style={styles.row}>
          <Ionicons name="fitness-outline" size={20} color="#555" style={styles.rowIcon} />
          <Text style={styles.label}>Вага:</Text>
          <Text style={styles.value}>{order.cargoWeight} кг</Text>
        </View>
      )}

      {order.freeDate ? (
        <View style={styles.row}>
          <Ionicons name="calendar-clear-outline" size={20} color="#555" style={styles.rowIcon} />
          <Text style={styles.label}>Вільна дата:</Text>
          <Text style={styles.value}>
            {order.freeDateUntil
              ? `Актуально до ${formatDateTimeLocal(order.freeDateUntil)}`
              : 'Дата узгоджується окремо'}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.row}>
            <Ionicons name="time-outline" size={20} color="#555" style={styles.rowIcon} />
            <Text style={styles.label}>Завантаження:</Text>
            <Text style={styles.value}>
              {formatDate(order.loadFrom)}
              {'\n'}
              {formatTime(order.loadFrom)} - {formatTime(order.loadTo)}
            </Text>
          </View>

          <View style={styles.row}>
            <Ionicons name="time-outline" size={20} color="#555" style={styles.rowIcon} />
            <Text style={styles.label}>Вивантаження:</Text>
            <Text style={styles.value}>
              {formatDate(order.unloadFrom)}
              {'\n'}
              {formatTime(order.unloadFrom)} - {formatTime(order.unloadTo)}
            </Text>
          </View>
        </>
      )}

      <View style={styles.row}>
        <Ionicons name={order.payment === 'card' ? 'card-outline' : 'cash-outline'} size={20} color="#555" style={styles.rowIcon} />
        <Text style={styles.label}>Оплата:</Text>
        <Text style={styles.value}>{order.payment === 'card' ? 'Карта' : 'Готівка'}</Text>
      </View>

      <View style={styles.row}>
        <Ionicons name="arrow-down-circle-outline" size={20} color={colors.orange} style={styles.rowIcon} />
        <Text style={styles.label}>Завантаження допомога:</Text>
        <Text style={styles.value}>{order.loadHelp ? 'так' : 'ні'}</Text>
      </View>

      <View style={styles.row}>
        <Ionicons name="arrow-up-circle-outline" size={20} color={colors.orange} style={styles.rowIcon} />
        <Text style={styles.label}>Розвантаження допомога:</Text>
        <Text style={styles.value}>{order.unloadHelp ? 'так' : 'ні'}</Text>
      </View>

      <View style={styles.row}>
        <Ionicons name="pricetag-outline" size={20} color="#555" style={styles.rowIcon} />
        <Text style={styles.label}>Ціна:</Text>
        <Text style={styles.value}>{formatOrderPriceValue(order)}</Text>
      </View>

      <View style={styles.row}>
        <Ionicons name="information-circle-outline" size={20} color="#555" style={styles.rowIcon} />
        <Text style={styles.label}>Статус:</Text>
        <Text style={styles.value}>{statusLabels[order.status] || order.status}</Text>
      </View>

      {order.cargoType && (
        <View style={styles.row}>
          <Ionicons name="reader-outline" size={20} color="#555" style={styles.rowIcon} />
          <Text style={styles.label}>Опис:</Text>
          <Text style={styles.value}>{order.cargoType}</Text>
        </View>
      )}

      {photoSections.map((section) => renderPhotoSection(section.title, section.photos))}

      {previewPhotoUri !== null && (
        <Modal visible transparent onRequestClose={closePhotoPreview}>
          <View style={styles.modal}>
            <Image
              source={{ uri: previewPhotoUri }}
              style={styles.full}
              resizeMode="contain"
            />
            <View
              style={styles.swipeCloseLayer}
              onTouchStart={handlePhotoPreviewTouchStart}
              onTouchEnd={handlePhotoPreviewTouchEnd}
            />
            <TouchableOpacity style={styles.close} onPress={closePhotoPreview}>
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
          </View>
        </Modal>
      )}

      <Modal
        visible={counterOfferModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCounterOfferModal}
      >
        <View style={styles.counterModalBackdrop}>
          <View style={styles.counterModalCard}>
            <Text style={styles.counterModalTitle}>Запропонувати іншу фінальну ціну</Text>
            <AppInput
              keyboardType="numeric"
              placeholder="Наприклад: 2800"
              value={counterOfferValue}
              onChangeText={(value) => setCounterOfferValue(String(value || '').replace(/[^\d]/g, ''))}
              style={styles.counterModalInput}
            />
            <View style={styles.actionRow}>
              <AppButton
                title="Скасувати"
                onPress={closeCounterOfferModal}
                color="#9CA3AF"
                style={styles.smallBtn}
              />
              <AppButton
                title={counterOfferLoading ? 'Надсилання...' : 'Надіслати'}
                onPress={submitCounterOfferForSelected}
                disabled={counterOfferLoading}
                style={styles.smallBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      </View>

      {role === 'DRIVER' && formattedHistory.length > 0 && (
        <StatusTimeline history={formattedHistory} />
      )}

      </ScrollView>

      <View
        style={[styles.actionAreaWrapper, { bottom: actionAreaBottom }]}
      >
        <View style={styles.actionArea} onLayout={(e) => setActionHeight(e.nativeEvent.layout.height)}>

      {!useNewFlow && role === 'DRIVER' && showContact && contactPhone && (
        <View style={styles.driverCard}>
          <View style={styles.driverRow}>
            <Ionicons name="person-circle" size={36} color={colors.green} />
            <View style={{ marginLeft: 8, flex: 1 }}>
              <Text>{contactName || 'Замовник'}</Text>
            </View>
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${contactPhone}`)}>
              <Ionicons name="call" size={28} color={colors.green} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {actions}

      {role === 'DRIVER' && !isCityOrder && (
        <View style={styles.finalPriceSection}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AppText style={{ fontWeight: 'bold', marginRight: 8 }}>
              Фінальна ціна:
            </AppText>
            {order.status === 'CREATED' && !myResponse ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingHorizontal: 8 }}>
              <AppInput
                ref={priceInputRef}
                style={{ flex: 1, height: 40 }}
                keyboardType="numeric"
                returnKeyType="done"
                placeholder="Введіть ціну"
                value={finalPrice}
                onChangeText={(t) => setFinalPrice(t.replace(/[^\d]/g, ''))}
              />
              <TouchableOpacity
                onPress={() => priceInputRef.current?.focus()}
                style={{ marginLeft: 4, padding: 4 }}
              >
                <Ionicons name="create-outline" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            ) : (
              <AppText style={{ flex: 1, paddingHorizontal: 8 }}>
                {myResponse?.finalPriceOffer
                  ? `${Math.round(Number(myResponse.finalPriceOffer))} грн`
                  : order.finalPrice
                  ? `${Math.round(Number(order.finalPrice))} грн`
                  : order.price
                  ? `${Math.round(Number(order.price))} грн`
                  : "-"}
              </AppText>
            )}
          </View>
        </View>
      )}

        </View>
      </View>

      <DriverCompletionCelebration
        visible={Boolean(completionCelebration)}
        earnings={completionCelebration?.earnings}
        onClose={() => setCompletionCelebration(null)}
      />

      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 24 },
  iconButton: { padding: 10 },
  title: { fontSize: 18, fontWeight: '600', color: '#111827', textAlign: 'center' },
  row: { flexDirection: 'row', marginBottom: 12, alignItems: 'center' },
  rowText: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  label: { fontWeight: 'bold', marginRight: 8, fontSize: 16 },
  value: { fontSize: 16, flexShrink: 1 },
  rowIcon: { marginRight: 6 },
  mapIconBtn: { padding: 6 },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    marginBottom: 16,
    marginLeft: 10,
    marginRight: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  photo: { width: 120, height: 120, marginRight: 8, marginLeft: 10 },
  photoSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  photoSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 10,
  },
  modal: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  full: { width: '100%', height: '100%' },
  swipeCloseLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  close: { position: 'absolute', top: 40, right: 20, zIndex: 2 },
  driverCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    marginBottom: 16,
    marginLeft: 10,
    marginRight: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  driverRow: { flexDirection: 'row', alignItems: 'center' },
  timer: { textAlign: 'right', fontSize: 16, color: colors.orange },
  fixedTimer: {
    position: 'absolute',
    top: 40,
    right: 16,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    elevation: 3,
    zIndex: 2,
  },
  timerText: { fontSize: 16, color: colors.orange, fontWeight: 'bold' },
  nameText: { marginLeft: 4, fontSize: 16 },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginLeft: 10,
    marginRight: 10,
  },
  appActions: { flexDirection: 'row' },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    marginLeft: 10,
    marginRight: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  statusDate: { fontSize: 14, color: '#6B7280' },
  statusRowCard: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusValue: { fontSize: 18, fontWeight: '600' },
  dateUpdateHintCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 10,
    marginBottom: 14,
  },
  dateUpdateHintHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateUpdateHintTitle: {
    marginLeft: 8,
    color: '#92400E',
    fontSize: 16,
    fontWeight: '800',
  },
  dateUpdateHintText: {
    color: '#78350F',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  dateUpdateHintButton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: colors.orange,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dateUpdateHintButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 8,
  },
  scrollContent: { paddingBottom: 24 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  smallBtn: { flex: 1, marginHorizontal: 4 },
  actionAreaWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  actionArea: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  finalPriceSection: {
    marginTop: 8,
  },
  // New response flow styles
  responseBadge: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  responseBadgeText: { fontSize: 15, fontWeight: '600', color: '#065F46' },
  ctaHint: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  cityOfferForm: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  cityOfferToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cityOfferToggleTitle: {
    fontSize: 15,
    color: '#1E3A8A',
    fontWeight: '700',
  },
  cityOfferLabel: {
    fontSize: 13,
    color: '#1E3A8A',
    fontWeight: '600',
    marginTop: 6,
  },
  cityOfferInput: {
    marginTop: 6,
    marginBottom: 0,
    height: 50,
  },
  cityEtaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  cityEtaChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  cityEtaChipActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#60A5FA',
  },
  cityEtaChipText: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: '500',
  },
  cityEtaChipTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  cityOfferTotalText: {
    marginTop: 6,
    fontSize: 14,
    color: '#1D4ED8',
    fontWeight: '700',
  },
  pendingInfoBox: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  pendingInfoIcon: { fontSize: 24, marginRight: 12 },
  pendingInfoTitle: { fontSize: 15, fontWeight: '700', color: '#92400E' },
  pendingInfoTimer: { fontSize: 22, fontWeight: '800', color: '#B45309', marginTop: 4 },
  pendingInfoSub: { fontSize: 12, color: '#92400E', marginTop: 4 },
  discussingInfoBox: {
    backgroundColor: '#FEF9C3',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  // Result screen styles
  resultOverlay: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  resultCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  resultRouteText: { fontSize: 16, fontWeight: '600', color: '#111827' },
  resultPriceText: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  resultTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },
  resultBtn: { marginBottom: 4 },
  resultHint: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 16,
  },
  // Customer responses
  responsesCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    marginBottom: 16,
    marginLeft: 10,
    marginRight: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  responsesTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  cityOfferSummary: {
    marginTop: 4,
    fontSize: 12,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  cityResponseActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  cityResponseActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginLeft: 8,
  },
  cityResponseActionConfirm: {
    backgroundColor: '#ECFDF5',
    borderColor: '#86EFAC',
  },
  cityResponseActionReject: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  responseItem: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    marginTop: 8,
  },
  responseDriverRow: { flexDirection: 'row', alignItems: 'center' },
  responseOfferText: {
    marginTop: 4,
    fontSize: 13,
    color: '#166534',
    fontWeight: '700',
  },
  counterOfferButton: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.green,
    backgroundColor: '#F0FDF4',
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterOfferButtonText: {
    marginLeft: 8,
    color: colors.green,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  counterPendingText: {
    marginTop: 8,
    fontSize: 13,
    color: '#92400E',
    fontWeight: '600',
  },
  counterModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  counterModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
  },
  counterModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  counterModalInput: {
    marginBottom: 12,
  },
});







