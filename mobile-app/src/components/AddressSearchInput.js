import React, { useState, useRef, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppInput from './AppInput';
import AppText from './AppText';
import { colors } from './Colors';
import { registerCallback } from '../callbackRegistry';

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
  // NEW:
  provider = 'google', // 'google' | 'osm'
  googleApiKey,        // обов'язково, якщо provider='google'
  country = 'ua',      // обмеження країни
  language = 'uk',     // мова підказок
  suggestionStyles,    // { dropdown, box, item, main, sub } (необов'язково)
}) {
  const [suggestions, setSuggestions] = useState([]);
  const timer = useRef(null);
  const sessionTokenRef = useRef(getSessionToken());

  // ---- нормалізація підказки у два рядки
  const toTwoLine = (item) => {
    if (provider === 'google') {
      const s = item.structured_formatting || {};
      return {
        id: item.place_id,
        main: s.main_text || item.description || '',
        sub: s.secondary_text || '',
      };
    }
    // OSM (Nominatim)
    const addr = item.address || {};
    const city = addr.city || addr.town || addr.village || addr.state || '';
    const street = [addr.road, addr.house_number].filter(Boolean).join(' ');
    return {
      id: item.place_id || item.osm_id || item.place_id || item.display_name,
      main: city || item.display_name || '',
      sub: street || item.display_name || '',
    };
  };

  async function loadSuggestions(text) {
    if (text.length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      if (provider === 'google' && googleApiKey) {
        // Places Autocomplete
        const params = new URLSearchParams({
          input: text,
          key: googleApiKey,
          sessiontoken: sessionTokenRef.current,
          language,
          components: `country:${country}`,
        });
        const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`);
        const data = await res.json();
        if (data.status !== 'OK') {
          setSuggestions([]);
          return;
        }
        setSuggestions(data.predictions || []);
      } else {
        // Fallback: OSM Nominatim
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=8&countrycodes=${country}&addressdetails=1`,
          { headers: { 'User-Agent': 'vango-app' } }
        );
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
      }
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
        fields: 'geometry,name,formatted_address,address_component',
      });
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`);
      const data = await res.json();
      const r = data.result;
      if (!r?.geometry?.location) return;
      const loc = r.geometry.location;
      const point = {
        text: r.formatted_address || item.description,
        lat: Number(loc.lat),
        lon: Number(loc.lng),
        city: item.structured_formatting?.main_text || '',
        address: item.description || r.formatted_address || '',
        country: '',
        postcode: '',
      };
      onSelect?.(point);
      onChangeText?.(point.text);
      setSuggestions([]);
      // новий токен на наступну сесію
      sessionTokenRef.current = getSessionToken();
    } catch {
      // ignore
    }
  }

  function handleSelectOsm(item) {
    const addr = item.address || {};
    const cityName = addr.city || addr.town || addr.village || addr.state || '';
    const point = {
      text: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      city: cityName,
      address: [addr.road, addr.house_number].filter(Boolean).join(' '),
      country: addr.country || '',
      postcode: addr.postcode || '',
    };
    onSelect?.(point);
    onChangeText?.(point.text);
    setSuggestions([]);
  }

  const containerStyle = useMemo(() => ({
    position: 'relative',
    zIndex: suggestions.length > 0 ? 1000 : 100,
    elevation: suggestions.length > 0 ? 50 : 0,
  }), [suggestions.length]);

  return (
    <View style={containerStyle}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AppInput
          placeholder={placeholder}
          value={value}
          onChangeText={handleChange}
          style={[style, { flex: 1 }]}
        />
        {navigation && (
          <TouchableOpacity
            style={styles.mapBtn}
            onPress={() => {
              onOpenMap?.();
              const onSelectId = registerCallback((p) => {
                onSelect?.(p);
                onChangeText?.(p.text || value);
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

      {suggestions.length > 0 && (
        <View style={[
          styles.suggestionsDropdown,
          styles.suggestionsBox,
          suggestionStyles?.dropdown,
          suggestionStyles?.box,
        ]}>
          <ScrollView keyboardShouldPersistTaps="handled">
            {suggestions.map((item) => {
              const two = toTwoLine(item);
              return (
                <TouchableOpacity
                  key={two.id}
                  style={[styles.suggestionItem, suggestionStyles?.item]}
                  onPress={() =>
                    provider === 'google' && googleApiKey
                      ? handleSelectGoogle(item)
                      : handleSelectOsm(item)
                  }
                >
                  <AppText style={[styles.suggestionMain, suggestionStyles?.main]}>
                    {two.main}
                  </AppText>
                  {!!two.sub && (
                    <AppText style={[styles.suggestionSub, suggestionStyles?.sub]}>
                      {two.sub}
                    </AppText>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  suggestionsBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    maxHeight: 240,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
 suggestionMain: { fontSize: 16 },
  suggestionSub: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  suggestionsDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    zIndex: 9999,
    elevation: 5,
  },
  mapBtn: { marginLeft: 8 },
});
