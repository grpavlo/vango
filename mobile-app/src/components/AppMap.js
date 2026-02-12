import React, { forwardRef, useRef, useImperativeHandle, useState, useEffect } from 'react';
import { Platform, View, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Easing } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Wrapper to ensure we consistently use Google provider across the app.
// Adds a floating "locate" button that centers the map on the user's location.
const AppMap = forwardRef(({ children, style, showMyLocationButton = true, onLocationCentered, ...rest }, ref) => {
  const mapRef = useRef(null);
  useImperativeHandle(ref, () => mapRef.current);
  const [loading, setLoading] = useState(false);
  const spinAnim = useRef(new Animated.Value(0));
  const overlayAnim = useRef(new Animated.Value(0));
  const userLocationRef = useRef(null);

  // Load cached user coords (if any) and try to capture fresh coords on mount
  useEffect(() => {
    let mounted = true;
    async function initUserLocation() {
      try {
        // try load cached first so we have something to use immediately
        const cached = await AsyncStorage.getItem('userLocation');
        if (mounted && cached) {
          try {
            userLocationRef.current = JSON.parse(cached);
            console.log('AppMap: loaded cached userLocation', userLocationRef.current);
          } catch (e) {}
        }
        // request permission and fetch fresh position
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          if (mounted) {
            userLocationRef.current = coords;
            await AsyncStorage.setItem('userLocation', JSON.stringify(coords));
            console.log('AppMap: stored initial userLocation', coords);
          }
        }
      } catch (e) {
        console.warn('AppMap initUserLocation error', e);
      }
    }
    initUserLocation();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const toValue = loading ? 1 : 0;
    Animated.parallel([
      Animated.timing(spinAnim.current, {
        toValue,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim.current, {
        toValue,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [loading]);

  function animateToCoords(lat, lon) {
    const region = {
      latitude: lat,
      longitude: lon,
      latitudeDelta: (rest?.initialRegion?.latitudeDelta) ?? 0.01,
      longitudeDelta: (rest?.initialRegion?.longitudeDelta) ?? 0.01,
    };

    if (!mapRef.current) {
      console.warn('mapRef.current is null');
      return;
    }

    if (mapRef.current.animateToRegion) {
      mapRef.current.animateToRegion(region, 500);
    } else if (mapRef.current.animateCamera) {
      mapRef.current.animateCamera({ center: { latitude: lat, longitude: lon } }, { duration: 500 });
    } else if (mapRef.current.animateToCoordinate) {
      mapRef.current.animateToCoordinate({ latitude: lat, longitude: lon }, 500);
    } else if (mapRef.current.setCamera) {
      mapRef.current.setCamera({ center: { latitude: lat, longitude: lon } });
    } else {
      console.warn('No animation method available on mapRef');
    }
  }

  async function refreshLocationAndAnimate(showLoader = true) {
    if (showLoader) setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('refreshLocationAndAnimate permission status', status);
      if (status !== 'granted') {
        console.warn('Location permission not granted');
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      userLocationRef.current = coords;
      AsyncStorage.setItem('userLocation', JSON.stringify(coords)).catch(() => {});
      console.log('refreshLocationAndAnimate got coords', coords);
      animateToCoords(coords.latitude, coords.longitude);
      if (typeof onLocationCentered === 'function') {
        onLocationCentered(coords);
      }
      return coords;
    } catch (e) {
      console.warn('refreshLocationAndAnimate error', e);
      return null;
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  async function goToMyLocation() {
    if (loading) return;
    console.log('goToMyLocation pressed');

    // If we have cached coords, use them immediately
    const cached = userLocationRef.current;
    if (cached) {
      console.log('Using cached coords', cached);
      animateToCoords(cached.latitude, cached.longitude);
      if (typeof onLocationCentered === 'function') {
        onLocationCentered(cached);
      }
      // refresh in background; if fresh coords differ significantly, animate again
      refreshLocationAndAnimate(false).then((fresh) => {
        if (fresh) {
          const dlat = Math.abs(fresh.latitude - cached.latitude);
          const dlon = Math.abs(fresh.longitude - cached.longitude);
          if (dlat > 0.0001 || dlon > 0.0001) {
            animateToCoords(fresh.latitude, fresh.longitude);
            if (typeof onLocationCentered === 'function') {
              onLocationCentered(fresh);
            }
          }
        }
      });
      return;
    }

    // No cached coords — show loader and fetch
    await refreshLocationAndAnimate(true);
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={style || { flex: 1 }}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        showsMyLocationButton={false}
        {...rest}
      >
        {children}
      </MapView>

      <Animated.View pointerEvents={loading ? 'auto' : 'none'} style={[styles.overlayContainer, { opacity: overlayAnim.current, transform: [{ scale: overlayAnim.current.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }]}>
        <View style={styles.overlayBox}>
          <ActivityIndicator size="large" color="rgba(0,0,0,0.85)" />
        </View>
      </Animated.View>

      {showMyLocationButton && (
        <TouchableOpacity
          style={[styles.locBtn, loading && styles.locBtnLoading]}
          onPress={goToMyLocation}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.85}
          accessible
          accessibilityLabel="locate"
          accessibilityHint="Center map on current location"
          accessibilityState={{ busy: loading, disabled: loading }}
          disabled={loading}
        >
          <Ionicons name="locate" size={20} color="rgba(0,0,0,0.85)" />
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  locBtn: {
    position: 'absolute',
    right: 16,
    top: Platform.OS === 'ios' ? 56 : 40,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 24,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  locBtnLoading: {
    opacity: 0.9,
  },
  overlayContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '40%',
    alignItems: 'center',
    zIndex: 2000,
    elevation: 20,
  },
  overlayBox: {
    width: 88,
    height: 88,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  spinner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AppMap;
