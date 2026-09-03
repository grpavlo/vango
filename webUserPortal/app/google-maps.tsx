"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: any;
    __vangoGoogleMapsPromise?: Promise<any>;
  }
}

const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
const cherkasyCenter = { lat: 49.44446, lng: 32.05894 };

type MapStatus = "idle" | "loading" | "ready" | "missing-key" | "error";
export type GooglePoint = { label: string; city: string; address: string; lat: number; lon: number };
type DriverMapOrder = { id: number; title: string; price: string; href: string; lat: number; lon: number; markerColor?: string; markerLabel?: string };
export type GoogleRoutePoint = { lat: number; lon: number; title?: string };

function buildPinIcon(google: any, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="46" viewBox="0 0 34 46">
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#1f2937" flood-opacity=".22"/></filter>
    <g filter="url(#shadow)">
      <path d="M17 45C7.5 33.5 3 26.2 3 17a14 14 0 1 1 28 0c0 9.2-4.5 16.5-14 28Z" fill="${color}"/>
      <circle cx="17" cy="17" r="6" fill="#fff"/>
    </g>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(34, 46),
    anchor: new google.maps.Point(17, 45),
  };
}

function buildOrderMarkerIcon(google: any, order: DriverMapOrder) {
  return buildPinIcon(google, order.markerColor || "#16a34a");
}

