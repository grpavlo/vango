import { Linking, Platform } from 'react-native';

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

export function openLocationInMaps({
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

  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?${hasCoords ? `ll=${coordQuery}&` : ''}q=${encodeURIComponent(
          query || coordQuery
        )}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(googleQuery)}`;

  Linking.openURL(url).catch((err) => console.log('maps open error', err));
}
