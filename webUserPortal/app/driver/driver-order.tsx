"use client";

import { FormEvent, useEffect, useState } from "react";
import { FactVisual } from "../customer/fact-visual";
import { VIcon } from "../customer/v-icon";
import { DriverLayout } from "./driver-portal";

type OrderStage = "available" | "active" | "completed";

type DriverProfile = {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  role?: "CUSTOMER" | "DRIVER" | "BOTH" | "ADMIN";
  firstName?: string;
  lastName?: string;
  patronymic?: string;
};

type DriverOrderData = {
  id: number;
  orderNumber?: number | string;
  customerId?: number;
  status?: string;
  myResponseStatus?: string | null;
  createdAt?: string;
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
  length?: number | string;
  width?: number | string;
  height?: number | string;
  cargoVolume?: number | string;
  cargoWeight?: number | string;
  cargoType?: string;
  freeDateUntil?: string;
  loadFrom?: string;
  timingOption?: string;
  loadHelp?: boolean;
  unloadHelp?: boolean;
  payment?: string;
  price?: number | string | null;
  finalPrice?: number | string | null;
  agreedPrice?: boolean;
  requestedOrderType?: string;
  isIntraCity?: boolean;
  photos?: string[] | string;
  customer?: {
    id?: number;
    name?: string;
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    patronymic?: string;
    rating?: number;
    completedOrders?: number;
    customerCompletedOrders?: number;
  };
};

type DriverOrderResponse = {
  id: number;
  status?: string;
  hourlyRate?: number | string | null;
  minHours?: number | string | null;
  offerTotal?: number | string | null;
  finalPriceOffer?: number | string | null;
  customerCounterPrice?: number | string | null;
  arrivalEta?: string | null;
  expiresAt?: string | null;
};

type RatingResult = {
  id?: number;
  rating?: number;
  comment?: string | null;
};

const TOKEN_KEY = "vango.webUserPortal.token";
const KIND_KEY = "vango.webUserPortal.kind";

async function apiFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
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

