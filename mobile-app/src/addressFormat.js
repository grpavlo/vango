function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function isStreetLike(value) {
  return /(\u0432\u0443\u043b|\u0432\u0443\u043b\u0438\u0446\u044f|\u0443\u043b|\u0443\u043b\u0438\u0446\u0430|\u043f\u0440\u043e\u0441\u043f|\u043f\u0440\u043e\u0441\u043f\u0435\u043a\u0442|\u0431\u0443\u043b\u044c\u0432\u0430\u0440|\u0431\u0443\u043b\.?|\u043f\u0440\u043e\u0432\u0443\u043b|\u043f\u0440\u043e\u0432\.?|\u043f\u043b\u043e\u0449\u0430|\u043f\u043b\.?|\u043d\u0430\u0431(\u0435\u0440\u0435\u0436\u043d\u0430)?|\u0448\u043e\u0441\u0435|\u0434\u043e\u0440\u043e\u0433\u0430|\u0430\u043b\u0435\u044f|street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?)/i.test(
    normalizeText(value)
  );
}

function isLikelyHouseNumber(value) {
  const text = normalizeText(value);
  if (!text) return false;
  if (/\s/.test(text)) return false;
  if (/^\d{5,}$/.test(text)) return false;
  return /^\d{1,4}[A-Za-z\u0410-\u042f\u0430-\u044f\u0406\u0456\u0407\u0457\u0404\u0454]?(?:[\/-]\d{1,4}[A-Za-z\u0410-\u042f\u0430-\u044f\u0406\u0456\u0407\u0457\u0404\u0454]?)?$/.test(text);
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

  for (let i = 0; i < parts.length - 1; i += 1) {
    if (!isLikelyHouseNumber(parts[i])) continue;
    if (!isStreetLike(parts[i + 1])) continue;
    return `${parts[i + 1]}, ${parts[i]}`;
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

export function formatOrderAddress(city, address, location) {
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

export function formatPointAddress(point) {
  if (!point) return '';
  return formatOrderAddress(point.city, point.address, point.text);
}
