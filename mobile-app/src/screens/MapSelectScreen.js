import React, { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Marker } from 'react-native-maps';
import AppMap from '../components/AppMap';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import AppButton from '../components/AppButton';
import CheckBox from '../components/CheckBox';
import { colors } from '../components/Colors';
import { formatPointAddress } from '../addressFormat';
import { getCallback, unregisterCallback } from '../callbackRegistry';

const DEFAULT_COORDS = { latitude: 50.4501, longitude: 30.5234 };
const DEFAULT_DELTA = 0.05;
const LOCATION_STORAGE_KEYS = ['userLocation', 'location'];
const MAP_PROVIDER_STORAGE_KEY = 'mapSelectProvider';
const MAP_PROVIDER_REMEMBER_STORAGE_KEY = 'mapSelectProviderRemember';

function toCoords(lat, lon) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function toRegion(coords) {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    latitudeDelta: DEFAULT_DELTA,
    longitudeDelta: DEFAULT_DELTA,
  };
}

function parseStoredCoords(value) {
  if (!value) return null;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return toCoords(parsed?.latitude, parsed?.longitude);
  } catch {
    return null;
  }
}

async function getCachedUserCoords() {
  for (const key of LOCATION_STORAGE_KEYS) {
    const stored = await AsyncStorage.getItem(key);
    const coords = parseStoredCoords(stored);
    if (coords) return coords;
  }
  return null;
}

async function storeUserCoords(coords) {
  const value = JSON.stringify(coords);
  await Promise.all(
    LOCATION_STORAGE_KEYS.map((key) => AsyncStorage.setItem(key, value))
  );
}

function buildPointPayload(coords, data = {}) {
  const addr = data.address || {};
  const shortAddress = [addr.road, addr.house_number]
    .filter(Boolean)
    .join(' ');

  return {
    lat: coords.latitude,
    lon: coords.longitude,
    text: data.display_name || '',
    city: addr.city || addr.town || addr.village || addr.state || '',
    address: shortAddress,
    country: addr.country || '',
    postcode: addr.postcode || '',
  };
}

async function reverseGeocode(coords) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json&addressdetails=1`,
    { headers: { 'User-Agent': 'vango-app' } }
  );
  const data = await res.json();
  return buildPointPayload(coords, data);
}

async function geocodeAddress(query) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&format=json&limit=1&countrycodes=ua&addressdetails=1`,
    { headers: { 'User-Agent': 'vango-app' } }
  );
  const data = await res.json();
  const item = Array.isArray(data) ? data[0] : null;
  const coords = toCoords(item?.lat, item?.lon);
  if (!coords) return null;
  return buildPointPayload(coords, item);
}

function getCompactAddress(point) {
  return formatPointAddress(point) || point?.text || '';
}

