import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Pressable,
  BackHandler,
} from 'react-native';
import { Portal } from 'react-native-portalize';
import { Ionicons } from '@expo/vector-icons';
import AppInput from './AppInput';
import AppText from './AppText';
import { colors } from './Colors';
import { registerCallback } from '../callbackRegistry';

const DROPDOWN_MAX_HEIGHT = 240;
const DROPDOWN_MARGIN = 8;
const MIN_SPACE_BELOW = 120;
const MAX_GOOGLE_SUGGESTIONS = 20;

const GOOGLE_ADDRESS_TYPES = new Set([
  'street_address',
  'route',
  'intersection',
  'premise',
  'subpremise',
  'plus_code',
  'point_of_interest',
  'park',
  'airport',
  'establishment',
]);
const GOOGLE_CITY_TYPES = new Set([
  'locality',
  'postal_town',
  'administrative_area_level_1',
  'administrative_area_level_2',
  'administrative_area_level_3',
]);
const GOOGLE_VILLAGE_TYPES = new Set([
  'sublocality',
  'sublocality_level_1',
  'sublocality_level_2',
  'sublocality_level_3',
  'neighborhood',
]);
const VILLAGE_TEXT_REGEX = /(\u0441\u0435\u043b\u043e|\u0441\u043c\u0442|\u0441\u0435\u043b\u0438\u0449\u0435|\u0441\u0435\u043b\u0438\u0449\u0430|village|settlement|hamlet|\u0441-\u0449\u0435)/i;
const REGION_REGEX = /(\u043e\u0431\u043b\.?|\u043e\u0431\u043b\u0430\u0441\u0442\u044c|\u043e\u0431\u043b\u0430\u0441\u0442\u0456|\u0440\u0430\u0439\u043e\u043d|raion|district|province|region)/i;
const COUNTRY_REGEX = /(\u0443\u043a\u0440\u0430\u0457\u043d\u0430|\u0443\u043a\u0440\u0430\u0438\u043d\u0430|ukraine)/i;
const STREET_PREFIX_REGEX = /^(?:\u0432\u0443\u043b\u0438\u0446\u044f|\u0432\u0443\u043b\.|\u0443\u043b\u0438\u0446\u0430|\u0443\u043b\.|\u043f\u0440\u043e\u0441\u043f\u0435\u043a\u0442|\u043f\u0440\u043e\u0441\u043f\.|\u0431\u0443\u043b\u044c\u0432\u0430\u0440|\u0431\u0443\u043b\.|\u043f\u043b\u043e\u0449\u0430|\u043f\u043b\.|\u043f\u0440\u043e\u0432\u0443\u043b\u043e\u043a|\u043f\u0440\u043e\u0432\.|street|st\.|avenue|ave\.|road|rd\.|lane|ln\.|highway|hwy\.)\s+/i;
const CYR_TO_LAT = {
  '\u0430': 'a',
  '\u0431': 'b',
  '\u0432': 'v',
  '\u0433': 'h',
  '\u0491': 'g',
  '\u0434': 'd',
  '\u0435': 'e',
  '\u0454': 'ie',
  '\u0436': 'zh',
  '\u0437': 'z',
  '\u0438': 'y',
  '\u0456': 'i',
  '\u0457': 'i',
  '\u0439': 'i',
  '\u043a': 'k',
  '\u043b': 'l',
  '\u043c': 'm',
  '\u043d': 'n',
  '\u043e': 'o',
  '\u043f': 'p',
  '\u0440': 'r',
  '\u0441': 's',
  '\u0442': 't',
  '\u0443': 'u',
  '\u0444': 'f',
  '\u0445': 'kh',
  '\u0446': 'ts',
  '\u0447': 'ch',
  '\u0448': 'sh',
  '\u0449': 'shch',
  '\u044c': '',
  '\u044a': '',
  '\u044e': 'iu',
  '\u044f': 'ia',
  '\u0451': 'io',
  '\u044b': 'y',
  '\u044d': 'e',
};

