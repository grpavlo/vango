"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { NotificationBell, Notifications, Support, ThemeToggle } from "../customer/customer-portal";
import { VIcon } from "../customer/v-icon";
import { GoogleOrdersMap, GoogleRoutePreview, type GoogleRoutePoint } from "../google-maps";

export type DriverView = "map" | "filter" | "saved" | "orders" | "settings" | "profile" | "notifications" | "support";

const TOKEN_KEY = "vango.webUserPortal.token";
const KIND_KEY = "vango.webUserPortal.kind";

type DriverUserProfile = {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  role?: "CUSTOMER" | "DRIVER" | "BOTH" | "ADMIN";
  firstName?: string;
  lastName?: string;
  patronymic?: string;
  selfiePhoto?: string | null;
  driverRating?: number;
  driverCompletedOrders?: number;
};

type DriverAvailableOrder = {
  id: number;
  orderNumber?: number | string;
  status?: string;
  myResponseStatus?: string | null;
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupCity?: string;
  dropoffCity?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  pickupLat?: number | string;
  pickupLon?: number | string;
  dropoffLat?: number | string;
  dropoffLon?: number | string;
  distance?: number | string;
  cargoType?: string;
  cargoVolume?: number | string;
  cargoWeight?: number | string;
  freeDateUntil?: string;
  loadFrom?: string;
  timingOption?: string;
  price?: number | string | null;
  finalPrice?: number | string | null;
  agreedPrice?: boolean;
  requestedOrderType?: string;
  isIntraCity?: boolean;
  responseCount?: number;
  customer?: { rating?: number; completedOrders?: number; customerCompletedOrders?: number };
};

type DriverSavedSearch = {
  id: number | string;
  pickupCity: string;
  dropoffCity?: string | null;
  lat?: number | string | null;
  lon?: number | string | null;
  dropoffLat?: number | string | null;
  dropoffLon?: number | string | null;
  radius?: number | string | null;
};

async function driverApiFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const message = (await response.text()).trim();
    throw new Error(message || `HTTP ${response.status}`);
  }
  return response.json();
}

function getStoredDriverToken() {
  if (typeof window === "undefined") return "";
  if (window.localStorage.getItem(KIND_KEY) === "portal-admin") return "";
  return window.localStorage.getItem(TOKEN_KEY) || "";
}

function driverDisplayName(profile?: DriverUserProfile | null) {
  return profile?.name || [profile?.lastName, profile?.firstName, profile?.patronymic].filter(Boolean).join(" ") || profile?.phone || profile?.email || "Користувач VanGo";
}