export default function MapSelectScreen({ navigation, route }) {
  const { onSelectId, onCloseId, address, lat, lon, userLat, userLon } =
    route.params || {};
  const onSelect = getCallback(onSelectId);
  const onClose = getCallback(onCloseId);
  const addressText = String(address || '').trim();
  const selectedCoords = toCoords(lat, lon);
  const initialUserCoords = toCoords(userLat, userLon);
  const [region, setRegion] = useState(() =>
    toRegion(selectedCoords || initialUserCoords || DEFAULT_COORDS)
  );
  const [marker, setMarker] = useState(selectedCoords);
  const [selectedPlace, setSelectedPlace] = useState(() =>
    selectedCoords && addressText
      ? {
          lat: selectedCoords.latitude,
          lon: selectedCoords.longitude,
          text: addressText,
          address: addressText,
      }
      : null
  );
  const [addressValue, setAddressValue] = useState(addressText);
  const [addressLoading, setAddressLoading] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [mapProvider, setMapProvider] = useState('google');
  const [providerChoice, setProviderChoice] = useState('google');
  const [rememberMapChoice, setRememberMapChoice] = useState(false);
  const [providerChooserVisible, setProviderChooserVisible] = useState(false);
  const [selectedFromUserLocation, setSelectedFromUserLocation] = useState(false);
  const mapRef = useRef(null);
  const geocodeRequestRef = useRef(0);
  const addressLookupTimeoutRef = useRef(null);
  const addressEditedByUserRef = useRef(false);
  const skipNextReverseGeocodeRef = useRef(false);
  const bottomPanelOffset = keyboardOffset > 0 ? 72 : 32;

  function moveToCoords(coords) {
    const nextRegion = toRegion(coords);
    setRegion(nextRegion);
    if (mapRef.current?.animateToRegion) {
      mapRef.current.animateToRegion(nextRegion, 500);
    }
  }

  function handleLocationCentered(coords) {
    const point = toCoords(coords?.latitude, coords?.longitude);
    if (!point) return;
    if (addressLookupTimeoutRef.current) {
      clearTimeout(addressLookupTimeoutRef.current);
      addressLookupTimeoutRef.current = null;
    }
    addressEditedByUserRef.current = false;
    setMarker(point);
    setSelectedFromUserLocation(true);
  }

  function handleMapPress(e) {
    if (addressLookupTimeoutRef.current) {
      clearTimeout(addressLookupTimeoutRef.current);
      addressLookupTimeoutRef.current = null;
    }
    addressEditedByUserRef.current = false;
    setMarker(e.nativeEvent.coordinate);
    setSelectedFromUserLocation(false);
  }

  async function moveMarkerToAddress(query, { syncInput = false } = {}) {
    const normalizedQuery = String(query || '').trim();
    if (!normalizedQuery) return;

    const requestId = geocodeRequestRef.current + 1;
    geocodeRequestRef.current = requestId;
    setAddressLoading(true);

    try {
      const place = await geocodeAddress(normalizedQuery);
      if (geocodeRequestRef.current !== requestId || !place) return;

      const coords = { latitude: place.lat, longitude: place.lon };
      skipNextReverseGeocodeRef.current = true;
      setSelectedPlace(place);
      if (syncInput) {
        addressEditedByUserRef.current = false;
        setAddressValue(getCompactAddress(place) || normalizedQuery);
      }
      setMarker(coords);
      setSelectedFromUserLocation(false);
      moveToCoords(coords);
    } catch {
      // Keep the manually entered text if geocoding fails.
    } finally {
      if (geocodeRequestRef.current === requestId) {
        setAddressLoading(false);
      }
    }
  }

  function handleAddressChange(text) {
    addressEditedByUserRef.current = true;
    setAddressValue(text);
  }

  function handleAddressSubmit() {
    if (addressLookupTimeoutRef.current) {
      clearTimeout(addressLookupTimeoutRef.current);
      addressLookupTimeoutRef.current = null;
    }
    moveMarkerToAddress(addressValue, { syncInput: true });
  }

  function openProviderChooser() {
    setProviderChoice(mapProvider);
    setProviderChooserVisible(true);
  }

  async function applyMapProviderChoice(provider = providerChoice) {
    setMapProvider(provider);
    setProviderChoice(provider);
    setProviderChooserVisible(false);

    try {
      if (rememberMapChoice) {
        await AsyncStorage.multiSet([
          [MAP_PROVIDER_STORAGE_KEY, provider],
          [MAP_PROVIDER_REMEMBER_STORAGE_KEY, 'true'],
        ]);
      } else {
        await AsyncStorage.multiRemove([
          MAP_PROVIDER_STORAGE_KEY,
          MAP_PROVIDER_REMEMBER_STORAGE_KEY,
        ]);
      }
    } catch {}
  }

  useEffect(() => {
    let mounted = true;

    async function centerOnUser() {
      if (selectedCoords || addressText) return;

      try {
        if (!initialUserCoords) {
          const cached = await getCachedUserCoords();
          if (cached && mounted) {
            moveToCoords(cached);
          }
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const loc = await Location.getCurrentPositionAsync({});
        const coords = toCoords(loc?.coords?.latitude, loc?.coords?.longitude);
        if (!coords) return;

        await storeUserCoords(coords);
        if (mounted) {
          moveToCoords(coords);
        }
      } catch {
        // Keep the default region if location is unavailable.
      }
    }

    centerOnUser();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;

    let mounted = true;
    Promise.all([
      AsyncStorage.getItem(MAP_PROVIDER_STORAGE_KEY),
      AsyncStorage.getItem(MAP_PROVIDER_REMEMBER_STORAGE_KEY),
    ])
      .then(([value, remember]) => {
        if (!mounted) return;
        const hasSavedProvider = value === 'apple' || value === 'google';
        const shouldRemember = remember === 'true' && hasSavedProvider;
        if (shouldRemember) {
          setMapProvider(value);
          setProviderChoice(value);
          setRememberMapChoice(true);
        } else {
          setProviderChoice('google');
          setRememberMapChoice(false);
          setProviderChooserVisible(true);
        }
      })
      .catch(() => {
        if (mounted) setProviderChooserVisible(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    async function geocode() {
      if (!marker && addressText) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
              addressText
            )}&format=json&limit=1&countrycodes=ua`,
            { headers: { 'User-Agent': 'vango-app' } }
          );
          const data = await res.json();
          if (data && data[0]) {
            const la = parseFloat(data[0].lat);
            const lo = parseFloat(data[0].lon);
            const newRegion = {
              latitude: la,
              longitude: lo,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            };
            setRegion(newRegion);
            if (mapRef.current?.animateToRegion) {
              mapRef.current.animateToRegion(newRegion, 500);
            }
            setMarker({ latitude: la, longitude: lo });
          }
        } catch {}
      }
    }
    geocode();
  }, []);

  useEffect(() => {
    if (!marker) {
      setSelectedPlace(null);
      if (!addressEditedByUserRef.current) {
        setAddressValue('');
      }
      setAddressLoading(false);
      return;
    }

    if (skipNextReverseGeocodeRef.current) {
      skipNextReverseGeocodeRef.current = false;
      return;
    }

    const requestId = geocodeRequestRef.current + 1;
    geocodeRequestRef.current = requestId;
    setAddressLoading(true);

    const timeoutId = setTimeout(async () => {
      try {
        const place = await reverseGeocode(marker);
        if (geocodeRequestRef.current === requestId) {
          setSelectedPlace(place);
          if (!addressEditedByUserRef.current) {
            setAddressValue(getCompactAddress(place));
          }
        }
      } catch {
        if (geocodeRequestRef.current === requestId) {
          setSelectedPlace({
            lat: marker.latitude,
            lon: marker.longitude,
            text: '',
          });
          if (!addressEditedByUserRef.current) {
            setAddressValue('');
          }
        }
      } finally {
        if (geocodeRequestRef.current === requestId) {
          setAddressLoading(false);
        }
      }
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [marker]);

  useEffect(() => {
    if (!addressEditedByUserRef.current) return undefined;

    if (addressLookupTimeoutRef.current) {
      clearTimeout(addressLookupTimeoutRef.current);
    }

    const query = addressValue.trim();
    if (!query) {
      setAddressLoading(false);
      return undefined;
    }

    addressLookupTimeoutRef.current = setTimeout(() => {
      moveMarkerToAddress(query);
      addressLookupTimeoutRef.current = null;
    }, 650);

    return () => {
      if (addressLookupTimeoutRef.current) {
        clearTimeout(addressLookupTimeoutRef.current);
        addressLookupTimeoutRef.current = null;
      }
    };
  }, [addressValue]);

  useEffect(
    () => () => {
      if (addressLookupTimeoutRef.current) {
        clearTimeout(addressLookupTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardOffset(event.endCoordinates?.height || 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardOffset(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      try {
        if (onClose) onClose();
      } finally {
        unregisterCallback(onSelectId);
        unregisterCallback(onCloseId);
      }
    });
    return unsubscribe;
  }, [navigation, onClose, onCloseId, onSelectId]);

  async function confirm() {
    if (onSelect && marker) {
      try {
        if (addressEditedByUserRef.current && addressValue.trim()) {
          const place = await geocodeAddress(addressValue.trim());
          if (place) {
            onSelect(place);
            navigation.goBack();
            return;
          }
        }

        const selectedPlaceMatchesMarker =
          selectedPlace?.lat === marker.latitude &&
          selectedPlace?.lon === marker.longitude;
        onSelect(selectedPlaceMatchesMarker ? selectedPlace : await reverseGeocode(marker));
      } catch {
        onSelect({ lat: marker.latitude, lon: marker.longitude });
      }
    }
    navigation.goBack();
  }

  return (
    <View style={{ flex: 1 }}>
      <AppMap
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        onLocationCentered={handleLocationCentered}
        showsUserLocation
        mapProvider={mapProvider}
        onPress={handleMapPress}
      >
        {marker && !selectedFromUserLocation && <Marker coordinate={marker} />}
      </AppMap>
      <TouchableOpacity
        style={styles.back}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={32} color="#333" />
      </TouchableOpacity>
      {Platform.OS === 'ios' && (
        <TouchableOpacity
          style={styles.providerButton}
          onPress={openProviderChooser}
          activeOpacity={0.85}
        >
          <Ionicons name="map-outline" size={16} color={colors.text} />
          <Text style={styles.providerButtonText}>
            Карта: {mapProvider === 'apple' ? 'Apple' : 'Google'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.gray500} />
        </TouchableOpacity>
      )}
      {marker && (
        <View style={[styles.bottomPanel, { bottom: bottomPanelOffset }]}>
          <View style={styles.addressField}>
            {addressLoading ? (
              <ActivityIndicator size="small" color={colors.green} />
            ) : null}
            <TextInput
              style={[
                styles.addressInput,
                !addressValue.trim() && styles.addressPlaceholder,
              ]}
              value={addressValue}
              onChangeText={handleAddressChange}
              onSubmitEditing={handleAddressSubmit}
              placeholder={addressLoading ? 'Визначаємо адресу...' : 'Введіть адресу'}
              placeholderTextColor={colors.gray500}
              returnKeyType="search"
              multiline
              numberOfLines={2}
            />
          </View>
          <AppButton
            title="Підтвердити"
            onPress={confirm}
            style={styles.confirm}
            fullWidth={false}
          />
        </View>
      )}
      {Platform.OS === 'ios' && (
        <Modal
          visible={providerChooserVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setProviderChooserVisible(false)}
        >
          <View style={styles.providerModalBackdrop}>
            <View style={styles.providerModalCard}>
              <Text style={styles.providerModalTitle}>Оберіть карту</Text>
              <Text style={styles.providerModalText}>
                Виберіть карту, у якій зручно поставити точку.
              </Text>
              <View style={styles.providerModalOptions}>
                <TouchableOpacity
                  style={[
                    styles.providerModalOption,
                    providerChoice === 'google' && styles.providerModalOptionActive,
                  ]}
                  onPress={() => setProviderChoice('google')}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="map-outline"
                    size={20}
                    color={providerChoice === 'google' ? colors.green : colors.text}
                  />
                  <Text style={styles.providerModalOptionText}>Google Maps</Text>
                  {providerChoice === 'google' && (
                    <Ionicons name="checkmark" size={20} color={colors.green} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.providerModalOption,
                    providerChoice === 'apple' && styles.providerModalOptionActive,
                  ]}
                  onPress={() => setProviderChoice('apple')}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="map"
                    size={20}
                    color={providerChoice === 'apple' ? colors.green : colors.text}
                  />
                  <Text style={styles.providerModalOptionText}>Apple Maps</Text>
                  {providerChoice === 'apple' && (
                    <Ionicons name="checkmark" size={20} color={colors.green} />
                  )}
                </TouchableOpacity>
              </View>
              <CheckBox
                value={rememberMapChoice}
                onChange={setRememberMapChoice}
                label="Запамʼятати вибір"
                style={styles.providerRemember}
              />
              <View style={styles.providerModalActions}>
                <TouchableOpacity
                  style={styles.providerCancelButton}
                  onPress={() => setProviderChooserVisible(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.providerCancelText}>Скасувати</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.providerApplyButton}
                  onPress={() => applyMapProviderChoice()}
                  activeOpacity={0.85}
                >
                  <Text style={styles.providerApplyText}>Відкрити</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    position: 'absolute',
    top: 40,
    left: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 6,
  },
  providerButton: {
    position: 'absolute',
    top: 54,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  providerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  providerModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  providerModalCard: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  providerModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  providerModalText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: colors.gray500,
  },
  providerModalOptions: {
    marginTop: 16,
    gap: 10,
  },
  providerModalOption: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  providerModalOptionActive: {
    borderColor: colors.green,
    backgroundColor: colors.press,
  },
  providerModalOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  providerRemember: {
    marginTop: 16,
  },
  providerModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  providerCancelButton: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  providerApplyButton: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.green,
  },
  providerCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  providerApplyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 32,
    left: 20,
    right: 20,
  },
  addressField: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  addressInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 46,
    padding: 0,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
    textAlignVertical: 'center',
  },
  addressPlaceholder: {
    color: colors.gray500,
  },
  confirm: { marginVertical: 0 },
});