function transliterate(value = '') {
  let result = '';
  for (const char of value) {
    result += CYR_TO_LAT[char] ?? char;
  }
  return result;
}

function normalizeName(value = '') {
  if (!value) return '';
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  const transliterated = transliterate(trimmed);
  return transliterated.replace(/\s+/g, ' ').trim();
}

const RAW_MAJOR_CITY_NAMES = [
  'kyiv',
  'kiev',
  'kharkiv',
  'kharkov',
  'odesa',
  'odessa',
  'dnipro',
  'dnepr',
  'lviv',
  'zaporizhzhia',
  'zaporizhia',
  'kryvyi rih',
  'krivoy rog',
  'mykolaiv',
  'nikolaev',
  'mariupol',
  'chernihiv',
  'chernigov',
  'cherkasy',
  'cherkassy',
  'chernivtsi',
  'chernovtsy',
  'sumy',
  'zhytomyr',
  'zhitomir',
  'poltava',
  'vinnytsia',
  'vinnitsa',
  'kherson',
  'kropyvnytskyi',
  'kropivnitskiy',
  'rivne',
  'rovno',
  'ivano-frankivsk',
  'ternopil',
  'lutsk',
  'uzhhorod',
  'uzhgorod',
  'bila tserkva',
  'berdiansk',
  'berdyansk',
  'melitopol',
  'donetsk',
  'luhansk',
  'lugansk',
  'kremenchuk',
  'kremenchug',
  'brovary',
  'kamianets-podilskyi',
  'kamyanets-podilsky',
];
const MAJOR_CITY_SET = new Set(RAW_MAJOR_CITY_NAMES.map((name) => normalizeName(name)));

function isMajorCityName(value = '') {
  if (!value) return false;
  return MAJOR_CITY_SET.has(normalizeName(value));
}

function removeRegionTokens(value = '') {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (COUNTRY_REGEX.test(trimmed)) return '';
  if (REGION_REGEX.test(trimmed)) return '';
  return trimmed;
}

function cleanCityName(value = '') {
  if (!value) return '';
  let text = value.trim();
  if (!text) return '';
  text = text.replace(/^\u043c\.?\s*/i, '');
  text = text.replace(/^\u043c\u0456\u0441\u0442\u043e\s+/i, '');
  text = text.replace(/^\u0433\u043e\u0440\u043e\u0434\s+/i, '');
  text = text.replace(/^\u0441\u043c\u0442\s+/i, '');
  text = text.replace(/^\u0441\u0435\u043b\u0438\u0449\u0435\s+/i, '');
  text = text.replace(/^\u0441\u0435\u043b\u043e\s+/i, '');
  text = text.replace(/^\u043f\u043e\u0441\u0435\u043b\u043e\u043a\s+/i, '');
  text = text.replace(/^\u043f\u043e\u0441\u0451\u043b\u043e\u043a\s+/i, '');
  text = text.replace(/^town\s+/i, '');
  text = text.replace(/^city\s+/i, '');
  return removeRegionTokens(text);
}

function cleanStreetName(value = '') {
  if (!value) return '';
  let text = value.trim();
  if (!text) return '';
  text = text.replace(STREET_PREFIX_REGEX, '');
  return text.trim();
}

function splitLocationParts(value = '') {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => cleanCityName(part))
    .filter(Boolean);
}

function extractGoogleCity(item) {
  if (!item) return '';
  const structured = item.structured_formatting || {};
  const types = item.types || [];
  const isCityLike = types.some((type) => GOOGLE_CITY_TYPES.has(type));
  const cleanedMain = cleanCityName(structured.main_text);
  const secondaryParts = splitLocationParts(structured.secondary_text);
  const descriptionParts = splitLocationParts(item.description).filter((part, index) => {
    if (index === 0 && !isCityLike) {
      return normalizeName(part) !== normalizeName(cleanedMain);
    }
    return true;
  });
  const candidates = [
    ...(isCityLike && cleanedMain ? [cleanedMain] : []),
    ...secondaryParts,
    ...descriptionParts,
  ].filter(Boolean);
  if (!candidates.length && cleanedMain) {
    candidates.push(cleanedMain);
  }
  const major = candidates.find(isMajorCityName);
  return major || candidates[0] || '';
}

