import { ActionSheetIOS, Alert, Linking, NativeModules, Platform } from 'react-native';

const { MapChooser } = NativeModules;

function normalizePart(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || text === '-') return '';
  return text.replace(/^[,\s]+|[,\s]+$/g, '');
}

function includesIgnoreCase(source, part) {
  if (!source || !part) return false;
  return source.toLowerCase().includes(part.toLowerCase());
}

function buildSearchQuery(address, city, country = '\u0423\u043a\u0440\u0430\u0457\u043d\u0430') {
  const parts = [];
  const addressPart = normalizePart(address);
  const cityPart = normalizePart(city);
  const countryPart = normalizePart(country);

  if (addressPart) parts.push(addressPart);
  if (cityPart && !includesIgnoreCase(addressPart, cityPart)) parts.push(cityPart);
  const current = parts.join(', ');
  if (countryPart && !includesIgnoreCase(current, countryPart)) parts.push(countryPart);

  return parts.join(', ');
}

function buildMapUrls(query, coordQuery, hasCoords) {
  const encodedQuery = encodeURIComponent(query || coordQuery);
  const encodedGoogleQuery = encodeURIComponent(coordQuery || query);

  return {
    apple: `http://maps.apple.com/?${hasCoords ? `ll=${coordQuery}&` : ''}q=${encodedQuery}`,
    googleApp:
      Platform.OS === 'ios'
        ? `comgooglemaps://?${hasCoords ? `center=${coordQuery}&` : ''}q=${encodedGoogleQuery}`
        : `google.navigation:q=${encodedGoogleQuery}`,
    googleWeb: `https://www.google.com/maps/search/?api=1&query=${encodedGoogleQuery}`,
    system:
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?${hasCoords ? `ll=${coordQuery}&` : ''}q=${encodedQuery}`
        : `geo:0,0?q=${encodedGoogleQuery}`,
    waze: hasCoords
      ? `waze://?ll=${coordQuery}&navigate=yes`
      : `waze://?q=${encodedQuery}&navigate=yes`,
  };
}

async function canOpen(url) {
  try {
    return await Linking.canOpenURL(url);
  } catch {
    return false;
  }
}

async function openMapUrl(url) {
  try {
    await Linking.openURL(url);
  } catch (err) {
    console.log('maps open error', err);
  }
}

async function openAndroidMapChooser(url) {
  if (MapChooser?.open) {
    try {
      await MapChooser.open(url, 'Відкрити за допомогою');
      return;
    } catch (err) {
      console.log('maps chooser error', err);
    }
  }

  await openMapUrl(url);
}

function showMapChooser(options) {
  if (Platform.OS === 'ios') {
    const actionTitles = options.map((option) => option.title);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Відкрити карту',
        message: 'Оберіть застосунок для навігації',
        options: [...actionTitles, 'Скасувати'],
        cancelButtonIndex: actionTitles.length,
      },
      (buttonIndex) => {
        const selected = options[buttonIndex];
        if (selected) openMapUrl(selected.url);
      }
    );
    return;
  }

  Alert.alert(
    'Відкрити карту',
    'Оберіть застосунок для навігації',
    options.map((option) => ({
      text: option.title,
      onPress: () => openMapUrl(option.url),
    })),
    { cancelable: true }
  );
}

export async function openLocationInMaps({
  address,
  city,
  lat,
  lon,
  country = '\u0423\u043a\u0440\u0430\u0457\u043d\u0430',
} = {}) {
  const latNum = Number(lat);
  const lonNum = Number(lon);
  const hasCoords =
    lat !== undefined &&
    lat !== null &&
    lon !== undefined &&
    lon !== null &&
    `${lat}` !== '' &&
    `${lon}` !== '' &&
    Number.isFinite(latNum) &&
    Number.isFinite(lonNum);

  const query = buildSearchQuery(address, city, country);
  const coordQuery = hasCoords ? `${latNum},${lonNum}` : '';
  const googleQuery = coordQuery || query;
  if (!googleQuery) return;

  const urls = buildMapUrls(query, coordQuery, hasCoords);
  const options = [];

  if (Platform.OS === 'android') {
    openAndroidMapChooser(urls.system);
    return;
  }

  if (Platform.OS === 'ios') {
    options.push({ title: 'Apple Maps', url: urls.apple });
  }

  if (await canOpen(urls.googleApp)) {
    options.push({ title: 'Google Maps', url: urls.googleApp });
  }

  if (await canOpen(urls.waze)) {
    options.push({ title: 'Waze', url: urls.waze });
  }

  options.push({
    title: Platform.OS === 'ios' ? 'Інше' : 'Інший застосунок',
    url: Platform.OS === 'ios' ? urls.googleWeb : urls.system,
  });

  showMapChooser(options);
}
