import Constants from 'expo-constants';

function getExtra() {
  const expoConfig = Constants.expoConfig ?? Constants.manifest ?? {};
  return expoConfig?.extra ?? {};
}

const envKey =
  process.env?.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ??
  process.env?.GOOGLE_PLACES_API_KEY ??
  process.env?.GOOGLE_API_KEY ??
  '';

const extra = getExtra();

const extraKey =
  extra.googlePlacesApiKey ??
  extra.GOOGLE_PLACES_API_KEY ??
  extra.googleApiKey ??
  extra.GOOGLE_API_KEY ??
  Constants.expoConfig?.android?.config?.googleMaps?.apiKey ??
  '';

export const GOOGLE_PLACES_API_KEY = envKey || extraKey || '';
