import React, { useState, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppInput from './AppInput';
import AppText from './AppText';
import { colors } from './Colors';

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
}) {
  const [suggestions, setSuggestions] = useState([]);
  const timer = useRef(null);

  async function loadSuggestions(text) {
    if (text.length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          text
        )}&format=json&limit=5&countrycodes=ua&addressdetails=1`,
        { headers: { 'User-Agent': 'vango-app' } }
      );
      const data = await res.json();
      setSuggestions(data);
    } catch {}
  }

  function handleChange(text) {
    onChangeText(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => loadSuggestions(text), 1000);
  }

  function handleSelect(item) {
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
    onSelect(point);
    onChangeText(item.display_name);
    setSuggestions([]);
  }

  const containerStyle = {
    position: 'relative',
    zIndex: suggestions.length > 0 ? 1000 : 100,
    elevation: suggestions.length > 0 ? 50 : 0,
  };

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
              if (onOpenMap) onOpenMap();
              navigation.navigate('MapSelect', {
                address: value,
                lat,
                lon,
                userLat: currentLocation?.latitude,
                userLon: currentLocation?.longitude,
                onSelect: (p) => {
                  onSelect(p);
                  onChangeText(p.text || value);
                },
                onClose: onCloseMap,
              });
            }}
          >
            <Ionicons name="map" size={24} color={colors.green} />
          </TouchableOpacity>
        )}
      </View>
      {suggestions.length > 0 && (
        <View style={[styles.suggestionsDropdown, styles.suggestionsBox]}>
          <ScrollView keyboardShouldPersistTaps="handled">
            {suggestions.map((item) => (
              <TouchableOpacity
                key={item.place_id}
                style={styles.suggestionItem}
                onPress={() => handleSelect(item)}
              >
                <AppText style={styles.suggestionMain}>{item.display_name}</AppText>
              </TouchableOpacity>
            ))}
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
    maxHeight: 200,
    overflow: 'hidden',
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  suggestionMain: { fontSize: 16 },
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