function getToken() {
  if (typeof window === "undefined") return "";
  if (window.localStorage.getItem(KIND_KEY) === "portal-admin") return "";
  return window.localStorage.getItem(TOKEN_KEY) || "";
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function money(value: unknown, agreedPrice?: boolean) {
  if (agreedPrice) return "Договірна";
  const number = numberValue(value);
  if (number == null || number <= 0) return "Пропонується водієм";
  return `${number.toLocaleString("uk-UA")} грн`;
}

function dateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fullLocationText(order: DriverOrderData, side: "pickup" | "dropoff") {
  const city = side === "pickup" ? order.pickupCity : order.dropoffCity;
  const address = side === "pickup" ? order.pickupAddress : order.dropoffAddress;
  const location = side === "pickup" ? order.pickupLocation : order.dropoffLocation;
  return location || [city, address].filter(Boolean).join(", ") || "Не вказано";
}

function compactLocationText(order: DriverOrderData, side: "pickup" | "dropoff") {
  const city = side === "pickup" ? order.pickupCity : order.dropoffCity;
  const address = side === "pickup" ? order.pickupAddress : order.dropoffAddress;
  const location = side === "pickup" ? order.pickupLocation : order.dropoffLocation;
  const raw = (address || location || "").trim();
  const explicitCity = city?.trim();
  if (!raw) return explicitCity || "Не вказано";

  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return explicitCity && !raw.toLowerCase().includes(explicitCity.toLowerCase()) ? `${explicitCity}, ${raw}` : raw;

  const house = parts.find((part) => /^\d+[\dA-Za-zА-Яа-яІіЇїЄєҐґ/-]*/.test(part));
  const street = parts.find((part) => /(^|\s)(вулиця|вул\.?|проспект|просп\.?|провулок|пров\.?|проїзд|бульвар|площа|шосе|узвіз|набережна|дорога)(\s|$)/i.test(part))
    || (house === parts[0] ? parts[1] : parts[0]);
  const addressCity = explicitCity || parts.find((part) => {
    const lower = part.toLowerCase();
    return part !== house
      && part !== street
      && !/^\d{5,6}$/.test(part)
      && !lower.includes("мікрорайон")
      && !lower.includes("район")
      && !lower.includes("область")
      && !lower.includes("громада")
      && !lower.includes("україна");
  });

  if (!street) return addressCity || raw;
  const streetWithHouse = house && !street.includes(house) ? `${street} ${house}` : street;
  return addressCity ? `${addressCity}, ${streetWithHouse}` : streetWithHouse;
}

function locationText(order: DriverOrderData, side: "pickup" | "dropoff") {
  return compactLocationText(order, side);
}

function mapPointUrl(order: DriverOrderData, side: "pickup" | "dropoff") {
  const lat = numberValue(side === "pickup" ? order.pickupLat : order.dropoffLat);
  const lon = numberValue(side === "pickup" ? order.pickupLon : order.dropoffLon);
  const query = lat != null && lon != null ? `${lat},${lon}` : fullLocationText(order, side);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function cityText(order: DriverOrderData, side: "pickup" | "dropoff") {
  const city = side === "pickup" ? order.pickupCity : order.dropoffCity;
  const location = side === "pickup" ? order.pickupLocation : order.dropoffLocation;
  return city || location || "Не вказано";
}

function isLocal(order: DriverOrderData) {
  return Boolean(order.isIntraCity || order.requestedOrderType === "LOCAL");
}

function typeText(order: DriverOrderData) {
  return isLocal(order) ? "Місцеве перевезення" : "Далеке перевезення";
}

function scheduleText(order: DriverOrderData) {
  if (order.timingOption === "asap") return "Якнайшвидше";
  if (order.timingOption === "within_hour") return "До 1 години";
  if (order.freeDateUntil) return `Вільна дата до ${dateTime(order.freeDateUntil)}`;
  if (order.loadFrom) return dateTime(order.loadFrom);
  return "Час подачі не вказано";
}

function distanceText(order: DriverOrderData) {
  const distance = numberValue(order.distance);
  return distance == null ? "-" : `≈ ${distance.toLocaleString("uk-UA")} км`;
}

function dimensionsText(order: DriverOrderData) {
  const length = numberValue(order.length);
  const width = numberValue(order.width);
  const height = numberValue(order.height);
  const volume = numberValue(order.cargoVolume);
  const size = [length, width, height].every((value) => value != null)
    ? `${length} × ${width} × ${height} м`
    : "";
  return [size, volume != null ? `${volume.toLocaleString("uk-UA")} м³` : ""].filter(Boolean).join(" · ") || "-";
}

function statusText(order: DriverOrderData, stage: OrderStage) {
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
  };
  return (order.myResponseStatus && responseLabels[order.myResponseStatus]) || statusLabels[order.status || ""] || (stage === "completed" ? "Виконано" : stage === "active" ? "В роботі" : "Створено");
}

function responseStatusText(status?: string) {
  const labels: Record<string, string> = {
    RESPONDED: "Пропозицію надіслано",
    CALL_MADE: "Дзвінок зроблено",
    PENDING_CONFIRM: "Замовник може підтвердити",
    DISCUSSING: "Очікуємо рішення замовника",
    COUNTER_OFFERED: "Замовник запропонував іншу ціну",
    CONFIRMED: "Підтверджено",
  };
  return status ? labels[status] || status : "Пропозицію надіслано";
}

function responseMoney(response: DriverOrderResponse | null, order?: DriverOrderData | null) {
  if (!response) return "-";
  if (response.status === "COUNTER_OFFERED" && response.customerCounterPrice) return money(response.customerCounterPrice);
  return money(response.finalPriceOffer ?? response.offerTotal ?? order?.finalPrice ?? order?.price);
}

function inferStage(order: DriverOrderData): OrderStage {
  if (["COMPLETED", "CANCELLED", "REJECTED"].includes(order.status || "")) return "completed";
  if (["ACCEPTED", "IN_PROGRESS", "DELIVERED"].includes(order.status || "")) return "active";
  return "available";
}

function nextDriverStatusAction(order: DriverOrderData) {
  if (order.status === "ACCEPTED") {
    return {
      status: "IN_PROGRESS",
      label: "Отримав вантаж",
      confirmText: "Підтвердити отримання вантажу?",
      successText: "Статус оновлено: водій отримав вантаж",
    };
  }
  if (order.status === "IN_PROGRESS") {
    return {
      status: "DELIVERED",
      label: "Віддав вантаж",
      confirmText: "Підтвердити передачу вантажу?",
      successText: "Статус оновлено: вантаж передано",
    };
  }
  return null;
}

function cleanText(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function customerName(order: DriverOrderData) {
  const customer = order.customer;
  const fullName = [customer?.lastName, customer?.firstName, customer?.patronymic].map(cleanText).filter(Boolean).join(" ");
  if (fullName) return fullName;
  const storedName = cleanText(customer?.name);
  if (storedName && storedName.toLowerCase() !== "замовник") return storedName;
  return cleanText(customer?.phone) || cleanText(customer?.email) || (customer?.id ? `Замовник № ${customer.id}` : "Замовник");
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || "З"}${parts[1]?.[0] || ""}`.toUpperCase();
}

function orderPhotos(order: DriverOrderData) {
  if (Array.isArray(order.photos)) return order.photos.filter(Boolean);
  if (!order.photos) return [];
  try {
    const parsed = JSON.parse(order.photos);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [order.photos];
  }
}

function DriverNegotiationPanel({
  order,
  response,
  loading,
  error,
  onAccept,
  onReject,
  onCounter,
}: {
  order: DriverOrderData;
  response: DriverOrderResponse;
  loading: string;
  error: string;
  onAccept: () => void;
  onReject: () => void;
  onCounter: (value: number) => void;
}) {
  const [counterOpen, setCounterOpen] = useState(response.status === "COUNTER_OFFERED");
  const initial = numberValue(response.customerCounterPrice ?? response.finalPriceOffer ?? order.finalPrice ?? order.price);
  const [value, setValue] = useState(initial && initial > 0 ? String(Math.round(initial)) : "");
  const isLongOrder = !isLocal(order);
  const hasCustomerCounter = response.status === "COUNTER_OFFERED";
  const canSendCounter = isLongOrder && ["RESPONDED", "CALL_MADE", "PENDING_CONFIRM", "DISCUSSING", "COUNTER_OFFERED"].includes(response.status || "");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const price = Number(value);
    onCounter(price);
  }

  return <section className="customer-card driver-negotiation-card">
    <div className="proposal-form-head"><span><VIcon name="money"/></span><div><h3>{responseStatusText(response.status)}</h3><p>{hasCustomerCounter ? "Погодьтесь із ціною замовника або запропонуйте свою" : "Стежте за статусом вашої пропозиції"}</p></div></div>
    <div className="negotiation-price"><span>{hasCustomerCounter ? "Ціна замовника" : "Ваша пропозиція"}</span><strong>{responseMoney(response, order)}</strong></div>
    {hasCustomerCounter && <div className="counter-note"><VIcon name="money" size={18}/><span>Якщо погодитесь, замовлення одразу закріпиться за вами за цією фінальною ціною.</span></div>}
    {counterOpen && canSendCounter && <form className="counter-offer-form" onSubmit={submit}>
      <label>Ваша фінальна ціна, грн<input type="number" min="100" step="100" value={value} onChange={(event) => setValue(event.target.value)} autoFocus/></label>
      <div><button type="button" onClick={() => setCounterOpen(false)}>Скасувати</button><button className="customer-primary" disabled={loading === "counter"}>{loading === "counter" ? "Надсилаємо..." : "Надіслати"}</button></div>
    </form>}
    {error && <p className="customer-form-error">{error}</p>}
    {hasCustomerCounter ? <div className="negotiation-actions"><button className="customer-primary" type="button" onClick={onAccept} disabled={Boolean(loading)}>{loading === "accept" ? "Підтверджуємо..." : "Погодитись"}</button><button className="outline-action" type="button" onClick={() => setCounterOpen(true)} disabled={Boolean(loading)}>Своя ціна</button><button className="danger-action" type="button" onClick={onReject} disabled={Boolean(loading)}>{loading === "reject" ? "Відхиляємо..." : "Відхилити"}</button></div> : canSendCounter && !counterOpen ? <button className="outline-action" type="button" onClick={() => setCounterOpen(true)} disabled={Boolean(loading)}>Змінити свою ціну</button> : null}
  </section>;
}

function DriverSystemConfirm({
  title,
  message,
  confirmLabel = "Підтвердити",
  cancelLabel = "Скасувати",
  loading,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return <div className="system-modal-backdrop" role="presentation" onClick={onCancel}>
    <section className="system-modal-card" role="dialog" aria-modal="true" aria-labelledby="driver-status-confirm-title" onClick={(event) => event.stopPropagation()}>
      <span className="system-modal-icon"><VIcon name="check" size={24}/></span>
      <div>
        <h3 id="driver-status-confirm-title">{title}</h3>
        <p>{message}</p>
      </div>
      <div className="system-modal-actions">
        <button type="button" className="system-modal-secondary" onClick={onCancel} disabled={loading}>{cancelLabel}</button>
        <button type="button" className="customer-primary" onClick={onConfirm} disabled={loading}>{loading ? "Оновлюємо..." : confirmLabel}</button>
      </div>
    </section>
  </div>;
}

function DriverRatingCard({ order, customer }: { order: DriverOrderData; customer: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const targetId = order.customer?.id || order.customerId;
  const canRate = Boolean(targetId && ["DELIVERED", "COMPLETED"].includes(order.status || ""));

  if (!canRate) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rating) {
      setError("Оберіть оцінку від 1 до 5");
      return;
    }

    const token = getToken();
    if (!token) {
      window.location.href = "/";
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const saved = await apiFetch<RatingResult>("/ratings", token, {
        method: "POST",
        body: JSON.stringify({ toUserId: targetId, orderId: order.id, rating, comment }),
      });
      setRating(Number(saved.rating) || rating);
      setComment(saved.comment || comment);
      setMessage("Оцінку збережено");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося зберегти оцінку");
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="customer-card rating-card">
    <div className="rating-card-head"><span>★</span><div><h3>Оцінити замовника</h3><p>{customer} · замовлення № {order.orderNumber || order.id}</p></div></div>
    <form onSubmit={submit}>
      <div className="rating-stars" role="radiogroup" aria-label="Оцінка замовника">
        {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" className={value <= rating ? "active" : ""} aria-checked={rating === value} role="radio" onClick={() => { setRating(value); setError(""); }}>★</button>)}
      </div>
      <label>Коментар<textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="За бажанням" maxLength={1000}/></label>
      {error && <p className="customer-form-error">{error}</p>}
      {message && <p className="rating-success">{message}</p>}
      <button className="customer-primary" type="submit" disabled={submitting || !rating}>{submitting ? "Зберігаємо..." : message ? "Оновити оцінку" : "Надіслати оцінку"}</button>
    </form>
  </section>;
}

export default function DriverOrder({ proposal = false, orderId, stage }: { proposal?: boolean; orderId: number; stage?: OrderStage }) {
  const [toast, setToast] = useState("");
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [order, setOrder] = useState<DriverOrderData | null>(null);
  const [myResponse, setMyResponse] = useState<DriverOrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [negotiationLoading, setNegotiationLoading] = useState("");
  const [negotiationError, setNegotiationError] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [statusConfirmAction, setStatusConfirmAction] = useState<ReturnType<typeof nextDriverStatusAction>>(null);

  useEffect(() => {
    let active = true;
    async function loadOrder() {
      const token = getToken();
      if (!token) {
        window.location.href = "/";
        return;
      }
      try {
        setLoading(true);
        let nextProfile = await apiFetch<DriverProfile>("/auth/me", token);
        if (nextProfile.role === "CUSTOMER") {
          await apiFetch<{ role: string }>("/auth/role", token, { method: "PUT", body: JSON.stringify({ role: "DRIVER" }) });
          nextProfile = await apiFetch<DriverProfile>("/auth/me", token);
        }
        const nextOrder = await apiFetch<DriverOrderData>(`/orders/${orderId}`, token);
        const nextResponse = await apiFetch<DriverOrderResponse>(`/orders/${orderId}/respond/mine`, token).catch(() => null);
        if (active) {
          setProfile(nextProfile);
          setOrder({ ...nextOrder, myResponseStatus: nextResponse?.status || nextOrder.myResponseStatus });
          setMyResponse(nextResponse);
          setError("");
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Не вдалося завантажити замовлення");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadOrder();
    return () => { active = false; };
  }, [orderId]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function submitProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order) return;
    const token = getToken();
    const data = new FormData(event.currentTarget);
    const body = isLocal(order)
      ? {
          hourlyRate: Number(data.get("hourlyRate")),
          minHours: Number(data.get("minHours")),
          arrivalEta: String(data.get("arrivalEta") || ""),
        }
      : {
          finalPrice: Number(data.get("finalPrice")),
          immediateConfirm: Boolean(data.get("immediateConfirm")),
        };
    try {
      setSubmitting(true);
      setFormError("");
      await apiFetch(`/orders/${order.id}/respond`, token, { method: "POST", body: JSON.stringify(body) });
      notify(`Пропозицію на замовлення № ${order.orderNumber || order.id} надіслано`);
      window.setTimeout(() => { window.location.href = "/driver/orders"; }, 900);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Не вдалося надіслати пропозицію");
    } finally {
      setSubmitting(false);
    }
  }

  async function acceptCounterOffer() {
    if (!order || !myResponse) return;
    const token = getToken();
    if (!token) return;
    setNegotiationLoading("accept");
    setNegotiationError("");
    try {
      const updated = await apiFetch<DriverOrderData>(`/orders/${order.id}/respond/${myResponse.id}/counter-decision`, token, {
        method: "POST",
        body: JSON.stringify({ decision: "accept" }),
      });
      setOrder({ ...updated, myResponseStatus: "CONFIRMED" });
      setMyResponse({ ...myResponse, status: "CONFIRMED", finalPriceOffer: myResponse.customerCounterPrice, customerCounterPrice: null });
      notify("Контрпропозицію прийнято. Замовлення закріплено за вами.");
    } catch (err) {
      setNegotiationError(err instanceof Error ? err.message : "Не вдалося прийняти контрпропозицію");
    } finally {
      setNegotiationLoading("");
    }
  }

  async function rejectCounterOffer() {
    if (!order || !myResponse) return;
    const token = getToken();
    if (!token) return;
    setNegotiationLoading("reject");
    setNegotiationError("");
    try {
      await apiFetch<DriverOrderResponse>(`/orders/${order.id}/respond/${myResponse.id}/counter-decision`, token, {
        method: "POST",
        body: JSON.stringify({ decision: "reject" }),
      });
      setMyResponse(null);
      setOrder({ ...order, myResponseStatus: null });
      notify("Контрпропозицію відхилено");
    } catch (err) {
      setNegotiationError(err instanceof Error ? err.message : "Не вдалося відхилити контрпропозицію");
    } finally {
      setNegotiationLoading("");
    }
  }

  async function submitDriverCounterOffer(value: number) {
    if (!order || !myResponse || !Number.isFinite(value) || value <= 0) {
      setNegotiationError("Вкажіть коректну фінальну ціну");
      return;
    }
    const token = getToken();
    if (!token) return;
    setNegotiationLoading("counter");
    setNegotiationError("");
    try {
      const updated = await apiFetch<DriverOrderResponse>(`/orders/${order.id}/respond/${myResponse.id}/counter`, token, {
        method: "POST",
        body: JSON.stringify({ finalPrice: Math.round(value) }),
      });
      setMyResponse(updated);
      setOrder({ ...order, myResponseStatus: updated.status || order.myResponseStatus });
      notify("Вашу ціну надіслано замовнику");
    } catch (err) {
      setNegotiationError(err instanceof Error ? err.message : "Не вдалося надіслати свою ціну");
    } finally {
      setNegotiationLoading("");
    }
  }

  async function updateDriverStatus() {
    if (!order) return;
    const action = statusConfirmAction || nextDriverStatusAction(order);
    if (!action) return;
    const token = getToken();
    if (!token) return;
    setStatusLoading(true);
    setStatusError("");
    try {
      setStatusConfirmAction(null);
      const updated = await apiFetch<DriverOrderData>(`/orders/${order.id}/status`, token, {
        method: "PATCH",
        body: JSON.stringify({ status: action.status }),
      });
      setOrder({ ...updated, myResponseStatus: myResponse?.status || updated.myResponseStatus });
      notify(action.successText);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Не вдалося оновити статус");
    } finally {
      setStatusLoading(false);
    }
  }

  const currentStage = order ? stage ?? inferStage(order) : stage ?? "available";
  const backHref = currentStage === "available" ? "/driver/map" : "/driver/orders";
  const backText = currentStage === "available" ? "До пошуку замовлень" : "До моїх замовлень";

  if (loading) {
    return <DriverLayout view="map" title="Завантаження" profile={profile}><div className="customer-card customer-live-state">Завантаження замовлення...</div></DriverLayout>;
  }
  if (error || !order) {
    return <DriverLayout view="map" title="Помилка" profile={profile}><a className="back-link" href="/driver/map"><VIcon name="arrow"/>До пошуку замовлень</a><div className="customer-card customer-live-state error">{error || "Замовлення не знайдено"}</div></DriverLayout>;
  }

  const customer = customerName(order);
  const rating = numberValue(order.customer?.rating);
  const checks = order.customer?.completedOrders ?? order.customer?.customerCompletedOrders ?? 0;
  const photoList = orderPhotos(order);
  const price = money(order.finalPrice ?? order.price, order.agreedPrice);
  const statusAction = nextDriverStatusAction(order);

  return <DriverLayout view={currentStage === "available" ? "map" : "orders"} title={`Замовлення № ${order.orderNumber || order.id}`} toast={toast} profile={profile}>
    <a className="back-link" href={backHref}><VIcon name="arrow"/>{backText}</a>
    <div className="order-detail-head"><div><small>{dateTime(order.createdAt)}</small><h2>{typeText(order)} · {distanceText(order).replace("≈ ", "")}</h2></div><span className={`big-status ${currentStage === "active" ? "blue" : "green"}`}>{statusText(order, currentStage)}</span></div>
    <div className="driver-order-grid"><div>
      <section className="customer-card customer-owner"><span className="mini-avatar green">{initials(customer)}</span><div><strong>{customer}</strong><small>Рейтинг замовника: ★ {rating != null ? rating.toFixed(1) : "5.0"} · ✓ {checks}</small></div></section>
      <section className="customer-card order-facts-card"><h3>Маршрут і деталі</h3><div className="fact-route order-point-route"><i className="from"/><div><span>Звідки</span><div className="route-point-line"><strong>{locationText(order, "pickup")}</strong><a href={mapPointUrl(order, "pickup")} target="_blank" rel="noreferrer"><VIcon name="pin" size={16}/>Мапа</a></div></div><i className="to"/><div><span>Куди</span><div className="route-point-line"><strong>{locationText(order, "dropoff")}</strong><a href={mapPointUrl(order, "dropoff")} target="_blank" rel="noreferrer"><VIcon name="pin" size={16}/>Мапа</a></div></div></div><div className="facts-visual-grid"><FactVisual icon="route" label="Відстань" value={distanceText(order)} tone="blue"/><FactVisual icon="cube" label="Габарити" value={dimensionsText(order)} tone="violet"/><FactVisual icon="case" label="Вага" value={order.cargoWeight ? `${Number(order.cargoWeight).toLocaleString("uk-UA")} кг` : "-"} tone="orange"/><FactVisual icon="car" label="Подача авто" value={scheduleText(order)} tone="green"/><FactVisual icon="card" label="Оплата" value={order.payment === "card" ? "Карта" : "Готівка"} tone="teal"/><FactVisual icon="upload" label="Завантаження допомагає" value={order.loadHelp ? "Так" : "Ні"} tone="green"/><FactVisual icon="upload" label="Розвантаження допомагає" value={order.unloadHelp ? "Так" : "Ні"} tone="orange"/><FactVisual icon="money" label="Ціна" value={price} tone="teal"/><FactVisual icon="edit" label="Опис" value={order.cargoType || "-"} tone="slate" wide/></div>{photoList.length > 0 ? <div className="order-photo-grid">{photoList.map((photo) => <a href={photo} target="_blank" rel="noreferrer" key={photo}><img src={photo} alt="Фото вантажу"/></a>)}</div> : <div className="cargo-photo-placeholder"><VIcon name="image" size={28}/><span>Фото вантажу</span></div>}</section>
    </div><aside>
      {currentStage === "completed" ? <section className="customer-card completed-order-summary"><span><VIcon name="check" size={26}/></span><h3>Замовлення виконано</h3><p>Вантаж передано замовнику, оплату підтверджено.</p></section>
      : currentStage === "active" ? <section className="customer-card distant-order-actions"><div className="proposal-form-head"><span><VIcon name="route"/></span><div><h3>Перевезення в роботі</h3><p>{statusAction ? "Оновіть етап виконання замовлення" : "Очікуємо підтвердження замовника"}</p></div></div>{statusAction ? <button className="customer-primary" onClick={() => setStatusConfirmAction(statusAction)} disabled={statusLoading}>{statusLoading ? "Оновлюємо..." : statusAction.label}</button> : <div className="status-wait-note">Ви повідомили про доставку. Замовник має підтвердити завершення.</div>}{statusError && <p className="customer-form-error">{statusError}</p>}</section>
      : myResponse && !proposal && !isLocal(order) ? <DriverNegotiationPanel key={`${myResponse.status || myResponse.id}-${myResponse.finalPriceOffer || ""}-${myResponse.customerCounterPrice || ""}`} order={order} response={myResponse} loading={negotiationLoading} error={negotiationError} onAccept={acceptCounterOffer} onReject={rejectCounterOffer} onCounter={submitDriverCounterOffer}/>
      : !proposal ? <section className="customer-card driver-cta"><span><VIcon name="send" size={28}/></span><h3>Готові виконати замовлення?</h3><p>Укажіть свою ставку, мінімальну кількість годин і час прибуття.</p><a className="customer-primary" href={`/driver/orders/${order.id}/proposal`}>Запропонувати ціну</a><small>Замовник отримає пропозицію та підтвердить її</small></section>
      : <form className="customer-card proposal-form" onSubmit={submitProposal}><div className="proposal-form-head"><span><VIcon name="send"/></span><div><h3>Дані для пропозиції</h3><p>Умови, які побачить замовник</p></div></div>{isLocal(order) ? <><label>Ставка, грн/год<input name="hourlyRate" type="number" min="1" defaultValue="450"/></label><label>Мінімум годин<input name="minHours" type="number" min="1" step="0.5" defaultValue="1"/></label><fieldset><legend>Час прибуття</legend><div className="arrival-options"><label><input name="arrivalEta" value="15m" type="radio"/>до 15 хв</label><label><input name="arrivalEta" value="30m" type="radio" defaultChecked/>до 30 хв</label><label><input name="arrivalEta" value="1h" type="radio"/>до 1 год</label><label><input name="arrivalEta" value="several_hours" type="radio"/>кілька годин</label></div></fieldset></> : <><label>Фінальна ціна, грн<input name="finalPrice" type="number" min="100" step="100" defaultValue={numberValue(order.finalPrice ?? order.price) || ""}/></label><label className="checkbox-line"><input name="immediateConfirm" type="checkbox"/> Підтвердити відразу</label></>}<div className="proposal-total"><span>{isLocal(order) ? "Разом за мінімальний час" : "Пропозиція водія"}</span><strong>{isLocal(order) ? "450 грн" : price}</strong></div>{formError && <p className="customer-form-error">{formError}</p>}<button className="customer-primary" disabled={submitting}>{submitting ? "Надсилання..." : "Запропонувати ціну"}</button><small>Замовник отримає пропозицію та підтвердить її</small></form>}
      <DriverRatingCard order={order} customer={customer}/>
    </aside></div>
    {statusConfirmAction && <DriverSystemConfirm title="Оновити статус замовлення?" message={statusConfirmAction.confirmText} confirmLabel={statusConfirmAction.label} loading={statusLoading} onConfirm={updateDriverStatus} onCancel={() => setStatusConfirmAction(null)}/>}
  </DriverLayout>;
}