function driverInitials(profile?: DriverUserProfile | null) {
  const parts = driverDisplayName(profile).split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || "V"}${parts[1]?.[0] || "G"}`.toUpperCase();
}

function normalizeDriverPhotoUrl(photo?: string | null) {
  const value = String(photo || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("blob:") || value.startsWith("data:")) return value;
  if (value.startsWith("/uploads/")) return value;
  if (value.includes("\\uploads\\")) return `/uploads/${value.split("\\uploads\\").pop()}`;
  if (value.includes("/uploads/")) return `/uploads/${value.split("/uploads/").pop()}`;
  return value.startsWith("/") ? value : `/uploads/${value}`;
}

function DriverAvatar({ profile, className, tone = "" }: { profile?: DriverUserProfile | null; className: string; tone?: string }) {
  const [failed, setFailed] = useState(false);
  const photo = failed ? "" : normalizeDriverPhotoUrl(profile?.selfiePhoto);
  const classes = [className, tone].filter(Boolean).join(" ");
  return <span className={classes}>{photo ? <img src={photo} alt={driverDisplayName(profile)} onError={() => setFailed(true)}/> : driverInitials(profile)}</span>;
}

function driverNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function driverMoney(value: unknown, agreedPrice?: boolean) {
  if (agreedPrice) return "Договірна";
  const number = driverNumber(value);
  if (number == null || number <= 0) return "Договірна";
  return `${number.toLocaleString("uk-UA")} грн`;
}

function driverShortPrice(order: DriverAvailableOrder) {
  if (order.agreedPrice) return "Дог.";
  const number = driverNumber(order.finalPrice ?? order.price);
  if (number == null || number <= 0) return "Дог.";
  if (number >= 1000) return `${Math.round(number / 1000)}к грн`;
  return `${number} грн`;
}

function driverLocation(city?: string, address?: string, fallback?: string) {
  return city || fallback || address || "Не вказано";
}

function compactDriverAddress(city?: string, address?: string, fallback?: string) {
  const raw = fallback || address || city || "";
  if (!raw) return "Не вказано";
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  const cityText = (city || "").trim();
  const cityIndex = cityText ? parts.findIndex((part) => part.toLowerCase().includes(cityText.toLowerCase())) : -1;
  const sourceParts = cityIndex > 0 ? parts.slice(0, cityIndex) : parts;
  const useful = sourceParts.filter((part) => {
    const lower = part.toLowerCase();
    return part !== cityText
      && !/^\d{5,6}$/.test(part)
      && !lower.includes("україна")
      && !lower.includes("область")
      && !lower.includes("район")
      && !lower.includes("громада")
      && !lower.includes("мікрорайон");
  });
  const first = useful[0] || "";
  const second = useful[1] || "";
  const street = /^\d+[a-zа-яіїєґ/-]*$/i.test(first) && second ? `${second} ${first}` : [first, second].filter(Boolean).join(" ");
  return [cityText || (cityIndex >= 0 ? parts[cityIndex] : ""), street].filter(Boolean).join(", ") || raw;
}

function compactDriverOrderAddress(order: DriverAvailableOrder, side: "pickup" | "dropoff") {
  return side === "pickup"
    ? compactDriverAddress(order.pickupCity, order.pickupAddress, order.pickupLocation)
    : compactDriverAddress(order.dropoffCity, order.dropoffAddress, order.dropoffLocation);
}

function driverRoute(order: DriverAvailableOrder) {
  const pickup = driverLocation(order.pickupCity, order.pickupAddress, order.pickupLocation);
  const dropoff = driverLocation(order.dropoffCity, order.dropoffAddress, order.dropoffLocation);
  return `${pickup} → ${dropoff}`;
}

function driverRoutePoint(lat: unknown, lon: unknown, title: string): GoogleRoutePoint | null {
  const pointLat = driverNumber(lat);
  const pointLon = driverNumber(lon);
  return pointLat == null || pointLon == null ? null : { lat: pointLat, lon: pointLon, title };
}

function driverMapPointUrl(order: DriverAvailableOrder, side: "pickup" | "dropoff") {
  const lat = driverNumber(side === "pickup" ? order.pickupLat : order.dropoffLat);
  const lon = driverNumber(side === "pickup" ? order.pickupLon : order.dropoffLon);
  const query = lat != null && lon != null
    ? `${lat},${lon}`
    : side === "pickup"
      ? order.pickupLocation || order.pickupAddress || order.pickupCity || "Не вказано"
      : order.dropoffLocation || order.dropoffAddress || order.dropoffCity || "Не вказано";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

const DRIVER_ORDER_FILTER_KEYS = [
  "city",
  "pickupCity",
  "dropoffCity",
  "date",
  "dateFrom",
  "dateTo",
  "lat",
  "lon",
  "radius",
  "dropoffLat",
  "dropoffLon",
  "dropoffRadius",
  "corridorWidth",
] as const;

function currentDriverMapSearch() {
  if (typeof window === "undefined") return "";
  return window.location.search || "";
}

function buildDriverOrdersPath(search: string) {
  const source = new URLSearchParams(search);
  const filtered = new URLSearchParams();
  DRIVER_ORDER_FILTER_KEYS.forEach((key) => {
    const value = source.get(key);
    if (value) filtered.set(key, value);
  });
  const query = filtered.toString();
  return query ? `/orders?${query}` : "/orders";
}

function driverFilterSummary(search: string) {
  const params = new URLSearchParams(search);
  const pickup = params.get("pickupCity") || params.get("city");
  const dropoff = params.get("dropoffCity");
  const hasPickupPoint = Boolean(params.get("lat") && params.get("lon"));
  const hasDropoffPoint = Boolean(params.get("dropoffLat") && params.get("dropoffLon"));
  const radius = hasPickupPoint || hasDropoffPoint ? params.get("radius") : "";
  const parts = [
    pickup ? `з ${pickup}` : "",
    dropoff ? `до ${dropoff}` : "",
    radius ? `у радіусі ${radius} км` : "",
  ].filter(Boolean);
  return parts.length ? `Фільтр: ${parts.join(", ")}` : "Вільні перевезення поруч із вами";
}

function savedSearchHref(item: DriverSavedSearch) {
  const params = new URLSearchParams();
  if (item.pickupCity) params.set("pickupCity", item.pickupCity);
  if (item.dropoffCity) params.set("dropoffCity", item.dropoffCity);
  if (item.lat != null && item.lon != null) {
    params.set("lat", String(item.lat));
    params.set("lon", String(item.lon));
  }
  if (item.radius != null) params.set("radius", String(item.radius));
  if (item.dropoffLat != null && item.dropoffLon != null) {
    params.set("dropoffLat", String(item.dropoffLat));
    params.set("dropoffLon", String(item.dropoffLon));
    params.set("dropoffRadius", String(item.radius || 30));
  }
  const query = params.toString();
  return query ? `/driver/map?${query}` : "/driver/map";
}

function driverSchedule(order: DriverAvailableOrder) {
  if (order.timingOption === "asap") return "Якнайшвидше";
  if (order.timingOption === "within_hour") return "До 1 години";
  if (order.freeDateUntil) return `Вільна дата до ${new Date(order.freeDateUntil).toLocaleDateString("uk-UA")}`;
  if (order.loadFrom) return new Date(order.loadFrom).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return "Час подачі не вказано";
}

function isDriverLocalOrder(order: DriverAvailableOrder) {
  return Boolean(order.isIntraCity || order.requestedOrderType === "LOCAL");
}

function driverOrderTypeLabel(order: DriverAvailableOrder) {
  return isDriverLocalOrder(order) ? "Місцеве" : "Далеке";
}

function driverStatusLabel(order: DriverAvailableOrder) {
  const responseLabels: Record<string, string> = {
    RESPONDED: "Пропозицію надіслано",
    CALL_MADE: "Дзвінок зроблено",
    PENDING_CONFIRM: "Очікує підтвердження",
    DISCUSSING: "Обговорення",
    COUNTER_OFFERED: "Зустрічна пропозиція",
    CONFIRMED: "Підтверджено",
  };
  const statusLabels: Record<string, string> = {
    CREATED: "Створено",
    PRICE_UPDATED: "Ціну змінено",
    ACCEPTED: "Прийнято",
    IN_PROGRESS: "В роботі",
    DELIVERED: "Доставлено",
    COMPLETED: "Виконано",
    CANCELLED: "Скасовано",
    REJECTED: "Відхилено",
    PENDING: "Очікує",
  };
  return (order.myResponseStatus && responseLabels[order.myResponseStatus]) || statusLabels[order.status || ""] || order.status || "Замовлення";
}

function driverOrderTab(order: DriverAvailableOrder) {
  if (["COMPLETED", "CANCELLED", "REJECTED"].includes(order.status || "")) return "history";
  if (["ACCEPTED", "IN_PROGRESS", "DELIVERED"].includes(order.status || "")) return "work";
  return "confirm";
}

function driverOrderMeta(order: DriverAvailableOrder) {
  const volume = driverNumber(order.cargoVolume);
  const weight = driverNumber(order.cargoWeight);
  const distance = driverNumber(order.distance);
  const parts = [
    volume != null ? `об’єм: ${volume.toLocaleString("uk-UA")} м³` : "",
    weight != null ? `вага: ${weight.toLocaleString("uk-UA")} кг` : "",
    distance != null ? `≈ ${distance.toLocaleString("uk-UA")} км` : "",
  ].filter(Boolean);
  return parts.join(" · ") || order.cargoType || "Деталі вантажу не вказані";
}

function DriverNav({ view }: { view: DriverView }) {
  const mapActive = view === "map" || view === "filter" || view === "saved";
  return <nav className="driver-main-nav" aria-label="Навігація кабінету водія">
    <a className={mapActive ? "active" : ""} href="/driver/map"><VIcon name="map"/><span>Мапа</span></a>
    <a className={view === "orders" ? "active" : ""} href="/driver/orders"><VIcon name="case"/><span>Мої замовлення</span></a>
    <a className={view === "settings" || view === "profile" ? "active" : ""} href="/driver/settings"><VIcon name="settings"/><span>Налаштування</span></a>
  </nav>;
}

export function DriverLayout({ view, title, children, toast = "", profile }: { view: DriverView; title: string; children: ReactNode; toast?: string; profile?: DriverUserProfile | null }) {
  return <main className="driver-shell"><aside className="driver-sidebar"><a className="customer-brand" href="/driver/map"><span className="customer-brand-logo"><img src="/logo.png" alt=""/></span><strong>VanGo</strong></a><DriverNav view={view}/><div className="customer-sidebar-foot"><a className="customer-sidebar-profile" href="/driver/settings" aria-label="Відкрити налаштування профілю"><DriverAvatar profile={profile} className="mini-avatar" tone="green"/><p><strong>{driverDisplayName(profile)}</strong><small>Водій</small></p></a></div></aside><section className="driver-workspace"><header className="customer-topbar"><div><small>Кабінет водія</small><h1>{title}</h1></div><div className="customer-tools"><ThemeToggle/><a href="/driver/support" aria-label="Підтримка"><VIcon name="headset"/></a><NotificationBell href="/driver/notifications"/><a className="customer-profile-link" href="/driver/settings" aria-label="Відкрити налаштування профілю"><DriverAvatar profile={profile} className="mini-avatar" tone="green"/></a></div></header><div className="driver-content">{children}</div><div className="driver-mobile-nav"><DriverNav view={view}/></div></section>{toast && <div className="customer-toast"><span>✓</span>{toast}</div>}</main>;
}

function DriverSettings({ profile, onLogout }: { profile: DriverUserProfile | null; onLogout: () => void }) {
  return <DriverLayout view="settings" title="Налаштування" profile={profile}><div className="customer-page-intro"><div><h2>Налаштування водія</h2></div></div><div className="settings-grid"><section className="customer-card profile-summary"><DriverAvatar profile={profile} className="large-avatar"/><div className="profile-name"><h3>{driverDisplayName(profile)}</h3><p><span>★</span> {Number(profile?.driverRating ?? 5).toFixed(1)} <b>✓ {profile?.driverCompletedOrders || 0}</b></p><small>{profile?.phone || profile?.email || "-"}</small></div><a className="profile-edit-link" href="/driver/profile"><VIcon name="edit"/><span><strong>Редагувати профіль водія</strong><small>Документи, автомобіль і контакти</small></span><VIcon name="chevron"/></a></section><div className="settings-side"><section className="customer-card role-card"><div className="role-icon"><VIcon name="car"/></div><div><strong>Водій</strong><p>Приймайте та виконуйте замовлення.</p></div></section><section className="customer-card account-mode"><h3>Режим облікового запису</h3><div className="mode-switch"><a href="/customer/settings"><VIcon name="user"/>Замовник</a><button className="active"><VIcon name="car"/>Водій</button></div></section><button className="logout-button" onClick={onLogout}><VIcon name="logout"/>Вийти</button><p className="version">VanGo webUserPortal</p></div></div></DriverLayout>;
}

function UploadPair({ label }: { label: string }) {
  return <div className="driver-upload-group"><strong>{label}</strong><div><button type="button"><VIcon name="upload" size={17}/>Фото</button><button type="button"><VIcon name="image" size={17}/>Галерея</button></div></div>;
}

function DriverProfile({ profile }: { profile: DriverUserProfile | null }) {
  const [noTaxId, setNoTaxId] = useState(false);
  const [toast, setToast] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setToast("Анкету водія збережено"); window.setTimeout(() => setToast(""), 2600); };
  return <DriverLayout view="profile" title="Редагування профілю" toast={toast} profile={profile}><a className="back-link" href="/driver/settings"><VIcon name="arrow"/>До налаштувань</a><div className="customer-page-intro"><div><h2>Профіль водія</h2></div></div><form className="driver-profile-form" onSubmit={submit}>
    <section className="customer-card driver-form-section"><div className="driver-form-title"><h3>Особисті дані</h3><p>Інформація для перевірки вашого профілю</p></div><div className="driver-field-grid"><label className="wide">ПІБ<input defaultValue={driverDisplayName(profile)}/></label><label className="wide">Номер телефону<input defaultValue={profile?.phone || ""}/></label><label>ІПН<input placeholder="XXXXXXXXXX" disabled={noTaxId}/></label><label className="check-field"><input type="checkbox" checked={noTaxId} onChange={(event) => setNoTaxId(event.target.checked)}/> Не маю ІПН</label></div></section>
    <section className="customer-card driver-form-section"><div className="driver-form-title"><h3>Документи</h3><p>Додайте дані та фотографії документів</p></div><div className="document-grid"><div><h4>Паспорт</h4><div className="two-fields"><input placeholder="Серія"/><input placeholder="Номер"/></div><UploadPair label="Сторінка паспорта з фото"/><UploadPair label="Сторінка прописки"/></div><div><h4>Водійське посвідчення</h4><div className="two-fields"><input placeholder="Серія"/><input placeholder="Номер"/></div><UploadPair label="Фото посвідчення"/></div><div><h4>Техпаспорт автомобіля</h4><div className="two-fields"><input placeholder="Серія"/><input placeholder="Номер"/></div><UploadPair label="Фото техпаспорта"/></div></div></section>
    <section className="customer-card driver-form-section"><div className="driver-form-title"><h3>Автомобіль</h3><p>Характеристики, які враховуються у пошуку замовлень</p></div><div className="driver-field-grid"><label className="wide">Державний номер<input placeholder="CA 0000 AA"/></label><label>Марка<input placeholder="Fiat"/></label><label>Модель<input placeholder="Ducato"/></label><label className="wide">Рік випуску<input placeholder="2020"/></label><label>Довжина, мм<input placeholder="3120"/></label><label>Ширина, мм<input placeholder="1870"/></label><label>Висота, мм<input placeholder="1930"/></label></div><div className="vehicle-photo-grid"><UploadPair label="Передній правий кут"/><UploadPair label="Задній правий кут"/><UploadPair label="Кузов усередині"/><UploadPair label="Селфі водія"/></div></section>
    <div className="driver-form-actions"><a href="/driver/settings">Скасувати</a><button className="customer-primary">Зберегти анкету</button></div>
  </form></DriverLayout>;
}

function DriverAvailableOrderCard({ order }: { order: DriverAvailableOrder }) {
  const local = isDriverLocalOrder(order);
  const rating = driverNumber(order.customer?.rating);
  const completed = order.customer?.completedOrders ?? order.customer?.customerCompletedOrders ?? order.responseCount ?? 0;
  const pickup = driverRoutePoint(order.pickupLat, order.pickupLon, driverLocation(order.pickupCity, order.pickupAddress, order.pickupLocation));
  const dropoff = driverRoutePoint(order.dropoffLat, order.dropoffLon, driverLocation(order.dropoffCity, order.dropoffAddress, order.dropoffLocation));
  return <a className={`customer-card map-order-card ${local ? "local-order" : "long-order"}`} href={`/driver/orders/${order.id}`}>
    <GoogleRoutePreview pickup={pickup} dropoff={dropoff} typeLabel={driverOrderTypeLabel(order)} local={local}/>
    <div className="map-order-body">
      <div>
        <small>Замовлення № {order.orderNumber || order.id}</small>
        <h3>{driverRoute(order)}</h3>
        <p>{driverSchedule(order)}</p>
        <strong>{driverMoney(order.finalPrice ?? order.price, order.agreedPrice)}</strong>
        <span>{driverOrderMeta(order)}</span>
      </div>
      <div className="customer-rating">
        <small>Замовник</small>
        <strong>★ {rating != null ? rating.toFixed(1) : "5.0"}</strong>
        <span>✓ {completed}</span>
      </div>
    </div>
  </a>;
}

function FilterPanel({ search }: { search: string }) {
  const params = new URLSearchParams(search);
  const initialRadius = driverNumber(params.get("radius")) || 30;
  const [radius, setRadius] = useState(initialRadius);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    async function loadSavedCount() {
      const token = getStoredDriverToken();
      if (!token) return;
      try {
        const data = await driverApiFetch<DriverSavedSearch[]>("/saved-searches", token);
        if (active) setSavedCount(data.length);
      } catch {
        if (active) setSavedCount(null);
      }
    }
    loadSavedCount();
    return () => { active = false; };
  }, []);

  return <aside className="customer-card map-side-panel"><div className="panel-title"><div><h2>Фільтр пошуку</h2><p>Оберіть дату, напрямок і радіус</p></div><a href="/driver/map" aria-label="Закрити">×</a></div><form key={search} className="filter-form" action="/driver/map" method="get"><fieldset><legend>Дата завантаження</legend><div className="two-fields"><label>З<input type="date" name="dateFrom" defaultValue={params.get("dateFrom") || params.get("date") || ""}/></label><label>По<input type="date" name="dateTo" defaultValue={params.get("dateTo") || params.get("date") || ""}/></label></div></fieldset><label>Місце завантаження<input name="pickupCity" defaultValue={params.get("pickupCity") || params.get("city") || ""} placeholder="Наприклад, Одеса"/></label><label>Місце розвантаження<input name="dropoffCity" defaultValue={params.get("dropoffCity") || ""} placeholder="Будь-яке місце"/></label>{params.get("lat") && <input type="hidden" name="lat" value={params.get("lat") || ""} readOnly/>} {params.get("lon") && <input type="hidden" name="lon" value={params.get("lon") || ""} readOnly/>} {params.get("dropoffLat") && <input type="hidden" name="dropoffLat" value={params.get("dropoffLat") || ""} readOnly/>} {params.get("dropoffLon") && <input type="hidden" name="dropoffLon" value={params.get("dropoffLon") || ""} readOnly/>} {params.get("dropoffRadius") && <input type="hidden" name="dropoffRadius" value={params.get("dropoffRadius") || ""} readOnly/>}<fieldset><legend>Радіус пошуку, км</legend><input type="hidden" name="radius" value={radius} readOnly/><div className="radius-control"><button type="button" onClick={() => setRadius(Math.max(5, radius - 5))}>−</button><strong>{radius}</strong><button type="button" onClick={() => setRadius(Math.min(100, radius + 5))}>+</button></div></fieldset><div className="filter-actions"><a className="secondary" href="/driver/map">Очистити</a><button className="primary" type="submit">Пошук</button></div><a className="saved-search-link" href="/driver/map/saved-searches"><span><strong>Збережені критерії пошуку</strong><small>{savedCount == null ? "Ваші збережені фільтри" : `${savedCount} критеріїв`}</small></span>{savedCount != null && <b>{savedCount}</b>}<VIcon name="chevron"/></a></form></aside>;
}

function SavedSearches() {
  const [items, setItems] = useState<DriverSavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadSavedSearches() {
      const token = getStoredDriverToken();
      if (!token) return;
      try {
        setLoading(true);
        const data = await driverApiFetch<DriverSavedSearch[]>("/saved-searches", token);
        if (active) {
          setItems(data);
          setError("");
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Не вдалося завантажити збережені критерії");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadSavedSearches();
    return () => { active = false; };
  }, []);

  async function deleteSavedSearch(item: DriverSavedSearch) {
    const token = getStoredDriverToken();
    if (!token) return;
    try {
      await driverApiFetch<{ message?: string }>(`/saved-searches/${item.id}`, token, { method: "DELETE" });
      setItems((current) => current.filter((saved) => saved.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося видалити критерій");
    }
  }

  return <aside className="customer-card map-side-panel"><div className="panel-title"><div><h2>Збережені критерії пошуку</h2><p>Швидко застосовуйте готові фільтри</p></div><a href="/driver/map" aria-label="Закрити">×</a></div><div className="saved-search-list">{loading && <div className="customer-live-state">Завантаження критеріїв...</div>}{error && <div className="customer-live-state error">{error}</div>}{!loading && !error && items.map((item) => <article key={item.id}><h3>{item.pickupCity}{item.dropoffCity ? ` → ${item.dropoffCity}` : " → будь-яке місце"}</h3><p>Радіус: {item.radius || 30} км</p><div><a href={savedSearchHref(item)}>Застосувати</a><button type="button" onClick={() => deleteSavedSearch(item)}>Видалити</button></div></article>)}{!loading && !error && items.length === 0 && <div className="customer-empty compact"><h3>Збережених пошуків немає</h3><p>Створіть новий критерій у фільтрі мапи.</p></div>}</div></aside>;
}

function DriverMap({ mode, profile }: { mode: "map" | "filter" | "saved"; profile: DriverUserProfile | null }) {
  const [orders, setOrders] = useState<DriverAvailableOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    async function loadOrders() {
      const token = getStoredDriverToken();
      if (!token) return;
      try {
        setLoading(true);
        const nextSearch = currentDriverMapSearch();
        if (active) setSearch(nextSearch);
        const data = await driverApiFetch<{ available?: DriverAvailableOrder[] } | DriverAvailableOrder[]>(buildDriverOrdersPath(nextSearch), token);
        const nextOrders = Array.isArray(data) ? data : data.available || [];
        if (active) {
          setOrders(nextOrders);
          setError("");
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Не вдалося завантажити доступні замовлення");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadOrders();
    return () => { active = false; };
  }, [mode]);

  const mapOrders = orders.flatMap((order) => {
    const lat = driverNumber(order.pickupLat);
    const lon = driverNumber(order.pickupLon);
    if (lat == null || lon == null) return [];
    const local = isDriverLocalOrder(order);
    return [{
      id: order.id,
      title: `Замовлення № ${order.orderNumber || order.id} · ${driverRoute(order)}`,
      price: driverMoney(order.finalPrice ?? order.price, order.agreedPrice),
      markerLabel: driverShortPrice(order),
      markerColor: local ? "#16a34a" : "#EA580C",
      href: `/driver/orders/${order.id}`,
      lat,
      lon,
    }];
  });

  return <DriverLayout view={mode} title="Мапа замовлень" profile={profile}>
    <div className="driver-map-toolbar"><div><h2>Пошук замовлень</h2><p>{driverFilterSummary(search)}</p></div><div><a className={mode === "saved" ? "active" : ""} href="/driver/map/saved-searches">Збережені пошуки</a><a className="customer-primary" href={`/driver/map/filter${search}`}>Фільтр</a></div></div>
    <div className="driver-map-layout">
      <GoogleOrdersMap orders={mapOrders} className="driver-map-canvas"/>
      {mode === "filter" ? <FilterPanel key={search} search={search}/> : mode === "saved" ? <SavedSearches/> : <aside className="map-results">
        <div className="map-results-head"><strong>Знайдено {orders.length} замовлень</strong><span>{mapOrders.length} на мапі</span></div>
        <div className="driver-map-legend"><span><i className="local"/>Місцеві</span><span><i className="long"/>Далекі</span><span><i className="me"/>Моє місце</span></div>
        {loading && <div className="customer-card customer-live-state">Завантаження замовлень...</div>}
        {error && <div className="customer-card customer-live-state error">{error}</div>}
        {!loading && !error && orders.length === 0 && <div className="customer-card customer-empty compact"><h3>Вільних замовлень немає</h3><p>Коли замовники створять перевезення, вони з’являться тут і на мапі.</p></div>}
        {!loading && !error && orders.map((order) => <DriverAvailableOrderCard order={order} key={order.id}/>)}
      </aside>}
    </div>
  </DriverLayout>;
}

function DriverOrders({ profile }: { profile: DriverUserProfile | null }) {
  const [tab, setTab] = useState<"work" | "confirm" | "history">("work");
  const [orders, setOrders] = useState<DriverAvailableOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadOrders() {
      const token = getStoredDriverToken();
      if (!token) return;
      try {
        setLoading(true);
        const data = await driverApiFetch<DriverAvailableOrder[]>("/orders/my?role=DRIVER", token);
        if (active) {
          setOrders(data);
          setError("");
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Не вдалося завантажити ваші замовлення");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadOrders();
    return () => { active = false; };
  }, []);

  const work = orders.filter((order) => driverOrderTab(order) === "work");
  const confirm = orders.filter((order) => driverOrderTab(order) === "confirm");
  const history = orders.filter((order) => driverOrderTab(order) === "history");
  const cards = tab === "history" ? history : tab === "confirm" ? confirm : work;

  return <DriverLayout view="orders" title="Мої замовлення" profile={profile}><div className="customer-page-intro"><div><h2>Мої замовлення</h2></div></div><div className="driver-order-tabs"><button className={tab === "work" ? "active" : ""} onClick={() => setTab("work")}>В роботі <span>{work.length}</span></button><button className={tab === "confirm" ? "active" : ""} onClick={() => setTab("confirm")}>На підтвердженні <span>{confirm.length}</span></button><button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Історія <span>{history.length}</span></button></div>{loading && <div className="customer-card customer-live-state">Завантаження ваших замовлень...</div>}{error && <div className="customer-card customer-live-state error">{error}</div>}{!loading && !error && cards.length === 0 && <div className="customer-card customer-empty compact"><h3>У цьому розділі поки порожньо</h3><p>Тут з’являться замовлення, де ви водій або вже надіслали пропозицію.</p></div>}{!loading && !error && cards.length > 0 && <div className="driver-job-grid">{cards.map((order) => <article className="customer-card driver-job-card" key={order.id}><div className="driver-job-head"><span>№ {order.orderNumber || order.id}</span><strong>{driverStatusLabel(order)}</strong></div><h3>{driverRoute(order)}</h3><p><b>Місце завантаження:</b> {compactDriverOrderAddress(order, "pickup")}</p><p><b>Адреса розвантаження:</b> {compactDriverOrderAddress(order, "dropoff")}</p><div className="route-buttons"><a href={driverMapPointUrl(order, "pickup")} target="_blank" rel="noreferrer"><VIcon name="pin" size={18}/>Відкрити завантаження</a><a href={driverMapPointUrl(order, "dropoff")} target="_blank" rel="noreferrer"><VIcon name="pin" size={18}/>Відкрити розвантаження</a></div><dl><div><dt>Дата завантаження</dt><dd>{driverSchedule(order)}</dd></div><div><dt>Ціна</dt><dd>{driverMoney(order.finalPrice ?? order.price, order.agreedPrice)}</dd></div></dl><a className="driver-order-open" href={`/driver/orders/${order.id}`}>Відкрити замовлення <VIcon name="chevron" size={18}/></a></article>)}</div>}</DriverLayout>;
}

export default function DriverPortal({ view }: { view: DriverView }) {
  const [profile, setProfile] = useState<DriverUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [toast, setToast] = useState("");
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };

  useEffect(() => {
    async function loadProfile() {
      const token = getStoredDriverToken();
      if (!token) {
        window.location.href = "/";
        return;
      }
      try {
        let nextProfile = await driverApiFetch<DriverUserProfile>("/auth/me", token);
        if (nextProfile.role === "CUSTOMER") {
          await driverApiFetch<{ role: string; isAdmin?: boolean }>("/auth/role", token, {
            method: "PUT",
            body: JSON.stringify({ role: "DRIVER" }),
          });
          nextProfile = await driverApiFetch<DriverUserProfile>("/auth/me", token);
        }
        setProfile(nextProfile);
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : "Не вдалося завантажити профіль");
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  function logout() {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(KIND_KEY);
    window.location.href = "/";
  }

  if (loading) return <DriverLayout view={view} title="Завантаження" profile={profile}><div className="customer-card customer-live-state">Завантаження профілю...</div></DriverLayout>;
  if (authError) return <DriverLayout view={view} title="Помилка" profile={profile}><div className="customer-card customer-live-state error">{authError}</div></DriverLayout>;
  if (view === "settings") return <DriverSettings profile={profile} onLogout={logout}/>;
  if (view === "profile") return <DriverProfile profile={profile}/>;
  if (view === "map" || view === "filter" || view === "saved") return <DriverMap mode={view} profile={profile}/>;
  if (view === "orders") return <DriverOrders profile={profile}/>;
  if (view === "notifications") return <DriverLayout view="notifications" title="Сповіщення" profile={profile}><Notifications role="driver"/></DriverLayout>;
  return <DriverLayout view="support" title="Технічна підтримка" toast={toast} profile={profile}><Support notify={notify}/></DriverLayout>;
}