export function loadGoogleMaps() {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps доступний тільки в браузері"));
  if (window.google?.maps?.Map && window.google?.maps?.places?.Autocomplete) return Promise.resolve(window.google);
  if (!googleMapsApiKey) return Promise.reject(new Error("missing-key"));
  if (window.__vangoGoogleMapsPromise) return window.__vangoGoogleMapsPromise;

  window.__vangoGoogleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-vango-google-maps]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google));
      existing.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsApiKey)}&libraries=places&language=uk&region=UA&v=weekly`;
    script.async = true;
    script.defer = true;
    script.dataset.vangoGoogleMaps = "true";
    script.addEventListener("load", () => resolve(window.google));
    script.addEventListener("error", reject);
    document.head.appendChild(script);
  });

  return window.__vangoGoogleMapsPromise;
}

function extractAddressPart(components: any[] | undefined, names: string[]) {
  return components?.find((component) => component.types?.some((type: string) => names.includes(type)))?.long_name || "";
}

function toPoint(place: any, fallbackLabel: string): GooglePoint | null {
  const location = place.geometry?.location;
  if (!location) return null;
  const label = place.formatted_address || place.name || fallbackLabel;
  const city =
    extractAddressPart(place.address_components, ["locality", "administrative_area_level_2"]) ||
    extractAddressPart(place.address_components, ["administrative_area_level_1"]) ||
    "";
  const route = extractAddressPart(place.address_components, ["route"]);
  const streetNumber = extractAddressPart(place.address_components, ["street_number"]);
  const address = [route, streetNumber].filter(Boolean).join(" ") || label;
  return { label, city, address, lat: location.lat(), lon: location.lng() };
}

export function GooglePlacePicker({
  name,
  label,
  tone,
  initialPoint,
  onPointChange,
}: {
  name: "pickup" | "dropoff";
  label: string;
  tone: "green" | "orange";
  initialPoint?: Partial<GooglePoint> | null;
  onPointChange?: (point: GooglePoint | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const googleMapRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [status, setStatus] = useState<MapStatus>("idle");
  const [value, setValue] = useState(initialPoint?.label || "");
  const [point, setPoint] = useState<GooglePoint | null>(
    typeof initialPoint?.lat === "number" && typeof initialPoint?.lon === "number"
      ? {
        label: initialPoint.label || "",
        city: initialPoint.city || "",
        address: initialPoint.address || initialPoint.label || "",
        lat: initialPoint.lat,
        lon: initialPoint.lon,
      }
      : null
  );
  const [locationMessage, setLocationMessage] = useState("");

  function applyPoint(nextPoint: GooglePoint) {
    setPoint(nextPoint);
    setValue(nextPoint.label);
    onPointChange?.(nextPoint);
    setLocationMessage("");
    const position = { lat: nextPoint.lat, lng: nextPoint.lon };
    markerRef.current?.setPosition(position);
    markerRef.current?.setVisible(true);
    googleMapRef.current?.panTo(position);
    googleMapRef.current?.setZoom(16);
  }

  function applyLatLng(latLng: any) {
    const lat = latLng.lat();
    const lon = latLng.lng();
    const fallbackPoint = { label: `Точка на карті (${lat.toFixed(5)}, ${lon.toFixed(5)})`, city: "", address: "Обрана точка на карті", lat, lon };
    geocoderRef.current?.geocode({ location: latLng }, (results: any[], geocodeStatus: string) => {
      const result = geocodeStatus === "OK" ? results?.[0] : null;
      applyPoint(toPoint({ ...result, geometry: { location: latLng } }, fallbackPoint.label) || fallbackPoint);
    });
  }

  function locateMe() {
    if (status !== "ready" || !window.google?.maps) return;
    if (!navigator.geolocation) {
      setLocationMessage("Браузер не підтримує визначення місцезнаходження");
      return;
    }
    setLocationMessage("Визначаємо ваше місцезнаходження...");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => applyLatLng(new window.google.maps.LatLng(coords.latitude, coords.longitude)),
      () => setLocationMessage("Не вдалося отримати місцезнаходження"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  useEffect(() => {
    let active = true;
    const listeners: Array<{ remove: () => void }> = [];

    async function initMap() {
      if (!googleMapsApiKey) {
        setStatus("missing-key");
        return;
      }
      if (!mapRef.current || !inputRef.current) return;

      setStatus("loading");
      try {
        const google = await loadGoogleMaps();
        if (!active || !mapRef.current || !inputRef.current) return;

        const map = new google.maps.Map(mapRef.current, {
          center: cherkasyCenter,
          zoom: 13,
          clickableIcons: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        googleMapRef.current = map;
        const marker = new google.maps.Marker({
          map,
          visible: false,
          title: label,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: tone === "green" ? "#19aa56" : "#ef7624",
            fillOpacity: 1,
            scale: 9,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        });
        markerRef.current = marker;
        if (point && typeof point.lat === "number" && typeof point.lon === "number") {
          const position = { lat: point.lat, lng: point.lon };
          marker.setPosition(position);
          marker.setVisible(true);
          map.panTo(position);
          map.setZoom(16);
        }

        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ["address_components", "formatted_address", "geometry", "name"],
          componentRestrictions: { country: "ua" },
        });

        listeners.push(autocomplete.addListener("place_changed", () => {
          const selectedPlace = autocomplete.getPlace();
          const nextPoint = toPoint(selectedPlace, inputRef.current?.value || "");
          if (nextPoint) applyPoint(nextPoint);
        }));

        const geocoder = new google.maps.Geocoder();
        geocoderRef.current = geocoder;
        listeners.push(map.addListener("click", (event: any) => {
          if (!event.latLng) return;
          applyLatLng(event.latLng);
        }));

        setStatus("ready");
      } catch (error) {
        setStatus(error instanceof Error && error.message === "missing-key" ? "missing-key" : "error");
      }
    }

    initMap();
    return () => {
      active = false;
      listeners.forEach((listener) => listener.remove());
      markerRef.current?.setMap?.(null);
      googleMapRef.current = null;
      geocoderRef.current = null;
    };
  }, [label, tone]);

  return <div className="place-picker-field google-place-field">
    <span><i className={tone === "green" ? "green-dot" : "orange-dot"}/>{label}</span>
    <div className="input-with-icon place-input">
      <input
        ref={inputRef}
        name={`${name}Location`}
        value={value}
        placeholder="Місто, вулиця, будинок"
        autoComplete="off"
        onChange={(event) => {
          setValue(event.target.value);
          setPoint(null);
          onPointChange?.(null);
          setLocationMessage("");
        }}
      />
      <button type="button" aria-label={`Поставити точку для поля ${label.toLocaleLowerCase("uk-UA")}`} onClick={() => inputRef.current?.focus()}>
        <span aria-hidden="true"/>
      </button>
    </div>
    <div className={`google-map-shell place-google-map ${status !== "ready" ? "is-loading" : ""}`}>
      <div ref={mapRef} className="google-map-surface"/>
      <button type="button" className="google-locate-button" onClick={locateMe} disabled={status !== "ready"} aria-label="Показати моє місцезнаходження">
        <span aria-hidden="true"/>
      </button>
      {status !== "ready" && <div className="google-map-message">
        {status === "missing-key" ? "Додайте VITE_GOOGLE_MAPS_API_KEY для Google Maps" : status === "error" ? "Не вдалося завантажити Google Maps" : "Завантаження Google Maps..."}
      </div>}
    </div>
    <div className="place-map-caption">{point ? point.label : locationMessage || "Почніть вводити адресу або клікніть точку на карті"}</div>
    <input type="hidden" name={`${name}City`} value={point?.city || ""}/>
    <input type="hidden" name={`${name}Address`} value={point?.address || value}/>
    <input type="hidden" name={`${name}Lat`} value={point?.lat ?? ""}/>
    <input type="hidden" name={`${name}Lon`} value={point?.lon ?? ""}/>
  </div>;
}

export function GoogleRoutePreview({
  pickup,
  dropoff,
  className = "",
  typeLabel,
  local = true,
}: {
  pickup?: GoogleRoutePoint | null;
  dropoff?: GoogleRoutePoint | null;
  className?: string;
  typeLabel?: string;
  local?: boolean;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<MapStatus>("idle");

  useEffect(() => {
    let active = true;
    const markers: any[] = [];
    let line: any = null;

    async function initMap() {
      if (!googleMapsApiKey) {
        setStatus("missing-key");
        return;
      }
      if (!mapRef.current) return;

      setStatus("loading");
      try {
        const google = await loadGoogleMaps();
        if (!active || !mapRef.current) return;

        const points = [pickup, dropoff].filter((point): point is GoogleRoutePoint => Boolean(point));
        const map = new google.maps.Map(mapRef.current, {
          center: points[0] ? { lat: points[0].lat, lng: points[0].lon } : cherkasyCenter,
          zoom: points.length ? 13 : 11,
          clickableIcons: false,
          disableDefaultUI: true,
          gestureHandling: "none",
          keyboardShortcuts: false,
          draggable: false,
          scrollwheel: false,
        });
        const bounds = new google.maps.LatLngBounds();

        if (pickup) {
          const position = { lat: pickup.lat, lng: pickup.lon };
          bounds.extend(position);
          markers.push(new google.maps.Marker({ map, position, title: pickup.title || "Звідки", icon: buildPinIcon(google, "#EA580C") }));
        }
        if (dropoff) {
          const position = { lat: dropoff.lat, lng: dropoff.lon };
          bounds.extend(position);
          markers.push(new google.maps.Marker({ map, position, title: dropoff.title || "Куди", icon: buildPinIcon(google, "#16a34a") }));
        }
        if (pickup && dropoff) {
          line = new google.maps.Polyline({
            map,
            path: [{ lat: pickup.lat, lng: pickup.lon }, { lat: dropoff.lat, lng: dropoff.lon }],
            strokeColor: "#2563eb",
            strokeOpacity: 0,
            icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeWeight: 3, scale: 3 }, offset: "0", repeat: "12px" }],
          });
          map.fitBounds(bounds, 34);
        } else if (points.length === 1) {
          map.setCenter(bounds.getCenter());
          map.setZoom(14);
        }

        setStatus("ready");
      } catch (error) {
        setStatus(error instanceof Error && error.message === "missing-key" ? "missing-key" : "error");
      }
    }

    initMap();
    return () => {
      active = false;
      markers.forEach((marker) => marker.setMap(null));
      line?.setMap?.(null);
    };
  }, [dropoff, pickup]);

  return <div className={`google-map-shell mini-route-map google-route-preview ${className} ${status !== "ready" ? "is-loading" : ""}`} aria-label="Google мапа маршруту замовлення">
    <div ref={mapRef} className="google-map-surface"/>
    {typeLabel && <b className={`route-kind ${local ? "local" : "long"}`}>{typeLabel}</b>}
    {status !== "ready" && <div className="google-map-message compact">
      {status === "missing-key" ? "Google Maps key" : status === "error" ? "Мапу не завантажено" : "Завантаження мапи..."}
    </div>}
  </div>;
}

export function GoogleOrdersMap({ orders, className = "" }: { orders: DriverMapOrder[]; className?: string }) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const googleMapRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const [status, setStatus] = useState<MapStatus>("idle");
  const [locationMessage, setLocationMessage] = useState("");

  function locateMe() {
    if (status !== "ready" || !window.google?.maps) return;
    if (!navigator.geolocation) {
      setLocationMessage("Браузер не підтримує визначення місцезнаходження");
      return;
    }
    setLocationMessage("Визначаємо ваше місцезнаходження...");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position = { lat: coords.latitude, lng: coords.longitude };
        const google = window.google;
        if (!userMarkerRef.current) {
          userMarkerRef.current = new google.maps.Marker({
            map: googleMapRef.current,
            position,
            title: "Моє місцезнаходження",
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: "#2168b5",
              fillOpacity: 1,
              scale: 10,
              strokeColor: "#ffffff",
              strokeWeight: 4,
            },
          });
        } else {
          userMarkerRef.current.setPosition(position);
          userMarkerRef.current.setMap(googleMapRef.current);
        }
        googleMapRef.current?.panTo(position);
        googleMapRef.current?.setZoom(14);
        setLocationMessage("");
      },
      () => setLocationMessage("Не вдалося отримати місцезнаходження"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  useEffect(() => {
    let active = true;
    const markers: any[] = [];
    const listeners: Array<{ remove: () => void }> = [];

    async function initMap() {
      if (!googleMapsApiKey) {
        setStatus("missing-key");
        return;
      }
      if (!mapRef.current) return;

      setStatus("loading");
      try {
        const google = await loadGoogleMaps();
        if (!active || !mapRef.current) return;

        const map = new google.maps.Map(mapRef.current, {
          center: cherkasyCenter,
          zoom: 8,
          clickableIcons: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        googleMapRef.current = map;
        const bounds = new google.maps.LatLngBounds();
        const info = new google.maps.InfoWindow();

        orders.forEach((order) => {
          const position = { lat: order.lat, lng: order.lon };
          bounds.extend(position);
          const marker = new google.maps.Marker({
            map,
            position,
            title: order.title,
            icon: buildOrderMarkerIcon(google, order),
          });
          markers.push(marker);
          listeners.push(marker.addListener("click", () => {
            const link = document.createElement("a");
            link.href = order.href;
            link.className = "google-order-info";
            const title = document.createElement("strong");
            title.textContent = order.title;
            const price = document.createElement("span");
            price.textContent = order.price;
            link.append(title, price);
            info.setContent(link);
            info.open({ map, anchor: marker });
          }));
        });

        if (orders.length === 1) {
          map.setCenter(bounds.getCenter());
          map.setZoom(12);
        } else if (orders.length > 1) {
          map.fitBounds(bounds, 70);
        }
        setStatus("ready");
      } catch (error) {
        setStatus(error instanceof Error && error.message === "missing-key" ? "missing-key" : "error");
      }
    }

    initMap();
    return () => {
      active = false;
      listeners.forEach((listener) => listener.remove());
      markers.forEach((marker) => marker.setMap(null));
      userMarkerRef.current?.setMap?.(null);
      userMarkerRef.current = null;
      googleMapRef.current = null;
    };
  }, [orders]);

  return <section className={`google-map-shell ${className} ${status !== "ready" ? "is-loading" : ""}`} aria-label="Google мапа доступних замовлень">
    <div ref={mapRef} className="google-map-surface"/>
    {status === "ready" && <div className="google-map-legend" aria-label="Позначення міток на мапі">
      <span><i className="local"/>Місцеві</span>
      <span><i className="long"/>Далекі</span>
      <span><i className="me"/>Моє місце</span>
    </div>}
    <button type="button" className="google-locate-button" onClick={locateMe} disabled={status !== "ready"} aria-label="Показати моє місцезнаходження">
      <span aria-hidden="true"/>
    </button>
    {locationMessage && status === "ready" && <div className="google-location-message">{locationMessage}</div>}
    {status !== "ready" && <div className="google-map-message">
      {status === "missing-key" ? "Додайте VITE_GOOGLE_MAPS_API_KEY для Google Maps" : status === "error" ? "Не вдалося завантажити Google Maps" : "Завантаження Google Maps..."}
    </div>}
  </section>;
}