function extractGoogleAddressLine(item, cityName) {
  if (!item) return '';
  const structured = item.structured_formatting || {};
  const main = cleanStreetName(structured.main_text);
  if (!main) return '';
  if (cityName && normalizeName(main) === normalizeName(cityName)) {
    return '';
  }
  const types = item.types || [];
  const looksLikeAddress =
    types.some((type) => GOOGLE_ADDRESS_TYPES.has(type)) ||
    /вул|улиц|street|просп|avenue|пров|road|lane|дорога|бульвар/i.test(structured.main_text || '');
  return looksLikeAddress ? main : '';
}

function buildCompactAddress(city, address) {
  if (city && address) {
    return `${city}, ${address}`;
  }
  return city || address || '';
}

// Формуємо другий рядок (район + область), без дублювання міста та країни
function cleanSecondaryText(value = '', mainCity = '') {
  if (!value) return '';
  const mainNorm = normalizeName(mainCity || '');
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    // Прибираємо країну
    .filter((part) => !COUNTRY_REGEX.test(part))
    // Прибираємо повтор міста, якщо збігається з першим рядком
    .filter((part) => {
      if (!mainNorm) return true;
      return normalizeName(part) !== mainNorm;
    })
    .join(', ');
}

function findAddressComponent(components = [], targetTypes = []) {
  if (!components?.length) return undefined;
  return components.find((component) =>
    component.types?.some((type) => targetTypes.includes(type)),
  );
}

function isVillageText(text = '') {
  if (!text) return false;
  return VILLAGE_TEXT_REGEX.test(text);
}

function getGoogleSettlementTier(item) {
  const types = item.types || [];
  const isCitySuggestion = types.some((type) => GOOGLE_CITY_TYPES.has(type));
  const cityName = extractGoogleCity(item);
  if (isCitySuggestion && cityName && isMajorCityName(cityName)) {
    return 0;
  }
  if (types.some((type) => GOOGLE_VILLAGE_TYPES.has(type))) {
    return 2;
  }
  const combinedText = `${item.description || ''} ${item.structured_formatting?.secondary_text || ''}`;
  if (isVillageText(combinedText)) {
    return 2;
  }
  return 1;
}

function prioritizeGoogleSuggestions(items = []) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => ({
      item,
      index,
      tier: getGoogleSettlementTier(item),
    }))
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

