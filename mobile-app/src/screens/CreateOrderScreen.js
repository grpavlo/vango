import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { apiFetch } from '../api';

export default function CreateOrderScreen({ route, navigation }) {
  const { token } = route.params;
  const [pickupQuery, setPickupQuery] = useState('');
  const [pickup, setPickup] = useState(null);
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffQuery, setDropoffQuery] = useState('');
  const [dropoff, setDropoff] = useState(null);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [photo, setPhoto] = useState(null);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');

  async function create() {
    try {
      await apiFetch('/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          pickupLocation: pickup?.text,
          dropoffLocation: dropoff?.text,
          cargoType: description,
          dimensions: `${length}x${width}x${height}`,
          weight: 0,
          timeWindow: '',
          insurance: false,
          price,
        }),
      });
      navigation.goBack();
    } catch (err) {
      console.log(err);
    }
  }

  async function confirmCreate() {
    Alert.alert('Підтвердження', 'Ви впевнені що хочете розмістити вантаж?', [
      { text: 'Скасувати' },
      { text: 'OK', onPress: create },
    ]);
  }

  async function loadSuggestions(text, setter) {
    if (text.length < 3) {
      setter([]);
      return;
    }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          text
        )}&format=json&limit=5`
      );
      const data = await res.json();
      setter(data);
    } catch {}
  }

  useEffect(() => {
    if (pickup && dropoff) {
      async function calc() {
        try {
          const res = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${pickup.lon},${pickup.lat};${dropoff.lon},${dropoff.lat}?overview=false`
          );
          const data = await res.json();
          if (data.routes && data.routes[0]) {
            const km = data.routes[0].distance / 1000;
            let cost = km * 50;
            const factor = Math.random() < 0.5 ? 0.95 : 1.15;
            cost = cost * factor;
            setPrice(cost.toFixed(0));
          }
        } catch {}
      }
      calc();
    }
  }, [pickup, dropoff]);

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5 });
    if (!res.canceled) {
      setPhoto(res.assets[0].uri);
    }
  }

  function renderSuggestion({ item }, setter, querySetter) {
    return (
      <TouchableOpacity
        style={styles.suggestion}
        onPress={() => {
          setter({ text: item.display_name, lat: item.lat, lon: item.lon });
          querySetter(item.display_name);
          setPickupSuggestions([]);
          setDropoffSuggestions([]);
        }}
      >
        <Text>{item.display_name}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <Text>Звідки</Text>
      <TextInput
        style={styles.input}
        value={pickupQuery}
        onChangeText={(t) => {
          setPickupQuery(t);
          setPickup(null);
          loadSuggestions(t, setPickupSuggestions);
        }}
      />
      <FlatList
        data={pickupSuggestions}
        renderItem={(it) => renderSuggestion(it, setPickup, setPickupQuery)}
        keyExtractor={(item) => item.place_id.toString()}
      />

      <Text>Куди</Text>
      <TextInput
        style={styles.input}
        value={dropoffQuery}
        onChangeText={(t) => {
          setDropoffQuery(t);
          setDropoff(null);
          loadSuggestions(t, setDropoffSuggestions);
        }}
      />
      <FlatList
        data={dropoffSuggestions}
        renderItem={(it) => renderSuggestion(it, setDropoff, setDropoffQuery)}
        keyExtractor={(item) => item.place_id.toString()}
      />

      <Text>Габарити (Д x Ш x В, м)</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput style={[styles.input, styles.dim]} value={length} onChangeText={setLength} keyboardType="numeric" placeholder="Д" />
        <TextInput style={[styles.input, styles.dim]} value={width} onChangeText={setWidth} keyboardType="numeric" placeholder="Ш" />
        <TextInput style={[styles.input, styles.dim]} value={height} onChangeText={setHeight} keyboardType="numeric" placeholder="В" />
      </View>

      <Text>Опис вантажу</Text>
      <TextInput style={styles.input} value={description} onChangeText={setDescription} />

      <Button title="Додати фото" onPress={pickImage} />
      {photo && <Image source={{ uri: photo }} style={{ width: 100, height: 100 }} />}

      <Text>Ціна (розраховується автоматично)</Text>
      <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" />

      <Button title="Створити" onPress={confirmCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  input: { borderWidth: 1, padding: 8, marginVertical: 4, flex: 1 },
  dim: { flex: 1 },
  suggestion: {
    padding: 8,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
});