// ---- helpers (Google Places)
function getSessionToken() {
  // простий токен на сесію автокомпліта
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function AddressSearchInput({
  value,
  onChangeText,
  onSelect,
  placeholder,
  navigation,
  onOpenMap,
  onCloseMap,
  lat,
  lon,
  currentLocation,
  style,
  googleApiKey,        // обов'язково для Google Places
  country = 'ua',      // обмеження країни
  language = 'uk',     // мова підказок
  suggestionStyles,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const timer = useRef(null);
  const sessionTokenRef = useRef(getSessionToken());
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const focusFrameRef = useRef(null);
  const focusTimeoutRef = useRef(null);
  const selectionFrameRef = useRef(null);
  const [anchorLayout, setAnchorLayout] = useState(null);
  const windowSize = useWindowDimensions();
  const [forcedSelection, setForcedSelection] = useState(null);
  const MIN_INPUT_HEIGHT = 56;
  const MAX_INPUT_HEIGHT = 112; // allow up to two lines
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const handleContentSizeChange = useCallback((e) => {
    const measured = e?.nativeEvent?.contentSize?.height ?? MIN_INPUT_HEIGHT;
    // small threshold: single-line text should be <= ~28px
    if (measured <= 28) {
      setInputHeight(MIN_INPUT_HEIGHT);
      return;
    }
    const h = measured + 12; // padding so text doesn't clip
    const newH = Math.max(MIN_INPUT_HEIGHT, Math.min(MAX_INPUT_HEIGHT, h));
    setInputHeight(newH);
  }, []);

  // Fallback for platforms where contentSize may be unreliable (e.g., pasted long text)
  useEffect(() => {
    if (!value) { setInputHeight(MIN_INPUT_HEIGHT); return; }
    if (value.length > 60) { setInputHeight(MAX_INPUT_HEIGHT); }
    else { setInputHeight(MIN_INPUT_HEIGHT); }
  }, [value]);

  const jumpCaretToStart = useCallback(() => {
    if (selectionFrameRef.current) {
      cancelAnimationFrame(selectionFrameRef.current);
      selectionFrameRef.current = null;
    }
    setForcedSelection({ start: 0, end: 0 });
    selectionFrameRef.current = requestAnimationFrame(() => {
      selectionFrameRef.current = null;
      setForcedSelection(null);
    });
  }, []);

  const updateAnchorLayout = useCallback(() => {
    if (!containerRef.current) return;
    if (typeof containerRef.current.measureInWindow === 'function') {
      containerRef.current.measureInWindow((x, y, width, height) => {
        setAnchorLayout({ x, y, width, height });
      });
      return;
    }
    if (typeof containerRef.current.measure === 'function') {
      containerRef.current.measure((x, y, width, height, pageX, pageY) => {
        setAnchorLayout({
          x: pageX ?? x,
          y: pageY ?? y,
          width,
          height,
        });
      });
    }
  }, []);

  useEffect(() => {
    updateAnchorLayout();
  }, [updateAnchorLayout, windowSize.width, windowSize.height]);

  useEffect(() => {
    if (!suggestions.length) return;
    const frame = requestAnimationFrame(updateAnchorLayout);
    return () => cancelAnimationFrame(frame);
  }, [suggestions.length, updateAnchorLayout]);

  const handleContainerLayout = useCallback(() => {
    updateAnchorLayout();
  }, [updateAnchorLayout]);

  const dropdownMetrics = useMemo(() => {
    if (!anchorLayout) {
      return { height: DROPDOWN_MAX_HEIGHT, direction: 'below' };
    }
    const spaceAbove = Math.max(anchorLayout.y - DROPDOWN_MARGIN, 0);
    const spaceBelow = Math.max(
      windowSize.height - (anchorLayout.y + anchorLayout.height) - DROPDOWN_MARGIN,
      0,
    );
    const openAbove = spaceBelow < MIN_SPACE_BELOW && spaceAbove > spaceBelow;
    const availableSpace = openAbove ? spaceAbove : spaceBelow;
    const safeAvailable = availableSpace > 0 ? availableSpace : DROPDOWN_MAX_HEIGHT;
    const height = Math.min(DROPDOWN_MAX_HEIGHT, safeAvailable);
    return {
      height,
      direction: openAbove ? 'above' : 'below',
    };
  }, [anchorLayout, windowSize.height]);

  const dropdownBounds = useMemo(() => {
    if (!anchorLayout) return null;
    const { width } = anchorLayout;
    const { height, direction } = dropdownMetrics;
    const y =
      direction === 'above'
        ? anchorLayout.y - height - DROPDOWN_MARGIN
        : anchorLayout.y + anchorLayout.height + DROPDOWN_MARGIN;
    return {
      x: anchorLayout.x,
      y,
      width,
      height,
    };
  }, [anchorLayout, dropdownMetrics]);

  const backdropAreas = useMemo(() => {
    if (!dropdownBounds) {
      return [{ key: 'full', style: null }];
    }
    const areas = [];
    const topSpace = Math.max(dropdownBounds.y, 0);
    if (topSpace > 0) {
      areas.push({
        key: 'top',
        style: {
          top: 0,
          left: 0,
          right: 0,
          bottom: Math.max(windowSize.height - dropdownBounds.y, 0),
        },
      });
    }
    const bottomSpace = Math.max(windowSize.height - (dropdownBounds.y + dropdownBounds.height), 0);
    if (bottomSpace > 0) {
      areas.push({
        key: 'bottom',
        style: {
          top: dropdownBounds.y + dropdownBounds.height,
          left: 0,
          right: 0,
          bottom: 0,
        },
      });
    }
    const sharedTop = Math.max(dropdownBounds.y, 0);
    const sharedBottom = Math.max(windowSize.height - (dropdownBounds.y + dropdownBounds.height), 0);
    const leftSpace = Math.max(dropdownBounds.x, 0);
    if (leftSpace > 0) {
      areas.push({
        key: 'left',
        style: {
          top: sharedTop,
          bottom: sharedBottom,
          left: 0,
          right: Math.max(windowSize.width - dropdownBounds.x, 0),
        },
      });
    }
    const rightSpace = Math.max(windowSize.width - (dropdownBounds.x + dropdownBounds.width), 0);
    if (rightSpace > 0) {
      areas.push({
        key: 'right',
        style: {
          top: sharedTop,
          bottom: sharedBottom,
          left: dropdownBounds.x + dropdownBounds.width,
          right: 0,
        },
      });
    }
    return areas.length ? areas : [{ key: 'full', style: null }];
  }, [dropdownBounds, windowSize.height, windowSize.width]);

  const handleDismiss = useCallback(() => {
    setSuggestions([]);
  }, []);

  const focusInput = useCallback((onlyWhenBlurred = false) => {
    if (focusFrameRef.current) {
      cancelAnimationFrame(focusFrameRef.current);
      focusFrameRef.current = null;
    }
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
      focusTimeoutRef.current = null;
    }
    focusFrameRef.current = requestAnimationFrame(() => {
      if (onlyWhenBlurred && inputRef.current?.isFocused?.()) {
        focusFrameRef.current = null;
        return;
      }
      inputRef.current?.focus?.();
      focusTimeoutRef.current = setTimeout(() => {
        if (onlyWhenBlurred && inputRef.current?.isFocused?.()) {
          focusTimeoutRef.current = null;
          return;
        }
        inputRef.current?.focus?.();
        focusTimeoutRef.current = null;
      }, 40);
      focusFrameRef.current = null;
    });
  }, []);

  const handleClear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    onChangeText?.('');
    setSuggestions([]);
    setInputHeight(MIN_INPUT_HEIGHT);
    focusInput();
  }, [focusInput, onChangeText]);

  const showDropdown = suggestions.length > 0;

  useEffect(() => {
    if (!showDropdown) return;
    focusInput(true);
  }, [focusInput, showDropdown]);

  useEffect(() => {
    if (!showDropdown) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleDismiss();
      return true;
    });
    return () => sub.remove();
  }, [handleDismiss, showDropdown]);

  useEffect(() => () => {
    if (focusFrameRef.current) cancelAnimationFrame(focusFrameRef.current);
    if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
    if (selectionFrameRef.current) {
      cancelAnimationFrame(selectionFrameRef.current);
      selectionFrameRef.current = null;
    }
  }, []);

  const handleInputFocus = useCallback(() => {
    if (!value?.length) return;
    jumpCaretToStart();
  }, [jumpCaretToStart, value]);

  const handleInputBlur = useCallback(() => {
    if (selectionFrameRef.current) {
      cancelAnimationFrame(selectionFrameRef.current);
      selectionFrameRef.current = null;
    }
    setForcedSelection(null);
  }, []);

  // ---- нормалізація підказки у два рядки
  const toTwoLine = (item) => {
    if (!item) return { id: '', main: '', sub: '' };
    const cityName = extractGoogleCity(item);
    const addressLine = extractGoogleAddressLine(item, cityName);
    const descriptionFirstPart = (item.description || '').split(',')[0] || '';
    const fallback =
      cleanCityName(item.structured_formatting?.main_text || '') ||
      cleanCityName(descriptionFirstPart);
    const secondary = cleanSecondaryText(item.structured_formatting?.secondary_text || '');
    return {
      id: item.place_id || item.description || `${fallback}:${secondary}`,
      main: cityName || fallback || item.description || '',
      sub: addressLine || secondary,
    };
  };

  async function loadSuggestions(text) {
    const query = (text || '').trim();
    if (!query.length || !googleApiKey) {
      setSuggestions([]);
      return;
    }
    try {
      const params = new URLSearchParams({
        input: query,
        key: googleApiKey,
        sessiontoken: sessionTokenRef.current,
        language,
        components: `country:${country}`,
      });
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
      );
      const data = await res.json();
      if (!data || (data.status !== 'OK' && data.status !== 'ZERO_RESULTS')) {
        setSuggestions([]);
        return;
      }
      const predictions = Array.isArray(data.predictions) ? data.predictions : [];
      setSuggestions(prioritizeGoogleSuggestions(predictions).slice(0, MAX_GOOGLE_SUGGESTIONS));
    } catch {
      setSuggestions([]);
    }
  }

  function handleChange(text) {
    onChangeText?.(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => loadSuggestions(text), 500);
  }

  async function handleSelectGoogle(item) {
    try {
      // Треба дістати координати — Place Details
      const params = new URLSearchParams({
        place_id: item.place_id,
        key: googleApiKey,
        language,
        sessiontoken: sessionTokenRef.current,
        fields: 'geometry,name,formatted_address,address_components',
      });
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`);
      const data = await res.json();
      const r = data.result;
      if (!r?.geometry?.location) return;
      const loc = r.geometry.location;
      const components = r.address_components || [];
      const cityComponent =
        findAddressComponent(components, ['locality', 'postal_town', 'administrative_area_level_3']) ||
        findAddressComponent(components, ['administrative_area_level_2']) ||
        findAddressComponent(components, ['administrative_area_level_1']);
      const streetComponent = findAddressComponent(components, ['route']);
      const houseComponent = findAddressComponent(components, ['street_number']);
      const countryComponent = findAddressComponent(components, ['country']);
      const postalComponent = findAddressComponent(components, ['postal_code']);
      const cityName =
        cleanCityName(cityComponent?.long_name || cityComponent?.short_name || '') ||
        cleanCityName(r.vicinity || '') ||
        extractGoogleCity(item);
      const streetName = cleanStreetName(streetComponent?.long_name || streetComponent?.short_name || '');
      const houseNumber = (houseComponent?.long_name || houseComponent?.short_name || '').trim();
      const addressLine = [streetName, houseNumber].filter(Boolean).join(' ');
      const fallbackFromPrediction = cleanStreetName(item.structured_formatting?.main_text || '');
      const safeAddressLine =
        addressLine ||
        (cityName && normalizeName(fallbackFromPrediction) === normalizeName(cityName) ? '' : fallbackFromPrediction);
      const compactText =
        buildCompactAddress(cityName, safeAddressLine) ||
        r.formatted_address ||
        item.description;
      const point = {
        text: compactText,
        lat: Number(loc.lat),
        lon: Number(loc.lng),
        city: cityName,
        address: safeAddressLine,
        country: countryComponent?.long_name || countryComponent?.short_name || '',
        postcode: postalComponent?.long_name || postalComponent?.short_name || '',
      };
      onSelect?.(point);
      onChangeText?.(point.text);
      jumpCaretToStart();
      setSuggestions([]);
      // новий токен на наступну сесію
      sessionTokenRef.current = getSessionToken();
    } catch {
      // ignore
    }
  }

  const containerStyle = useMemo(() => ({
    position: 'relative',
    zIndex: suggestions.length > 0 ? 1000 : 100,
    elevation: suggestions.length > 0 ? 50 : 0,
  }), [suggestions.length]);

  return (
    <View
      ref={containerRef}
      onLayout={handleContainerLayout}
      style={containerStyle}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={styles.inputWrapper}>
          <AppInput
            ref={inputRef}
            placeholder={placeholder}
            value={value}
            onChangeText={handleChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            blurOnSubmit={false}
            selection={forcedSelection ?? undefined}
            multiline
            onContentSizeChange={handleContentSizeChange}
            style={[
              style,
              styles.inputFlex,
              value ? styles.inputWithClear : null,
              {
                height: inputHeight,
                // center single-line text, top-align multi-line with padding
                textAlignVertical: inputHeight > MIN_INPUT_HEIGHT ? 'top' : 'center',
                paddingTop: inputHeight > MIN_INPUT_HEIGHT ? 10 : 0,
                paddingBottom: inputHeight > MIN_INPUT_HEIGHT ? 8 : 0,
              },
            ]}
          />
          {!!value && (
            <TouchableOpacity
              onPress={handleClear}
              style={styles.clearBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={20} color={colors.gray500} />
            </TouchableOpacity>
          )}
        </View>
        {navigation && (
          <TouchableOpacity
            style={styles.mapBtn}
            onPress={() => {
              onOpenMap?.();
              const onSelectId = registerCallback((p) => {
                const LOG = '[AddressSearchInput]';
                console.log(LOG, 'Map callback викликано, p.text:', p?.text ?? '(немає)');
                onSelect?.(p);
                const textToSet = p?.text || value;
                console.log(LOG, 'onChangeText з:', textToSet || '(порожньо)');
                onChangeText?.(textToSet);
              });
              const onCloseId = registerCallback(onCloseMap);
              navigation.navigate('MapSelect', {
                address: value,
                lat,
                lon,
                userLat: currentLocation?.latitude,
                userLon: currentLocation?.longitude,
                onSelectId,
                onCloseId,
              });
            }}
          >
            <Ionicons name="map" size={24} color={colors.green} />
          </TouchableOpacity>
        )}
      </View>

      {showDropdown && (
        <Portal>
          <View style={styles.portalRoot} pointerEvents="box-none">
            {backdropAreas.map((area) => (
              <Pressable
                key={area.key}
                style={[styles.portalBackdrop, area.style]}
                onPress={handleDismiss}
              />
            ))}
            {dropdownBounds && (
              <View
                pointerEvents="auto"
                style={[
                  styles.portalDropdownWrapper,
                  {
                    top: dropdownBounds.y,
                    left: dropdownBounds.x,
                    width: dropdownBounds.width,
                  },
                ]}
              >
                <View
                  style={[
                    styles.suggestionsDropdown,
                    styles.suggestionsBox,
                    suggestionStyles?.dropdown,
                    suggestionStyles?.box,
                    { maxHeight: dropdownBounds.height },
                  ]}
                >
                  <ScrollView
                    keyboardShouldPersistTaps="always"
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                    style={[
                      styles.suggestionsScroll,
                      { maxHeight: dropdownBounds.height },
                    ]}
                  >
                    {suggestions.map((item) => {
                      const two = toTwoLine(item);
                      return (
                        <TouchableOpacity
                          key={two.id}
                          style={[styles.suggestionItem, suggestionStyles?.item]}
                      onPress={() => handleSelectGoogle(item)}
                    >
                      <AppText
                        style={[styles.suggestionMain, suggestionStyles?.main]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {two.main}
                      </AppText>
                      {!!two.sub && (
                        <AppText
                          style={[styles.suggestionSub, suggestionStyles?.sub]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {two.sub}
                        </AppText>
                      )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            )}
          </View>
        </Portal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrapper: {
    flex: 1,
    position: 'relative',
  },
  inputFlex: {
    flex: 1,
  },
  inputWithClear: {
    paddingRight: 44,
  },
  clearBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionsBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.gray300,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: colors.gray100,
    backgroundColor: colors.surface,
  },
  suggestionMain: {
    fontSize: 16,
    color: colors.gray900,
  },
  suggestionSub: {
    fontSize: 13,
    color: colors.gray600,
    marginTop: 2,
  },
  suggestionsScroll: {
    maxHeight: DROPDOWN_MAX_HEIGHT,
  },
  suggestionsDropdown: {
    backgroundColor: colors.surface,
    zIndex: 9999,
    elevation: 5,
  },
  portalRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
  },
  portalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  portalDropdownWrapper: {
    position: 'absolute',
  },
  mapBtn: {
    marginLeft: 8,
    borderColor: colors.green,
    borderWidth: 1,
    padding: 5,
    borderRadius: 12,
  },
});
