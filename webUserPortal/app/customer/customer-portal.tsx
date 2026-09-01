"use client";

import { ChangeEvent, FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { GooglePlacePicker, type GooglePoint } from "../google-maps";
import { FactVisual } from "./fact-visual";
import Reports from "./reports/reports";
import { VIcon } from "./v-icon";
export { VIcon } from "./v-icon";

export type CustomerView = "loading" | "orders" | "reports" | "settings" | "profile" | "create" | "createLocal" | "createLong" | "notifications" | "support" | "orderDetail" | "orderCreated" | "orderActive" | "orderReport";

type UserProfile = {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  role?: "CUSTOMER" | "DRIVER" | "BOTH" | "ADMIN";
  isAdmin?: boolean;
  blocked?: boolean;
  group?: { id: number; name: string } | null;
  firstName?: string;
  lastName?: string;
  patronymic?: string;
  selfiePhoto?: string | null;
  city?: string;
  customerRating?: number;
  customerCompletedOrders?: number;
  driverRating?: number;
  driverCompletedOrders?: number;
  completedOrders?: number;
  hasPortalAdminAccess?: boolean;
};

type CustomerOrder = {
  id: number;
  orderNumber?: number;
  customerId?: number;
  driverId?: number | null;
  status?: string;
  pickupCity?: string;
  pickupLocation?: string;
  pickupAddress?: string;
  pickupLat?: number;
  pickupLon?: number;
  dropoffCity?: string;
  dropoffLocation?: string;
  dropoffAddress?: string;
  dropoffLat?: number;
  dropoffLon?: number;
  cargoType?: string;
  distance?: number;
  price?: number;
  finalPrice?: number;
  loadFrom?: string;
  loadTo?: string;
  unloadFrom?: string;
  unloadTo?: string;
  freeDate?: boolean;
  freeDateUntil?: string;
  updatedAt?: string;
  createdAt?: string;
  driver?: UserProfile | null;
  candidateDriver?: UserProfile | null;
  reservedDriver?: UserProfile | null;
  responseCount?: number;
  requestedOrderType?: "LOCAL" | "LONG_DISTANCE";
  isIntraCity?: boolean;
  timingOption?: "ASAP" | "WITHIN_1_HOUR" | "SCHEDULED";
  payment?: "cash" | "card";
  agreedPrice?: boolean;
  cargoLength?: number;
  cargoWidth?: number;
  cargoHeight?: number;
  cargoVolume?: number;
  cargoWeight?: number;
  loadHelp?: boolean;
  unloadHelp?: boolean;
  photos?: string[] | string;
  history?: Array<{ status?: string; at?: string; photo?: string | string[]; photos?: string[] | string }>;
};

type CustomerOrderResponse = {
  id: number;
  orderId?: number;
  driverId?: number;
  status?: string;
  hourlyRate?: number | null;
  minHours?: number | null;
  arrivalEta?: string | null;
  offerTotal?: number | null;
  finalPriceOffer?: number | null;
  customerCounterPrice?: number | null;
  respondedAt?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  driverRating?: number | null;
  driverCompletedOrders?: number | null;
  driver?: UserProfile | null;
};

type PortalNotification = {
  id: string;
  title?: string;
  body?: string;
  read?: boolean;
  receivedAt?: string;
  data?: {
    orderId?: string | number | null;
    navigateTo?: string | null;
    reminderStep?: string;
    reason?: string | null;
    supportQuestionId?: string | number;
    ratingId?: string | number;
  };
};

type SupportQuestion = {
  id: number;
  question?: string;
  status?: "OPEN" | "ANSWERED" | "CLOSED" | string;
  answer?: string | null;
  photos?: string[] | null;
  createdAt?: string;
  answeredAt?: string | null;
};

type SupportBotMessage = {
  id: string;
  role: "bot" | "user";
  text: string;
  pending?: boolean;
  error?: boolean;
};

type RatingResult = {
  id?: number;
  rating?: number;
  comment?: string | null;
};

type AdminSwitchResult = {
  token: string;
  admin: {
    id: number;
    name?: string;
    email?: string;
    phone?: string;
    selfiePhoto?: string | null;
    isPortalAdmin: true;
  };
};

const TOKEN_KEY = "vango.webUserPortal.token";
const KIND_KEY = "vango.webUserPortal.kind";
const THEME_KEY = "vango.webUserPortal.customerTheme";
const NOTIFICATION_BADGE_EVENT = "vango:web-notifications-updated";

async function customerApiFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const message = (await response.text()).trim();
    throw new Error(message || `HTTP ${response.status}`);
  }
  if (response.status === 204) return null as T;
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : ((await response.text()) as T);
}

function getStoredUserToken() {
  if (typeof window === "undefined") return "";
  const kind = window.localStorage.getItem(KIND_KEY);
  if (kind === "portal-admin") return "";
  return window.localStorage.getItem(TOKEN_KEY) || "";
}

function notifyNotificationBadgeChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NOTIFICATION_BADGE_EVENT));
}

export function NotificationBell({ href }: { href: string }) {
  const [hasUnread, setHasUnread] = useState(false);

  async function loadUnreadState() {
    const token = getStoredUserToken();
    if (!token) {
      setHasUnread(false);
      return;
    }

    try {
      const items = await customerApiFetch<PortalNotification[]>("/notifications", token);
      setHasUnread(Array.isArray(items) && items.some((item) => !item.read));
    } catch {
      setHasUnread(false);
    }
  }

  useEffect(() => {
    loadUnreadState();
    const timer = window.setInterval(loadUnreadState, 30000);
    window.addEventListener("focus", loadUnreadState);
    window.addEventListener(NOTIFICATION_BADGE_EVENT, loadUnreadState);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", loadUnreadState);
      window.removeEventListener(NOTIFICATION_BADGE_EVENT, loadUnreadState);
    };
  }, []);

  return <a href={href} aria-label="Сповіщення"><VIcon name="bell"/>{hasUnread && <i/>}</a>;
}

function customerDisplayName(profile?: Partial<UserProfile> | null) {
  return profile?.name || [profile?.lastName, profile?.firstName, profile?.patronymic].filter(Boolean).join(" ") || profile?.phone || profile?.email || "Користувач VanGo";
}

function customerInitials(profile?: Partial<UserProfile> | null) {
  const source = customerDisplayName(profile);
  const parts = source.split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || "V"}${parts[1]?.[0] || "G"}`.toUpperCase();
}

function CustomerAvatar({ profile, className, tone = "" }: { profile?: Partial<UserProfile> | null; className: string; tone?: string }) {
  const [failed, setFailed] = useState(false);
  const photo = failed ? "" : normalizePhotoUrl(profile?.selfiePhoto || "");
  const classes = [className, tone].filter(Boolean).join(" ");
  return <span className={classes}>{photo ? <img src={photo} alt={customerDisplayName(profile)} onError={() => setFailed(true)}/> : customerInitials(profile)}</span>;
}

function CustomerSystemConfirm({
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
  return <div className="system-modal-backdrop" role="presentation" onClick={() => !loading && onCancel()}>
    <section className="system-modal-card" role="dialog" aria-modal="true" aria-labelledby="customer-confirm-title" onClick={(event) => event.stopPropagation()}>
      <span className="system-modal-icon"><VIcon name="check" size={24}/></span>
      <div>
        <h3 id="customer-confirm-title">{title}</h3>
        <p>{message}</p>
      </div>
      <div className="system-modal-actions">
        <button type="button" className="system-modal-secondary" onClick={onCancel} disabled={loading}>{cancelLabel}</button>
        <button type="button" className="customer-primary" onClick={onConfirm} disabled={loading}>{loading ? "Підтверджуємо..." : confirmLabel}</button>
      </div>
    </section>
  </div>;
}

function customerRoleLabel(role?: string) {
  if (role === "DRIVER") return "Водій";
  if (role === "BOTH") return "Замовник і водій";
  if (role === "ADMIN") return "Адмін";
  return "Замовник";
}

function customerStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    CREATED: "Створено",
    PRICE_UPDATED: "Ціну змінено",
    ACCEPTED: "Прийнято",
    IN_PROGRESS: "В роботі",
    DELIVERED: "Доставлено",
    COMPLETED: "Доставлено",
    PENDING: "Очікує",
    CANCELLED: "Скасовано",
    REJECTED: "Відхилено",
  };
  return status ? labels[status] || status : "Створено";
}

function customerOrderBadgeLabel(order: CustomerOrder) {
  if (["ACCEPTED", "IN_PROGRESS", "PENDING"].includes(order.status || "")) return "Водій в дорозі";
  if (order.status === "DELIVERED") return "Замовлення доставлено";
  return customerStatusLabel(order.status);
}

function customerMoney(value: unknown) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return `${Math.round(num).toLocaleString("uk-UA")} грн`;
}

function customerDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("uk-UA");
}

function customerDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "short" });
}

function dateInputValue(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function timeInputValue(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toTimeString().slice(0, 5);
}

function dateTimeFromInputs(dateValue: FormDataEntryValue | null, timeValue: FormDataEntryValue | null, fallback?: string) {
  const fallbackDate = fallback ? new Date(fallback) : new Date();
  const date = String(dateValue || dateInputValue(fallback)).trim();
  const time = String(timeValue || timeInputValue(fallback) || "09:00").trim();
  const parsed = new Date(`${date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? fallbackDate : parsed;
}

function isOrderDateOutdated(order: CustomerOrder) {
  const anchor = order.freeDate ? order.freeDateUntil || order.loadFrom : order.loadFrom;
  if (!anchor) return false;
  const date = new Date(anchor);
  return Number.isFinite(date.getTime()) && date.getTime() < Date.now();
}

function orderDateUpdateHint(order: CustomerOrder, openedFromReminder: boolean) {
  if (isOrderDateOutdated(order)) {
    return order.freeDate
      ? "Термін актуальності вільної дати минув. Оновіть його, щоб водії знову бачили замовлення вище у списку."
      : "Дата завантаження вже минула. Замовлення опускається нижче у списку пошуку, доки ви не оновите дату.";
  }
  if (openedFromReminder) {
    return order.freeDate
      ? "Перевірте, чи вільна дата ще актуальна. Якщо потрібно, оновіть її, щоб замовлення залишалось помітним для водіїв."
      : "Перевірте, чи дата завантаження ще актуальна. Якщо потрібно, оновіть її, щоб замовлення залишалось вище у списку.";
  }
  return "";
}

function customerRoute(order: CustomerOrder) {
  const from = order.pickupCity || order.pickupLocation || "Звідки";
  const to = order.dropoffCity || order.dropoffLocation || "Куди";
  return `${from} → ${to}`;
}

function customerOrderDetail(order: CustomerOrder) {
  return [order.pickupAddress, order.dropoffAddress].filter(Boolean).join(" → ") || order.cargoType || "Деталі маршруту не вказані";
}

function customerOrderUpdate(order: CustomerOrder) {
  if (order.status === "IN_PROGRESS") return "Прибуде до 30 хв";
  if (order.status === "ACCEPTED" || order.status === "PENDING") return "Прибуде до 45 хв";
  if (order.status === "DELIVERED") return "Доставлено сьогодні";
  if (order.status === "CREATED") return order.responseCount ? `${order.responseCount} пропозицій` : "Очікуємо пропозиції";
  return customerDate(order.updatedAt || order.createdAt);
}

function orderTab(status?: string) {
  if (["COMPLETED", "CANCELLED", "REJECTED"].includes(status || "")) return "Історія";
  if (["ACCEPTED", "IN_PROGRESS", "PENDING", "DELIVERED"].includes(status || "")) return "В роботі";
  return "Створено";
}

type OrdersViewMode = "list" | "kanban";

function orderColumnKey(order: CustomerOrder) {
  if (order.status === "DELIVERED") return "delivered";
  if (order.status === "IN_PROGRESS") return "received";
  if (["ACCEPTED", "PENDING"].includes(order.status || "")) return "road";
  if (order.status === "CREATED") return "created";
  return "history";
}

function orderColumnMeta(key: string) {
  const meta: Record<string, { title: string; icon: string; tone: string }> = {
    road: { title: "Водій в дорозі", icon: "route", tone: "blue" },
    received: { title: "Водій отримав вантаж", icon: "cube", tone: "orange" },
    delivered: { title: "Замовлення доставлено", icon: "check", tone: "green" },
    created: { title: "Створено", icon: "case", tone: "green" },
    history: { title: "Історія", icon: "check", tone: "green" },
  };
  return meta[key] || meta.road;
}

function orderColumnsForTab(tab: string, orders: CustomerOrder[]) {
  const keys = tab === "В роботі" ? ["road", "received", "delivered"] : tab === "Створено" ? ["created"] : ["history"];
  return keys.map((key) => ({ key, ...orderColumnMeta(key), orders: orders.filter((order) => orderColumnKey(order) === key) }));
}

function OrderViewSwitch({ value, onChange }: { value: OrdersViewMode; onChange: (value: OrdersViewMode) => void }) {
  return <div className="customer-view-switch" role="group" aria-label="Вигляд замовлень">
    <button type="button" className={value === "list" ? "selected" : ""} onClick={() => onChange("list")}><VIcon name="list" size={17}/>Список</button>
    <button type="button" className={value === "kanban" ? "selected" : ""} onClick={() => onChange("kanban")}><VIcon name="kanban" size={17}/>Канбан</button>
  </div>;
}

function CustomerOrderRow({ order }: { order: CustomerOrder }) {
  const driver = order.driver || order.candidateDriver || order.reservedDriver || null;
  return <a className="created-order-row" href={`/customer/orders/${order.id}`}><div><span className={`big-status ${orderTab(order.status) === "В роботі" ? "blue" : "green"}`}>{customerOrderBadgeLabel(order)}</span><h3>Замовлення № {order.orderNumber || order.id}</h3><p>{customerRoute(order)}</p></div><div><span>Водій</span><strong>{driver ? customerDisplayName(driver) : "Ще не призначено"}</strong></div><div><span>Оновлення</span><strong>{customerOrderUpdate(order)}</strong></div><div><span>Сума</span><strong>{customerMoney(order.finalPrice ?? order.price)}</strong></div><VIcon name="chevron"/></a>;
}

function CustomerKanbanCard({ order }: { order: CustomerOrder }) {
  const driver = order.driver || order.candidateDriver || order.reservedDriver || null;
  return <a className="customer-kanban-card" href={`/customer/orders/${order.id}`}>
    <div className="kanban-card-head"><span>№ {order.orderNumber || order.id}</span><strong>{customerMoney(order.finalPrice ?? order.price)}</strong></div>
    <h3>{customerRoute(order)}</h3>
    <div className="kanban-route-points"><p><i className="from"/><span>Завантаження</span><strong>{order.pickupAddress || order.pickupLocation || "-"}</strong></p><p><i className="to"/><span>Розвантаження</span><strong>{order.dropoffAddress || order.dropoffLocation || "-"}</strong></p></div>
    <div className="kanban-driver"><span className="mini-avatar green">{customerInitials(driver)}</span><p><small>Водій</small><strong>{driver ? customerDisplayName(driver) : "Ще не призначено"}</strong></p></div>
    <div className="kanban-card-action"><span>{customerOrderUpdate(order)}</span><VIcon name="chevron" size={18}/></div>
  </a>;
}

function CustomerOrdersKanban({ tab, orders }: { tab: string; orders: CustomerOrder[] }) {
  const columns = orderColumnsForTab(tab, orders);
  return <div className="customer-kanban-board">{columns.map((column) => <section className={`customer-kanban-column ${column.tone}`} key={column.key}><div className="kanban-column-head"><span><VIcon name={column.icon} size={21}/></span><div><h3>{column.title}</h3><p>{column.orders.length} замовлення</p></div><b>{column.orders.length}</b></div><div className="kanban-column-list">{column.orders.length ? column.orders.map((order) => <CustomerKanbanCard order={order} key={order.id}/>) : <p className="kanban-empty">Немає замовлень</p>}</div></section>)}</div>;
}

type CustomerTheme = "light" | "dark";

function readCustomerTheme(): CustomerTheme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyCustomerTheme(theme: CustomerTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("customer-dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<CustomerTheme>("light");
  const isDark = theme === "dark";

  useEffect(() => {
    const initialTheme = readCustomerTheme();
    setTheme(initialTheme);
    applyCustomerTheme(initialTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = isDark ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem(THEME_KEY, nextTheme);
    applyCustomerTheme(nextTheme);
  }

  const label = isDark ? "Світла тема" : "Темна тема";
  return <button type="button" className="customer-theme-toggle" onClick={toggleTheme} aria-label={label} title={label} aria-pressed={isDark}><VIcon name={isDark ? "sun" : "moon"}/></button>;
}

function LiveHeader({ title, profile }: { title: string; profile: UserProfile | null }) {
  return <header className="customer-topbar"><div><small>Кабінет замовника</small><h1>{title}</h1></div><div className="customer-tools"><ThemeToggle/><a href="/customer/support" aria-label="Підтримка"><VIcon name="headset"/></a><NotificationBell href="/customer/notifications"/><a className="customer-profile-link" href="/customer/settings" aria-label="Відкрити налаштування профілю"><CustomerAvatar profile={profile} className="mini-avatar"/></a></div></header>;
}

function LiveCustomerShell({ view, title, profile, children }: { view: CustomerView; title: string; profile: UserProfile | null; children: ReactNode }) {
  return <main className="customer-shell"><aside className="customer-sidebar"><a className="customer-brand" href="/customer/orders"><span className="customer-brand-logo"><img src="/logo.png" alt="" /></span><strong>VanGo</strong></a><CustomerNav view={view}/><div className="customer-sidebar-foot"><a className="customer-sidebar-profile" href="/customer/settings" aria-label="Відкрити налаштування профілю"><CustomerAvatar profile={profile} className="mini-avatar"/><p><strong>{customerDisplayName(profile)}</strong><small>{customerRoleLabel(profile?.role)}</small></p></a></div></aside><section className="customer-workspace"><LiveHeader title={title} profile={profile}/><div className={`customer-content ${view==="profile"?"profile-content":""}`}>{children}</div><div className="customer-mobile-nav"><CustomerNav view={view}/></div></section></main>;
}

function LiveOrdersView({ orders }: { orders: CustomerOrder[] }) {
  const [tab, setTab] = useState("В роботі");
  const [viewMode, setViewMode] = useState<OrdersViewMode>("list");
  const visibleOrders = orders.filter((order) => orderTab(order.status) === tab);
  const showViewSwitch = tab === "В роботі";
  const activeViewMode = showViewSwitch ? viewMode : "list";
  const counts = {
    "В роботі": orders.filter((order) => orderTab(order.status) === "В роботі").length,
    "Створено": orders.filter((order) => orderTab(order.status) === "Створено").length,
    "Історія": orders.filter((order) => orderTab(order.status) === "Історія").length,
  };

  return <><div className="customer-page-intro"><div><h2>Мої замовлення</h2></div><a className="customer-primary" href="/customer/create"><VIcon name="plus" size={19}/>Створити замовлення</a></div><section className="customer-card orders-empty-card"><div className="customer-tabs">{Object.entries(counts).map(([name, count]) => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name}<span>{count}</span></button>)}</div>{showViewSwitch && <div className="orders-panel-head"><div><h3>Активні перевезення</h3><p>{visibleOrders.length} замовлень у вибраній вкладці</p></div><OrderViewSwitch value={viewMode} onChange={setViewMode}/></div>}{visibleOrders.length ? activeViewMode === "list" ? <div className="customer-orders-list">{visibleOrders.map((order) => <CustomerOrderRow order={order} key={order.id}/>)}</div> : <CustomerOrdersKanban tab={tab} orders={visibleOrders}/> : <div className="customer-empty compact"><span className="empty-illustration"><VIcon name="case" size={32}/></span><h3>Тут поки немає замовлень</h3><p>У цьому розділі немає записів для вашого акаунта.</p></div>}</section></>;
}

function LiveReportsView({ orders }: { orders: CustomerOrder[] }) {
  const completed = orders.filter((order) => ["COMPLETED", "DELIVERED"].includes(order.status || ""));
  const active = orders.filter((order) => orderTab(order.status) === "В роботі").length;
  const totalSpend = completed.reduce((sum, order) => sum + (Number(order.finalPrice ?? order.price) || 0), 0);
  const totalDistance = orders.reduce((sum, order) => sum + (Number(order.distance) || 0), 0);

  return <div className="reports-page"><div className="customer-page-intro"><div><h2>Звіти</h2></div></div><div className="report-kpis"><article className="customer-card report-kpi green"><div><span>Всього замовлень</span><strong>{orders.length}</strong><p>{active} зараз у роботі</p></div><i><VIcon name="case"/></i></article><article className="customer-card report-kpi blue"><div><span>Виконано</span><strong>{completed.length}</strong><p>доставлені або завершені</p></div><i><VIcon name="check"/></i></article><article className="customer-card report-kpi orange"><div><span>Сума</span><strong>{customerMoney(totalSpend)}</strong><p>{totalDistance ? `${totalDistance.toLocaleString("uk-UA")} км` : "дистанція не вказана"}</p></div><i><VIcon name="chart"/></i></article></div><section className="customer-card report-table-card"><div className="report-section-head"><div><h3>Замовлення</h3><p>Останні записи поточного користувача</p></div><span>{orders.length} записів</span></div><div className="report-table-scroll"><table className="report-table orders-report"><thead><tr><th>№</th><th>Маршрут</th><th>Водій</th><th>Дата</th><th>Статус</th><th>Сума</th></tr></thead><tbody>{orders.length ? orders.map((order) => {
    const driver = order.driver || order.candidateDriver || order.reservedDriver || null;
    return <tr key={order.id}><td><strong>{order.orderNumber || order.id}</strong></td><td>{customerRoute(order)}</td><td>{driver ? customerDisplayName(driver) : "Ще не призначено"}</td><td>{customerDate(order.createdAt || order.updatedAt)}</td><td><span className="status-dot">{customerStatusLabel(order.status)}</span></td><td className="positive-value">{customerMoney(order.finalPrice ?? order.price)}</td></tr>;
  }) : <tr><td colSpan={6} className="portal-empty-cell">Для цього акаунта ще немає замовлень.</td></tr>}</tbody></table></div></section></div>;
}

function compactOrderAddress(value?: string, fallback?: string, city?: string) {
  const raw = (value || fallback || "").trim();
  const explicitCity = city?.trim();
  if (!raw) return "-";

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

function orderAddress(value?: string, fallback?: string, city?: string) {
  return compactOrderAddress(value, fallback, city);
}

function orderDimensions(order: CustomerOrder) {
  const parts = [order.cargoLength, order.cargoWidth, order.cargoHeight].filter((value) => Number(value) > 0);
  const dimensions = parts.length ? `${parts.map((value) => Number(value).toLocaleString("uk-UA")).join(" × ")} м` : "-";
  return order.cargoVolume ? `${dimensions} · ${Number(order.cargoVolume).toLocaleString("uk-UA")} м³` : dimensions;
}

function orderSchedule(order: CustomerOrder) {
  if (order.timingOption === "ASAP") return "Якнайшвидше";
  if (order.timingOption === "WITHIN_1_HOUR") return "До 1 години";
  return customerDateTime(order.loadFrom);
}

function toPhotoArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (!value) return [];
  const text = String(value).trim();
  if (!text) return [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item || "").trim()).filter(Boolean);
    } catch {}
  }
  return [text];
}

function uniqPhotos(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function normalizePhotoUrl(photo: string) {
  if (!photo) return "";
  if (/^https?:\/\//i.test(photo) || photo.startsWith("blob:") || photo.startsWith("data:")) return photo;
  if (photo.startsWith("/uploads/")) return photo;
  if (photo.includes("\\uploads\\")) return `/uploads/${photo.split("\\uploads\\").pop()}`;
  if (photo.includes("/uploads/")) return `/uploads/${photo.split("/uploads/").pop()}`;
  return photo.startsWith("/") ? photo : `/uploads/${photo}`;
}

function historyPhotosByStatus(order: CustomerOrder, status: string) {
  const photos: string[] = [];
  (order.history || []).forEach((entry) => {
    if (entry?.status !== status) return;
    photos.push(...toPhotoArray(entry.photos), ...toPhotoArray(entry.photo));
  });
  return uniqPhotos(photos);
}

function orderPhotoSections(order: CustomerOrder) {
  const received = historyPhotosByStatus(order, "IN_PROGRESS");
  const delivered = historyPhotosByStatus(order, "DELIVERED");
  const statusPhotos = new Set([...received, ...delivered]);
  const created = toPhotoArray(order.photos).filter((photo) => !statusPhotos.has(photo));
  return [
    { title: "Фото замовлення", photos: created },
    { title: "Фото отримання", photos: received },
    { title: "Фото доставки", photos: delivered },
  ].filter((section) => section.photos.length > 0);
}

type CustomerTimelineEntry = NonNullable<CustomerOrder["history"]>[number];

function customerTimelineEntries(order: CustomerOrder, fallbackAt?: string): CustomerTimelineEntry[] {
  const fallbackStatus = order.status === "COMPLETED" ? "DELIVERED" : order.status || "CREATED";
  const source = order.history?.length ? order.history : [{ status: fallbackStatus, at: fallbackAt }];
  const visible = source.filter((entry) => entry?.status !== "COMPLETED");
  return visible.length ? visible : [{ status: fallbackStatus, at: fallbackAt }];
}

function customerTimelineClass(order: CustomerOrder, index: number, total: number) {
  return order.status === "COMPLETED" || index < total - 1 ? "done" : "current";
}

const ACTIVE_RESPONSE_STATUSES = new Set(["RESPONDED", "CALL_MADE", "PENDING_CONFIRM", "DISCUSSING", "COUNTER_OFFERED"]);

function arrivalEtaLabel(value?: string | null) {
  const labels: Record<string, string> = {
    UP_TO_15_MIN: "до 15 хв",
    UP_TO_30_MIN: "до 30 хв",
    UP_TO_1_HOUR: "до 1 год",
    SEVERAL_HOURS: "кілька годин",
    AT_APPOINTED_TIME: "на вказаний час",
  };
  return value ? labels[value] || value : "-";
}

function responsePrice(order: CustomerOrder, response: CustomerOrderResponse) {
  if (!(order.requestedOrderType === "LOCAL" || order.isIntraCity) && response.status === "COUNTER_OFFERED" && response.customerCounterPrice) {
    return customerMoney(response.customerCounterPrice);
  }
  const value = order.requestedOrderType === "LOCAL" || order.isIntraCity || response.hourlyRate
    ? response.offerTotal
    : response.finalPriceOffer;
  return value ? customerMoney(value) : "Договірна";
}

function responseDriverName(response: CustomerOrderResponse) {
  return response.driverName || customerDisplayName(response.driver);
}

function responseStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    RESPONDED: "Пропозиція",
    CALL_MADE: "Дзвінок зроблено",
    PENDING_CONFIRM: "Готовий виконати",
    DISCUSSING: "Обговорення ціни",
    COUNTER_OFFERED: "Очікує рішення водія",
  };
  return status ? labels[status] || status : "Пропозиція";
}

function DriverOffers({
  order,
  responses,
  onOrderUpdated,
  onResponsesUpdated,
}: {
  order: CustomerOrder;
  responses: CustomerOrderResponse[];
  onOrderUpdated: (order: CustomerOrder) => void;
  onResponsesUpdated: (responses: CustomerOrderResponse[]) => void;
}) {
  const [busyAction, setBusyAction] = useState("");
  const [counteringId, setCounteringId] = useState<number | null>(null);
  const [counterValue, setCounterValue] = useState("");
  const [error, setError] = useState("");
  const isLocalOrder = order.requestedOrderType === "LOCAL" || order.isIntraCity;
  const activeResponses = responses.filter((response) => ACTIVE_RESPONSE_STATUSES.has(response.status || ""));

  if ((order.driver || order.driverId || order.status !== "CREATED") || activeResponses.length === 0) return null;

  async function confirm(response: CustomerOrderResponse) {
    const token = getStoredUserToken();
    if (!token) return;
    setBusyAction(`confirm-${response.id}`);
    setError("");
    try {
      const updated = await customerApiFetch<CustomerOrder>(`/orders/${order.id}/respond/${response.id}/confirm`, token, {
        method: "POST",
      });
      onOrderUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося обрати водія");
    } finally {
      setBusyAction("");
    }
  }

  function startCounter(response: CustomerOrderResponse) {
    const base = Number(response.customerCounterPrice || response.finalPriceOffer || order.finalPrice || order.price);
    setCounteringId(response.id);
    setCounterValue(Number.isFinite(base) && base > 0 ? String(Math.round(base)) : "");
    setError("");
  }

  async function submitCounter(event: FormEvent<HTMLFormElement>, response: CustomerOrderResponse) {
    event.preventDefault();
    const token = getStoredUserToken();
    const value = Number(counterValue);
    if (!token || !Number.isFinite(value) || value <= 0) {
      setError("Вкажіть коректну фінальну ціну");
      return;
    }
    setBusyAction(`counter-${response.id}`);
    setError("");
    try {
      const updated = await customerApiFetch<CustomerOrderResponse>(`/orders/${order.id}/respond/${response.id}/counter`, token, {
        method: "POST",
        body: JSON.stringify({ finalPrice: Math.round(value) }),
      });
      onResponsesUpdated(responses.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
      setCounteringId(null);
      setCounterValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося надіслати контрпропозицію");
    } finally {
      setBusyAction("");
    }
  }

  async function reject(response: CustomerOrderResponse) {
    const token = getStoredUserToken();
    if (!token) return;
    setBusyAction(`reject-${response.id}`);
    setError("");
    try {
      await customerApiFetch<{ message?: string }>(`/orders/${order.id}/respond/${response.id}/reject`, token, { method: "POST" });
      onResponsesUpdated(responses.map((item) => item.id === response.id ? { ...item, status: "REJECTED" } : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося відхилити пропозицію");
    } finally {
      setBusyAction("");
    }
  }

  return <section className="customer-card driver-offers-live">
    <div className="offer-section-head">
      <div>
        <h3>Пропозиції водіїв</h3>
        <p>Оберіть водія, щоб підтвердити перевезення</p>
      </div>
      <span>{activeResponses.length}</span>
    </div>
    <div className="driver-offers-list">
      {activeResponses.map((response) => {
        const driver = response.driver || null;
        const rating = response.driverRating ?? driver?.driverRating;
        const completed = response.driverCompletedOrders ?? driver?.driverCompletedOrders ?? driver?.completedOrders ?? 0;
        const canCounter = !isLocalOrder && ["RESPONDED", "CALL_MADE", "PENDING_CONFIRM", "DISCUSSING"].includes(response.status || "");
        const waitingForDriver = !isLocalOrder && response.status === "COUNTER_OFFERED";
        return <article className="driver-offer-card" key={response.id}>
          <div className="offer-title">
            <span className="mini-avatar green">{customerInitials(driver || { name: responseDriverName(response) })}</span>
            <div>
              <strong>{responseDriverName(response)}</strong>
              <small>★ {Number(rating ?? 5).toFixed(1)} · ✓ {completed} виконаних</small>
            </div>
            <span>{responseStatusLabel(response.status)}</span>
          </div>
          <div className="offer-values">
            {response.hourlyRate ? <p><span>Ставка</span><strong>{customerMoney(response.hourlyRate)}/год</strong></p> : null}
            {response.minHours ? <p><span>Мінімум</span><strong>{Number(response.minHours).toLocaleString("uk-UA")} год</strong></p> : null}
            <p><span>Разом</span><strong>{responsePrice(order, response)}</strong></p>
            <p><span>Прибуде</span><strong>{arrivalEtaLabel(response.arrivalEta)}</strong></p>
          </div>
          {waitingForDriver && <div className="counter-note"><VIcon name="money" size={18}/><span>Ви запропонували іншу ціну. Очікуємо рішення водія.</span></div>}
          {counteringId === response.id && <form className="counter-offer-form" onSubmit={(event) => submitCounter(event, response)}>
            <label>Ваша фінальна ціна, грн<input type="number" min="100" step="100" value={counterValue} onChange={(event) => setCounterValue(event.target.value)} autoFocus/></label>
            <div><button type="button" onClick={() => setCounteringId(null)}>Скасувати</button><button className="customer-primary" disabled={busyAction === `counter-${response.id}`}>{busyAction === `counter-${response.id}` ? "Надсилаємо..." : "Надіслати"}</button></div>
          </form>}
          <div className="offer-actions live-offer-actions">
            <button className="customer-primary choose-driver-button" type="button" onClick={() => confirm(response)} disabled={Boolean(busyAction) || waitingForDriver}>
              {busyAction === `confirm-${response.id}` ? "Підтверджуємо..." : "Обрати водія"}
            </button>
            {canCounter && <button className="offer-counter-button" type="button" onClick={() => startCounter(response)} disabled={Boolean(busyAction)}>Інша ціна</button>}
            <button className="offer-reject-button" type="button" onClick={() => reject(response)} disabled={Boolean(busyAction)}>
              {busyAction === `reject-${response.id}` ? "Відхиляємо..." : "Відхилити"}
            </button>
          </div>
        </article>;
      })}
    </div>
    {error && <p className="customer-form-error">{error}</p>}
  </section>;
}

function CustomerRatingCard({ order, driver }: { order: CustomerOrder; driver?: UserProfile | null }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const targetId = driver?.id || order.driverId;
  const canRate = Boolean(targetId && ["DELIVERED", "COMPLETED"].includes(order.status || ""));

  if (!canRate) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rating) {
      setError("Оберіть оцінку від 1 до 5");
      return;
    }

    const token = getStoredUserToken();
    if (!token) {
      window.location.href = "/";
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const saved = await customerApiFetch<RatingResult>("/ratings", token, {
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
    <div className="rating-card-head"><span>★</span><div><h3>Оцінити водія</h3><p>{driver ? customerDisplayName(driver) : "Водій"} · замовлення № {order.orderNumber || order.id}</p></div></div>
    <form onSubmit={submit}>
      <div className="rating-stars" role="radiogroup" aria-label="Оцінка водія">
        {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" className={value <= rating ? "active" : ""} aria-checked={rating === value} role="radio" onClick={() => { setRating(value); setError(""); }}>★</button>)}
      </div>
      <label>Коментар<textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="За бажанням" maxLength={1000}/></label>
      {error && <p className="customer-form-error">{error}</p>}
      {message && <p className="rating-success">{message}</p>}
      <button className="customer-primary" type="submit" disabled={submitting || !rating}>{submitting ? "Зберігаємо..." : message ? "Оновити оцінку" : "Надіслати оцінку"}</button>
    </form>
  </section>;
}

function OrderEditForm({ order, onSaved, onCancel }: { order: CustomerOrder; onSaved: (order: CustomerOrder) => void; onCancel: () => void }) {
  const isLocalOrder = order.requestedOrderType === "LOCAL" || order.isIntraCity;
  const initialPickupPoint: Partial<GooglePoint> = { label: order.pickupLocation || order.pickupAddress || "", city: order.pickupCity || "", address: order.pickupAddress || order.pickupLocation || "", lat: order.pickupLat, lon: order.pickupLon };
  const initialDropoffPoint: Partial<GooglePoint> = { label: order.dropoffLocation || order.dropoffAddress || "", city: order.dropoffCity || "", address: order.dropoffAddress || order.dropoffLocation || "", lat: order.dropoffLat, lon: order.dropoffLon };
  const [pickupPoint, setPickupPoint] = useState<GooglePoint | null>(typeof order.pickupLat === "number" && typeof order.pickupLon === "number" ? initialPickupPoint as GooglePoint : null);
  const [dropoffPoint, setDropoffPoint] = useState<GooglePoint | null>(typeof order.dropoffLat === "number" && typeof order.dropoffLon === "number" ? initialDropoffPoint as GooglePoint : null);
  const [distanceValue, setDistanceValue] = useState(order.distance ? Number(order.distance).toLocaleString("uk-UA", { maximumFractionDigits: 2 }) : "");
  const [freeDate, setFreeDate] = useState(Boolean(order.freeDate));
  const [payment, setPayment] = useState<"cash" | "card">(order.payment || "cash");
  const [agreedPrice, setAgreedPrice] = useState(!isLocalOrder && Boolean(order.agreedPrice));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!pickupPoint || !dropoffPoint) return;
    const km = fallbackDistanceKm(pickupPoint, dropoffPoint);
    setDistanceValue(formatRouteDistance(km));
  }, [pickupPoint, dropoffPoint]);

  function normalizedNumber(value: FormDataEntryValue | null) {
    return String(value || "").trim().replace(/\s+/g, "").replace(",", ".");
  }

  function appendText(fd: FormData, name: string, value: FormDataEntryValue | null) {
    const text = String(value || "").trim();
    if (text) fd.append(name, text);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getStoredUserToken();
    if (!token) {
      window.location.href = "/";
      return;
    }

    const raw = new FormData(event.currentTarget);
    const pickupLocation = String(raw.get("pickupLocation") || "").trim();
    const dropoffLocation = String(raw.get("dropoffLocation") || "").trim();
    const cargoType = String(raw.get("cargoType") || "").trim();
    if (!pickupLocation || !dropoffLocation) {
      setError("Вкажіть адреси завантаження та розвантаження");
      return;
    }
    if (!cargoType) {
      setError("Вкажіть опис вантажу");
      return;
    }

    const loadFrom = dateTimeFromInputs(raw.get("loadDate"), raw.get("loadTimeFrom"), order.loadFrom);
    const loadTo = new Date(loadFrom.getTime() + 60 * 60 * 1000);
    const unloadFrom = dateTimeFromInputs(raw.get("unloadDate"), raw.get("unloadTimeFrom"), order.unloadFrom || order.unloadTo || order.loadTo);
    const unloadTo = new Date(unloadFrom.getTime() + 60 * 60 * 1000);

    const fd = new FormData();
    ["pickupLocation", "dropoffLocation", "pickupCity", "pickupAddress", "pickupLat", "pickupLon", "dropoffCity", "dropoffAddress", "dropoffLat", "dropoffLon", "cargoType"].forEach((name) => appendText(fd, name, raw.get(name)));
    ["cargoLength", "cargoWidth", "cargoHeight", "cargoWeight", "distance"].forEach((name) => {
      const value = normalizedNumber(raw.get(name));
      if (value) fd.append(name, value);
    });

    const length = Number(normalizedNumber(raw.get("cargoLength")));
    const width = Number(normalizedNumber(raw.get("cargoWidth")));
    const height = Number(normalizedNumber(raw.get("cargoHeight")));
    if (length > 0 && width > 0 && height > 0) {
      fd.append("cargoVolume", (length * width * height).toFixed(2));
    }

    fd.append("requestedOrderType", order.requestedOrderType || (isLocalOrder ? "LOCAL" : "LONG_DISTANCE"));
    fd.append("timingOption", isLocalOrder ? "SCHEDULED" : "");
    fd.append("freeDate", freeDate ? "true" : "false");
    fd.append("loadFrom", loadFrom.toISOString());
    fd.append("loadTo", loadTo.toISOString());
    fd.append("unloadFrom", unloadFrom.toISOString());
    fd.append("unloadTo", unloadTo.toISOString());
    fd.append("loadHelp", raw.get("loadHelp") ? "true" : "false");
    fd.append("unloadHelp", raw.get("unloadHelp") ? "true" : "false");
    fd.append("payment", payment);
    fd.append("insurance", "false");
    fd.append("agreedPrice", !isLocalOrder && agreedPrice ? "true" : "false");
    if (!isLocalOrder && !agreedPrice) appendText(fd, "price", raw.get("price"));

    setSaving(true);
    setError("");
    try {
      const updated = await customerApiFetch<CustomerOrder>(`/orders/${order.id}`, token, { method: "PATCH", body: fd });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося оновити замовлення");
    } finally {
      setSaving(false);
    }
  }

  return <form className="customer-card order-edit-form" onSubmit={submit}>
    <div className="order-edit-head">
      <div>
        <span className="order-edit-kicker">Редагування</span>
        <h3>Оновити замовлення № {order.orderNumber || order.id}</h3>
        <p>Найчастіше після сповіщення достатньо оновити дату завантаження або розвантаження.</p>
      </div>
      <button type="button" onClick={onCancel}>Скасувати</button>
    </div>

    <div className="order-edit-layout">
      <div className="order-edit-stack">
        <section className="order-edit-section primary">
          <div className="order-edit-section-head"><span><VIcon name="calendar"/></span><div><h4>Дата і час</h4><p>Оновіть актуальність замовлення для водіїв</p></div></div>
          <label className="toggle-row order-edit-free-date">
            <span><strong>Вільна дата <span className="free-date-info" tabIndex={0} aria-label="Якщо дата розвантаження вільна, замовлення буде актуальним 7 днів і показуватиметься водіям у вибраному місті завантаження.">i</span></strong><small>Водій погодить день і час із вами</small></span>
            <input type="checkbox" checked={freeDate} onChange={(event) => setFreeDate(event.target.checked)}/>
            <i aria-hidden="true"/>
          </label>
          <div className="order-edit-date-grid">
            <label>Дата завантаження<input name="loadDate" type="date" defaultValue={dateInputValue(order.loadFrom)} disabled={freeDate}/></label>
            <label>Час<input name="loadTimeFrom" type="time" defaultValue={timeInputValue(order.loadFrom)} disabled={freeDate}/></label>
            <label>Дата розвантаження<input name="unloadDate" type="date" defaultValue={dateInputValue(order.unloadFrom || order.unloadTo || order.loadFrom)} disabled={freeDate}/></label>
            <label>Час<input name="unloadTimeFrom" type="time" defaultValue={timeInputValue(order.unloadFrom || order.unloadTo || order.loadFrom)} disabled={freeDate}/></label>
          </div>
        </section>

        <section className="order-edit-section order-edit-cargo-section">
          <div className="order-edit-section-head"><span><VIcon name="cube"/></span><div><h4>Вантаж</h4><p>Опис, габарити та додаткові послуги</p></div></div>
          <label className="order-edit-description">Опис вантажу<textarea name="cargoType" defaultValue={order.cargoType || ""}/></label>
          <div className="order-edit-dimensions">
            <label>Довжина, м<input name="cargoLength" defaultValue={order.cargoLength || ""}/></label>
            <label>Ширина, м<input name="cargoWidth" defaultValue={order.cargoWidth || ""}/></label>
            <label>Висота, м<input name="cargoHeight" defaultValue={order.cargoHeight || ""}/></label>
            <label>Вага, кг<input name="cargoWeight" defaultValue={order.cargoWeight || ""}/></label>
          </div>
          <div className="order-edit-checks">
            <label><input name="loadHelp" type="checkbox" defaultChecked={Boolean(order.loadHelp)}/><span>Допомога із завантаженням</span></label>
            <label><input name="unloadHelp" type="checkbox" defaultChecked={Boolean(order.unloadHelp)}/><span>Допомога з розвантаженням</span></label>
          </div>
        </section>

        <section className="order-edit-section order-edit-payment-section">
          <div className="order-edit-section-head"><span><VIcon name="case"/></span><div><h4>Оплата</h4><p>Ціна і спосіб оплати</p></div></div>
          {isLocalOrder ? <p className="order-edit-price-note">Для тарифу «місцеве перевезення» ціну вказує водій у своїй пропозиції.</p> : <div className="order-edit-two">
            <label>Ціна, грн<input name="price" defaultValue={order.price || order.finalPrice || ""} disabled={agreedPrice}/></label>
          </div>}
          <div className="order-edit-options">
            {!isLocalOrder && <label><input type="checkbox" checked={agreedPrice} onChange={(event) => setAgreedPrice(event.target.checked)}/><span>Договірна ціна</span></label>}
            <div className="payment-switch" role="group" aria-label="Спосіб оплати"><button type="button" className={payment === "cash" ? "active" : ""} onClick={() => setPayment("cash")}>Готівка</button><button type="button" className={payment === "card" ? "active" : ""} onClick={() => setPayment("card")}>Карта</button></div>
          </div>
        </section>
      </div>

      <section className="order-edit-section">
        <div className="order-edit-section-head"><span><VIcon name="route"/></span><div><h4>Маршрут</h4><p>Адреси, які бачить водій</p></div></div>
        <div className="order-edit-route-grid">
          <div className="order-edit-map-grid">
            <GooglePlacePicker name="pickup" label="Звідки" tone="green" initialPoint={initialPickupPoint} onPointChange={setPickupPoint}/>
            <GooglePlacePicker name="dropoff" label="Куди" tone="orange" initialPoint={initialDropoffPoint} onPointChange={setDropoffPoint}/>
          </div>
          <label className="wide">Відстань, км<input name="distance" value={distanceValue} onChange={(event) => setDistanceValue(event.target.value)}/></label>
        </div>
      </section>

    </div>

    {error && <p className="customer-form-error">{error}</p>}
    <div className="order-edit-footer">
      <button type="button" className="order-edit-cancel" onClick={onCancel}>Скасувати</button>
      <button className="customer-primary order-edit-save" type="submit" disabled={saving}>{saving ? "Зберігаємо..." : "Зберегти зміни"}</button>
    </div>
  </form>;
}

function LiveOrderDetailView({ order, responses, notification, onOrderUpdated, onResponsesUpdated }: { order: CustomerOrder; responses: CustomerOrderResponse[]; notification?: PortalNotification | null; onOrderUpdated: (order: CustomerOrder) => void; onResponsesUpdated: (responses: CustomerOrderResponse[]) => void }) {
  const [editing, setEditing] = useState(false);
  const [dateHintDismissed, setDateHintDismissed] = useState(false);
  const [completingDelivery, setCompletingDelivery] = useState(false);
  const [confirmDeliveryOpen, setConfirmDeliveryOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const driver = order.driver || order.candidateDriver || order.reservedDriver || null;
  const priceText = order.agreedPrice ? "Договірна" : customerMoney(order.finalPrice ?? order.price);
  const createdAt = order.createdAt || order.updatedAt;
  const timelineEntries = customerTimelineEntries(order, createdAt);
  const photoSections = orderPhotoSections(order);
  const canEdit = order.status === "CREATED" && !order.driverId;
  const canConfirmDelivery = order.status === "DELIVERED";
  const openedFromReminder = Boolean(notification?.data?.reminderStep);
  useEffect(() => {
    setDateHintDismissed(false);
  }, [order.id, notification?.id]);

  const dateUpdateHintText = canEdit && !dateHintDismissed ? orderDateUpdateHint(order, openedFromReminder) : "";
  const notificationText = notification?.body || notification?.data?.reason || dateUpdateHintText;

  function handleSaved(updated: CustomerOrder) {
    onOrderUpdated(updated);
    setEditing(false);
    setDateHintDismissed(true);
  }

  async function confirmDelivery() {
    const token = getStoredUserToken();
    if (!token) {
      window.location.href = "/";
      return;
    }

    setCompletingDelivery(true);
    setActionError("");
    try {
      const updated = await customerApiFetch<CustomerOrder>(`/orders/${order.id}/status`, token, {
        method: "PATCH",
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      onOrderUpdated(updated);
      setConfirmDeliveryOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не вдалося підтвердити доставку");
      setConfirmDeliveryOpen(false);
    } finally {
      setCompletingDelivery(false);
    }
  }

  return <>
    <a className="back-link" href="/customer/orders"><VIcon name="arrow"/>До замовлень</a>
    <div className="order-detail-head">
      <div>
        <small>Замовлення № {order.orderNumber || order.id} · створено {customerDateTime(createdAt)}</small>
        <h2>{customerRoute(order)}</h2>
      </div>
      <div className="order-detail-actions">
        <span className={`big-status ${orderTab(order.status) === "В роботі" ? "blue" : "green"}`}>{customerStatusLabel(order.status)}</span>
        {canEdit && <button className="order-edit-open" type="button" onClick={() => setEditing(true)}><VIcon name="edit" size={18}/>Редагувати</button>}
        {canConfirmDelivery && <button className="customer-primary order-confirm-delivery" type="button" onClick={() => { setActionError(""); setConfirmDeliveryOpen(true); }} disabled={completingDelivery}><VIcon name="check" size={18}/>{completingDelivery ? "Підтверджуємо..." : "Підтвердити доставку"}</button>}
      </div>
    </div>

    {confirmDeliveryOpen && <CustomerSystemConfirm title="Підтвердити доставку?" message="Після підтвердження замовлення перейде в історію, а виконання буде завершено." confirmLabel="Підтвердити" loading={completingDelivery} onConfirm={confirmDelivery} onCancel={() => setConfirmDeliveryOpen(false)}/>}

    {actionError && <div className="customer-card customer-live-state error">{actionError}</div>}

    {dateUpdateHintText && <section className="customer-card order-alert-card">
      <span><VIcon name="calendar" size={24}/></span>
      <div>
        <h3>Оновіть дату замовлення</h3>
        <p>{notificationText}</p>
      </div>
      <button type="button" onClick={() => setEditing(true)}><VIcon name="edit" size={18}/>Оновити дату</button>
    </section>}

    {editing && <OrderEditForm order={order} onSaved={handleSaved} onCancel={() => setEditing(false)}/>}

    <div className="order-detail-grid">
      <div>
        {driver ? <section className="customer-card active-driver">
          <div><span className="mini-avatar green">{customerInitials(driver)}</span><div><small>Водій</small><h3>{customerDisplayName(driver)}</h3><p>{driver.phone || driver.email || "Контакти водія не вказані"}</p></div></div>
          {driver.phone && <a href={`tel:${driver.phone}`}><VIcon name="phone"/>Зателефонувати</a>}
        </section> : <section className="customer-card active-driver">
          <div><span className="mini-avatar green">VG</span><div><small>Водій</small><h3>Ще не призначено</h3><p>{order.responseCount ? `${order.responseCount} пропозицій від водіїв` : "Очікуємо пропозиції від водіїв"}</p></div></div>
        </section>}
        {(driver || order.driverId) && <CustomerRatingCard order={order} driver={driver}/>}
        <DriverOffers order={order} responses={responses} onOrderUpdated={onOrderUpdated} onResponsesUpdated={onResponsesUpdated}/>
        <section className="customer-card order-facts-card">
          <h3>Маршрут і деталі</h3>
          <div className="fact-route">
            <i className="from"/><div><span>Звідки</span><strong>{orderAddress(order.pickupAddress, order.pickupLocation, order.pickupCity)}</strong></div>
            <i className="to"/><div><span>Куди</span><strong>{orderAddress(order.dropoffAddress, order.dropoffLocation, order.dropoffCity)}</strong></div>
          </div>
          <div className="facts-visual-grid">
            <FactVisual icon="calendar" label="Дата завантаження" value={customerDateTime(order.loadFrom)} tone="blue"/>
            <FactVisual icon="clock" label="Дата розвантаження" value={customerDateTime(order.unloadFrom || order.unloadTo)} tone="green"/>
            <FactVisual icon="route" label="Відстань" value={order.distance ? `≈ ${Number(order.distance).toLocaleString("uk-UA")} км` : "-"} tone="blue"/>
            <FactVisual icon="cube" label="Габарити" value={orderDimensions(order)} tone="violet"/>
            <FactVisual icon="case" label="Вага" value={order.cargoWeight ? `${Number(order.cargoWeight).toLocaleString("uk-UA")} кг` : "-"} tone="orange"/>
            <FactVisual icon="car" label="Подача авто" value={orderSchedule(order)} tone="green"/>
            <FactVisual icon="card" label="Оплата" value={order.payment === "card" ? "Карта" : "Готівка"} tone="teal"/>
            <FactVisual icon="money" label="Ціна" value={priceText} tone="teal"/>
            <FactVisual icon="edit" label="Опис" value={order.cargoType || "-"} tone="slate" wide/>
          </div>
          {photoSections.map((section) => <div className="order-photo-section" key={section.title}><h4>{section.title}</h4><div className="order-photo-grid">{section.photos.map((photo) => { const url = normalizePhotoUrl(photo); return <a key={photo} href={url} target="_blank" rel="noreferrer"><img src={url} alt={section.title}/></a>; })}</div></div>)}
        </section>
      </div>
      <aside className="customer-card order-side">
        <h3>Стан замовлення</h3>
        <div className="timeline">{timelineEntries.map((entry, index) => <p className={customerTimelineClass(order, index, timelineEntries.length)} key={`${entry.status}-${entry.at}-${index}`}><i/><span><strong>{customerStatusLabel(entry.status)}</strong><small>{customerDateTime(entry.at)}</small></span></p>)}</div>
      </aside>
    </div>
  </>;
}

function LiveCreateView({ view }: { view: "create" | "createLocal" | "createLong" }) {
  if (view === "createLocal") {
    return <><div className="customer-page-intro"><div><h2>Створити місцеве перевезення</h2></div></div><CreateForm longDistance={false}/></>;
  }

  if (view === "createLong") {
    return <><div className="customer-page-intro"><div><h2>Створити далеке перевезення</h2></div></div><CreateForm longDistance/></>;
  }

  return <><div className="create-choice-intro"><span>Нове замовлення</span><h2>Яке перевезення потрібне?</h2></div><div className="transport-types"><a href="/customer/create/local" className="customer-card"><span className="type-icon local"><VIcon name="clock" size={28}/></span><div><h3>Місцеве перевезення</h3><ul><li>Водії запропонують ціну та умови</li><li>Місто та передмістя</li><li>Погодинна оплата</li></ul></div><VIcon name="chevron"/></a><a href="/customer/create/long-distance" className="customer-card"><span className="type-icon long"><VIcon name="trail-sign" size={28}/></span><div><h3>Далеке перевезення</h3><ul><li>Ви пропонуєте ціну або обираєте «Договірна»</li><li>Для маршрутів поза містом</li></ul></div><VIcon name="chevron"/></a></div></>;
}

function LiveSettingsView({ profile, onLogout }: { profile: UserProfile | null; onLogout: () => void }) {
  const [switchingToAdmin, setSwitchingToAdmin] = useState(false);
  const [adminSwitchMessage, setAdminSwitchMessage] = useState("");

  async function switchToAdminPortal() {
    const token = getStoredUserToken();
    if (!token) {
      window.location.href = "/";
      return;
    }

    setSwitchingToAdmin(true);
    setAdminSwitchMessage("");

    try {
      const result = await customerApiFetch<AdminSwitchResult>("/auth/switch-to-admin", token, { method: "POST" });
      window.localStorage.setItem(TOKEN_KEY, result.token);
      window.localStorage.setItem(KIND_KEY, "portal-admin");
      window.location.href = "/";
    } catch (err) {
      setAdminSwitchMessage(err instanceof Error ? err.message : "Не вдалося перейти до порталу адміністраторів");
    } finally {
      setSwitchingToAdmin(false);
    }
  }

  return (
    <>
      <div className="customer-page-intro">
        <div><h2>Налаштування</h2></div>
      </div>
      <div className="settings-grid">
        <section className="customer-card profile-summary">
          <CustomerAvatar profile={profile} className="large-avatar"/>
          <div className="profile-name">
            <h3>{customerDisplayName(profile)}</h3>
            <p><span>★</span> {Number(profile?.customerRating ?? 5).toFixed(1)} <b>✓ {profile?.customerCompletedOrders || 0}</b></p>
            <small>{profile?.phone || profile?.email || "-"}</small>
          </div>
          <a className="profile-edit-link" href="/customer/profile">
            <VIcon name="edit"/>
            <span>
              <strong>Редагувати профіль</strong>
              <small>Особисті дані та контакти</small>
            </span>
            <VIcon name="chevron"/>
          </a>
        </section>
        <div className="settings-side">
          <section className="customer-card role-card">
            <div className="role-icon"><VIcon name="user"/></div>
            <div>
              <strong>{customerRoleLabel(profile?.role)}</strong>
              <p>Створюйте та керуйте своїми замовленнями.</p>
            </div>
          </section>
          <section className="customer-card account-mode">
            <h3>Режим облікового запису</h3>
            <div className="mode-switch">
              <button className="active"><VIcon name="user"/>Замовник</button>
              <a href="/driver/settings"><VIcon name="car"/>Водій</a>
            </div>
          </section>
          {profile?.hasPortalAdminAccess && (
            <button className="admin-portal-switch" type="button" onClick={switchToAdminPortal} disabled={switchingToAdmin}>
              <VIcon name="shield"/>
              {switchingToAdmin ? "Переходимо..." : "Перейти до порталу адміністраторів"}
            </button>
          )}
          {adminSwitchMessage && <p className="settings-message">{adminSwitchMessage}</p>}
          <button className="logout-button" onClick={onLogout}><VIcon name="logout"/>Вийти</button>
          <p className="version">VanGo webUserPortal</p>
        </div>
      </div>
    </>
  );
}

function splitName(profile: UserProfile | null) {
  const parts = customerDisplayName(profile).split(/\s+/).filter(Boolean);
  return {
    lastName: profile?.lastName || parts[0] || "",
    firstName: profile?.firstName || parts[1] || "",
    patronymic: profile?.patronymic || parts.slice(2).join(" "),
  };
}

function LiveProfileView({ profile, onProfileSaved }: { profile: UserProfile | null; onProfileSaved: (profile: UserProfile) => void }) {
  const [form, setForm] = useState(() => ({ ...splitName(profile), phone: profile?.phone || "", email: profile?.email || "" }));
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getStoredUserToken();
    if (!token) return;
    setMessage("");
    try {
      const updated = await customerApiFetch<UserProfile>("/auth/customer-profile", token, {
        method: "POST",
        body: JSON.stringify(form),
      });
      onProfileSaved(updated);
      setMessage("Профіль збережено");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не вдалося зберегти профіль");
    }
  }

  return <><a href="/customer/settings" className="back-link"><VIcon name="arrow"/>До налаштувань</a><div className="customer-page-intro"><div><h2>Мій профіль</h2></div></div><form className="customer-card profile-form" onSubmit={submit}><section><div><h3>Особисті дані</h3><p>Ім’я відображається водіям у ваших замовленнях</p></div><div className="profile-form-grid"><label>Прізвище<input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })}/></label><label>Ім’я<input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })}/></label><label>По батькові<input value={form.patronymic} onChange={(event) => setForm({ ...form, patronymic: event.target.value })}/></label></div></section><section><div><h3>Контакти</h3><p>Номер використовується для зв’язку</p></div><div className="profile-form-grid one"><label>Номер телефону<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })}/></label><label>Email<input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></label></div></section><section><div><h3>Фото профілю</h3><p>Фото профілю можна оновити пізніше.</p></div><div className="photo-actions"><button type="button"><VIcon name="upload"/>Завантажити фото</button><button type="button">Зробити фото</button></div></section><div className="profile-form-actions"><span className="profile-save-message">{message}</span><a href="/customer/settings">Скасувати</a><button className="customer-primary">Зберегти зміни</button></div></form></>;
}

function LiveCustomerPortal({ view, orderId }: { view: "orders" | "reports" | "settings" | "profile" | "create" | "createLocal" | "createLong" | "notifications" | "orderDetail"; orderId?: number }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [orderNotification, setOrderNotification] = useState<PortalNotification | null>(null);
  const [orderResponses, setOrderResponses] = useState<CustomerOrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const token = getStoredUserToken();
      if (!token) {
        window.location.href = "/";
        return;
      }
      try {
        let profileResult = await customerApiFetch<UserProfile>("/auth/me", token);
        if (profileResult.role === "DRIVER" || profileResult.role === "BOTH") {
          await customerApiFetch<{ role: string; isAdmin?: boolean }>("/auth/role", token, {
            method: "PUT",
            body: JSON.stringify({ role: "CUSTOMER" }),
          });
          profileResult = await customerApiFetch<UserProfile>("/auth/me", token);
        }
        const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const notificationId = params?.get("notificationId") || "";
        const reminderStep = params?.get("reminderStep") || "";
        const shouldLoadNotification = view === "orderDetail" && Boolean(notificationId || reminderStep);
        const [ordersResult, orderResult, responsesResult, notificationResult] = await Promise.all([
          customerApiFetch<CustomerOrder[]>("/orders/my?role=CUSTOMER&scope=own", token),
          view === "orderDetail" && orderId ? customerApiFetch<CustomerOrder>(`/orders/${orderId}`, token) : Promise.resolve(null),
          view === "orderDetail" && orderId ? customerApiFetch<CustomerOrderResponse[]>(`/orders/${orderId}/responses`, token) : Promise.resolve([]),
          shouldLoadNotification ? customerApiFetch<PortalNotification[]>("/notifications", token).catch(() => []) : Promise.resolve([]),
        ]);
        if (view === "orderDetail" && orderResult?.customerId && profileResult?.id && orderResult.customerId !== profileResult.id) {
          throw new Error("Це замовлення належить іншому користувачу");
        }
        const notifications = Array.isArray(notificationResult) ? notificationResult : [];
        const matchedNotification = notifications.find((item) => item.id === notificationId)
          || notifications.find((item) => String(item.data?.orderId || "") === String(orderId || "") && item.data?.reminderStep === reminderStep)
          || (reminderStep ? { id: notificationId || "date-reminder", data: { orderId, reminderStep } } : null);
        setProfile(profileResult);
        setOrders(Array.isArray(ordersResult) ? ordersResult : []);
        setOrder(orderResult);
        setOrderNotification(view === "orderDetail" ? matchedNotification : null);
        setOrderResponses(Array.isArray(responsesResult) ? responsesResult : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не вдалося завантажити дані");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [view, orderId]);

  function logout() {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(KIND_KEY);
    window.location.href = "/";
  }

  const title = view === "orders" ? "Мої замовлення" : view === "reports" ? "Звіти" : view === "settings" ? "Налаштування" : view === "profile" ? "Мій профіль" : view === "notifications" ? "Сповіщення" : view === "orderDetail" ? `Замовлення № ${order?.orderNumber || orderId || ""}` : "Створити";
  return <LiveCustomerShell view={view} title={title} profile={profile}>{loading ? <div className="customer-card customer-live-state">Завантаження...</div> : error ? <div className="customer-card customer-live-state error">{error}</div> : view === "orders" ? <LiveOrdersView orders={orders}/> : view === "reports" ? <LiveReportsView orders={orders}/> : view === "settings" ? <LiveSettingsView profile={profile} onLogout={logout}/> : view === "profile" ? <LiveProfileView profile={profile} onProfileSaved={setProfile}/> : view === "notifications" ? <Notifications role="customer"/> : view === "orderDetail" ? order ? <LiveOrderDetailView order={order} responses={orderResponses} notification={orderNotification} onOrderUpdated={setOrder} onResponsesUpdated={setOrderResponses}/> : <div className="customer-card customer-live-state error">Замовлення не знайдено</div> : <LiveCreateView view={view}/>}</LiveCustomerShell>;
}

function CustomerNav({ view }: { view: CustomerView }) {
  const createActive = view === "create" || view === "createLocal" || view === "createLong";
  return <nav className="customer-nav" aria-label="Навігація кабінету замовника">
    <a href="/customer/orders" className={view === "orders" || view === "orderDetail" || view === "orderCreated" || view === "orderActive" || view === "orderReport" ? "active" : ""}><VIcon name="case"/><span>Мої замовлення</span></a>
    <a href="/customer/create" className={createActive ? "active" : ""}><VIcon name="plus"/><span>Створити</span></a>
    <a href="/customer/reports" className={view === "reports" ? "active" : ""}><VIcon name="chart"/><span>Звіти</span></a>
    <a href="/customer/settings" className={view === "settings" || view === "profile" ? "active" : ""}><VIcon name="settings"/><span>Налаштування</span></a>
  </nav>;
}

function Header({ title }: { title: string }) {
  return <header className="customer-topbar"><div><small>Кабінет замовника</small><h1>{title}</h1></div><div className="customer-tools"><ThemeToggle/><a href="/customer/support" aria-label="Підтримка"><VIcon name="headset"/></a><NotificationBell href="/customer/notifications"/><a className="customer-profile-link" href="/customer/settings" aria-label="Відкрити налаштування профілю"><span className="mini-avatar">РС</span></a></div></header>;
}

function formatRouteDistance(km: number) {
  return km >= 100 ? Math.round(km).toLocaleString("uk-UA") : km.toFixed(km >= 10 ? 1 : 2).replace(".", ",");
}

function fallbackDistanceKm(from: GooglePoint, to: GooglePoint) {
  const earthRadiusKm = 6371;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lon - from.lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function AddressFields() {
  const [pickup, setPickup] = useState<GooglePoint | null>(null);
  const [dropoff, setDropoff] = useState<GooglePoint | null>(null);
  const [distance, setDistance] = useState<{ text: string; km: number | ""; pending: boolean }>({ text: "", km: "", pending: false });

  useEffect(() => {
    if (!pickup || !dropoff) {
      setDistance({ text: "", km: "", pending: false });
      return;
    }

    const fallbackKm = fallbackDistanceKm(pickup, dropoff);
    const fallback = { text: `≈ ${formatRouteDistance(fallbackKm)} км по прямій`, km: Number(fallbackKm.toFixed(2)), pending: false };

    if (!window.google?.maps?.DirectionsService) {
      setDistance(fallback);
      return;
    }

    let active = true;
    setDistance({ text: "Рахуємо відстань маршруту...", km: "", pending: true });
    const directions = new window.google.maps.DirectionsService();
    directions.route({
      origin: { lat: pickup.lat, lng: pickup.lon },
      destination: { lat: dropoff.lat, lng: dropoff.lon },
      travelMode: window.google.maps.TravelMode.DRIVING,
    }, (result: any, status: string) => {
      if (!active) return;
      const meters = result?.routes?.[0]?.legs?.reduce((sum: number, leg: any) => sum + (leg.distance?.value || 0), 0) || 0;
      if (status === "OK" && meters > 0) {
        const km = meters / 1000;
        setDistance({ text: `≈ ${formatRouteDistance(km)} км дорогою`, km: Number(km.toFixed(2)), pending: false });
      } else {
        setDistance(fallback);
      }
    });

    return () => {
      active = false;
    };
  }, [pickup, dropoff]);

  return <>
    <div className="create-address-grid">
      <GooglePlacePicker name="pickup" label="Звідки" tone="green" onPointChange={setPickup}/>
      <GooglePlacePicker name="dropoff" label="Куди" tone="orange" onPointChange={setDropoff}/>
    </div>
    <div className={`route-distance-summary ${distance.pending ? "pending" : ""}`}>
      <VIcon name="route" size={18}/>
      <span>{distance.text || "Відстань з’явиться після вибору двох точок"}</span>
    </div>
    <input type="hidden" name="distanceKm" value={distance.km}/>
  </>;
}

function CargoFields() {
  const [payment, setPayment] = useState<"cash" | "card">("cash");
  return <section className="form-section"><div className="section-heading"><span><VIcon name="cube"/></span><div><h3>Вантаж і послуги</h3><p>Укажіть габарити, вагу та спосіб оплати</p></div></div><div className="dimension-grid"><label>Довжина, м<input name="cargoLength" placeholder="0"/></label><label>Ширина, м<input name="cargoWidth" placeholder="0"/></label><label>Висота, м<input name="cargoHeight" placeholder="0"/></label><label>Вага, кг<input name="cargoWeight" placeholder="0"/></label></div><p className="form-hint">Об’єм порахуємо після введення габаритів.</p><div className="option-row"><label><input name="loadHelp" type="checkbox" value="true"/> Допомога із завантаженням</label><label><input name="unloadHelp" type="checkbox" value="true"/> Допомога з розвантаженням</label></div><input type="hidden" name="payment" value={payment}/><div className="payment-switch" role="group" aria-label="Спосіб оплати"><button type="button" className={payment === "cash" ? "active" : ""} aria-pressed={payment === "cash"} onClick={() => setPayment("cash")}>Готівка</button><button type="button" className={payment === "card" ? "active" : ""} aria-pressed={payment === "card"} onClick={() => setPayment("card")}>Карта</button></div></section>;
}

function formatUploadSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`;
}

function CargoPhotoUpload({ onFilesChange }: { onFilesChange: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const photosRef = useRef<Array<{ previewUrl: string }>>([]);
  const [photos, setPhotos] = useState<Array<{ id: string; name: string; size: number; previewUrl: string; file: File }>>([]);

  function revokePhotos(items: Array<{ previewUrl: string }>) {
    items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }

  useEffect(() => () => revokePhotos(photosRef.current), []);

  return <div className="cargo-photo-upload-wrap">
    <div className="photo-drop cargo-photo-upload">
      <input
        ref={inputRef}
        name="photos"
        type="file"
        accept="image/*"
        multiple
        onChange={(event) => {
          const selectedFiles = Array.from(event.target.files || []).slice(0, 6);
          revokePhotos(photosRef.current);
          const nextPhotos = selectedFiles.map((file) => ({
            id: `${file.name}-${file.size}-${file.lastModified}`,
            name: file.name,
            size: file.size,
            previewUrl: URL.createObjectURL(file),
            file,
          }));
          photosRef.current = nextPhotos;
          setPhotos(nextPhotos);
          onFilesChange(nextPhotos.map((photo) => photo.file));
          event.target.value = "";
        }}
      />
      <VIcon name="image"/>
      <div><strong>Додати фото вантажу</strong><small>{photos.length ? `${photos.length} фото вибрано` : "Фото або файл із галереї"}</small></div>
      <button type="button" onClick={() => inputRef.current?.click()}>Обрати</button>
    </div>
    {photos.length > 0 && <div className="cargo-photo-list">
      {photos.map((photo) => <div key={photo.id} className="cargo-photo-item">
        <img src={photo.previewUrl} alt={photo.name}/>
        <span><strong>{photo.name}</strong><small>{formatUploadSize(photo.size)}</small></span>
        <button type="button" onClick={() => {
          URL.revokeObjectURL(photo.previewUrl);
          const nextPhotos = photos.filter((item) => item.id !== photo.id);
          photosRef.current = nextPhotos;
          setPhotos(nextPhotos);
          onFilesChange(nextPhotos.map((item) => item.file));
        }}>Прибрати</button>
      </div>)}
    </div>}
  </div>;
}

function CreateForm({ longDistance }: { longDistance: boolean }) {
  const [arrival, setArrival] = useState<"" | "now" | "hour" | "planned">(longDistance ? "" : "now");
  const [freeDate, setFreeDate] = useState(false);
  const [negotiable, setNegotiable] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function normalizedNumber(value: FormDataEntryValue | null) {
    return String(value || "").trim().replace(/\s+/g, "").replace(",", ".");
  }

  function appendText(fd: FormData, name: string, value: FormDataEntryValue | null) {
    const text = String(value || "").trim();
    if (text) fd.append(name, text);
  }

  function dateTimeIso(dateValue: FormDataEntryValue | null, timeValue: FormDataEntryValue | null, fallback: Date) {
    const date = String(dateValue || "").trim();
    const time = String(timeValue || "").trim();
    if (!date) return fallback.toISOString();
    const parsed = new Date(`${date}T${time || "09:00"}:00`);
    return Number.isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getStoredUserToken();
    if (!token) {
      window.location.href = "/";
      return;
    }

    const form = event.currentTarget;
    const raw = new FormData(form);
    const pickupLocation = String(raw.get("pickupLocation") || "").trim();
    const dropoffLocation = String(raw.get("dropoffLocation") || "").trim();
    const cargoType = String(raw.get("cargoType") || "").trim();
    if (!pickupLocation || !dropoffLocation) {
      setSubmitError("Вкажіть адреси завантаження та доставки");
      return;
    }
    if (!cargoType) {
      setSubmitError("Вкажіть опис вантажу");
      return;
    }

    const fd = new FormData();
    ["pickupLocation", "dropoffLocation", "pickupCity", "pickupAddress", "pickupLat", "pickupLon", "dropoffCity", "dropoffAddress", "dropoffLat", "dropoffLon", "cargoType"].forEach((name) => appendText(fd, name, raw.get(name)));
    ["cargoLength", "cargoWidth", "cargoHeight", "cargoWeight"].forEach((name) => {
      const value = normalizedNumber(raw.get(name));
      if (value) fd.append(name, value);
    });

    const length = Number(normalizedNumber(raw.get("cargoLength")));
    const width = Number(normalizedNumber(raw.get("cargoWidth")));
    const height = Number(normalizedNumber(raw.get("cargoHeight")));
    if (length > 0 && width > 0 && height > 0) {
      fd.append("cargoVolume", (length * width * height).toFixed(2));
    }

    const distance = normalizedNumber(raw.get("distanceKm"));
    if (distance) fd.append("distance", distance);
    fd.append("requestedOrderType", longDistance ? "LONG_DISTANCE" : "LOCAL");
    fd.append("timingOption", longDistance ? "" : arrival === "hour" ? "WITHIN_1_HOUR" : arrival === "planned" ? "SCHEDULED" : "ASAP");
    fd.append("freeDate", freeDate ? "true" : "false");
    fd.append("loadHelp", raw.get("loadHelp") ? "true" : "false");
    fd.append("unloadHelp", raw.get("unloadHelp") ? "true" : "false");
    fd.append("payment", String(raw.get("payment") || "cash"));
    fd.append("insurance", "false");
    fd.append("agreedPrice", negotiable ? "true" : "false");
    if (longDistance && !negotiable) {
      appendText(fd, "price", raw.get("price"));
    }

    const now = new Date();
    const loadStart = longDistance
      ? new Date(dateTimeIso(raw.get("loadDate"), raw.get("loadTimeFrom"), now))
      : new Date(now.getTime() + (arrival === "hour" ? 60 * 60 * 1000 : 0));
    const loadEnd = longDistance
      ? new Date(dateTimeIso(raw.get("loadDate"), raw.get("loadTimeTo"), new Date(loadStart.getTime() + 60 * 60 * 1000)))
      : new Date(loadStart.getTime() + 60 * 60 * 1000);
    const unloadStart = longDistance
      ? new Date(dateTimeIso(raw.get("unloadDate"), raw.get("loadTimeTo"), new Date(loadEnd.getTime() + 60 * 60 * 1000)))
      : new Date(loadEnd);
    const unloadEnd = new Date(unloadStart.getTime() + 60 * 60 * 1000);
    fd.append("loadFrom", loadStart.toISOString());
    fd.append("loadTo", loadEnd.toISOString());
    fd.append("unloadFrom", unloadStart.toISOString());
    fd.append("unloadTo", unloadEnd.toISOString());

    photoFiles.forEach((file) => {
      if (file instanceof File && file.size > 0) fd.append("photos", file);
    });

    setSubmitting(true);
    setSubmitError("");
    try {
      const created = await customerApiFetch<CustomerOrder>("/orders", token, { method: "POST", body: fd });
      window.location.href = `/customer/orders/${created.id}`;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Не вдалося створити замовлення");
    } finally {
      setSubmitting(false);
    }
  }

  return <form className="create-order-form" onSubmit={submit}>
    <section className="customer-card form-section route-form"><div className="order-type-line"><div><small>Тип замовлення</small><strong>{longDistance ? "Далеке перевезення" : "Місцеве перевезення"}</strong></div><a href="/customer/create">Змінити</a></div>{longDistance && <p className="orange-notice">Маршрут понад 70 км, тому замовлення буде оформлене як далеке.</p>}<AddressFields/></section>
    <div className="create-form-columns"><div>
      <section className="customer-card form-section"><div className="section-heading"><span><VIcon name="clock"/></span><div><h3>{longDistance ? "Дата та час" : "Коли потрібне авто"}</h3><p>{longDistance ? "Вікно завантаження і розвантаження" : "Оберіть швидкість подачі автомобіля"}</p></div></div>{longDistance ? <><label className="toggle-row"><span><strong>Вільна дата</strong><small>Водій погодить день і час із вами</small></span><input type="checkbox" checked={freeDate} onChange={(event) => setFreeDate(event.target.checked)}/><i aria-hidden="true"/></label><div className="schedule-grid"><label>Завантаження<input name="loadDate" type="date" disabled={freeDate}/></label><label>Час від<input name="loadTimeFrom" type="time" disabled={freeDate}/></label><label>Час до<input name="loadTimeTo" type="time" disabled={freeDate}/></label><label>Розвантаження<input name="unloadDate" type="date" disabled={freeDate}/></label></div></> : <div className="choice-pills" role="group" aria-label="Час подачі автомобіля"><button type="button" className={arrival === "now" ? "active" : ""} aria-pressed={arrival === "now"} onClick={() => setArrival("now")}>Якнайшвидше</button><button type="button" className={arrival === "hour" ? "active" : ""} aria-pressed={arrival === "hour"} onClick={() => setArrival("hour")}>До 1 год</button><button type="button" className={arrival === "planned" ? "active" : ""} aria-pressed={arrival === "planned"} onClick={() => setArrival("planned")}>Запланувати</button></div>}</section>
      <section className="customer-card"><CargoFields/></section>
    </div><div>
      <section className="customer-card form-section"><div className="section-heading"><span><VIcon name="edit"/></span><div><h3>Опис вантажу</h3><p>Додайте деталі, важливі для водія</p></div></div><textarea name="cargoType" placeholder="Наприклад: меблі, коробки, побутова техніка"/><CargoPhotoUpload onFilesChange={setPhotoFiles}/></section>
      {longDistance && <section className="customer-card form-section"><div className="section-heading"><span><VIcon name="case"/></span><div><h3>Вартість перевезення</h3><p>Запропонуйте ціну або залиште її договірною</p></div></div><div className="price-row"><label>Ціна, грн<input name="price" placeholder="0" disabled={negotiable}/></label><label className="toggle-row compact"><span><strong>Договірна</strong><small>Ціну погодите з водієм</small></span><input type="checkbox" checked={negotiable} onChange={(event) => setNegotiable(event.target.checked)}/><i aria-hidden="true"/></label></div></section>}
      {!longDistance && <div className="info-banner">Водії надішлють пропозиції з погодинною оплатою</div>}
      {submitError && <div className="customer-form-error">{submitError}</div>}
      <button className="customer-primary submit-order" type="submit" disabled={submitting}>{submitting ? "Створюємо..." : "Створити замовлення"}</button>
    </div></div>
  </form>;
}

function OrderFacts() {
  return <section className="customer-card order-facts-card"><h3>Маршрут і деталі</h3><div className="fact-route"><i className="from"/><div><span>Звідки</span><strong>Черкаси, вулиця Героїв Дніпра 81</strong></div><i className="to"/><div><span>Куди</span><strong>Черкаси, Руськополянський проїзд</strong></div></div><div className="facts-visual-grid"><FactVisual icon="route" label="Відстань" value="≈ 8 км" tone="blue"/><FactVisual icon="cube" label="Габарити" value="1 × 1 × 0,5 м · 0,50 м³" tone="violet"/><FactVisual icon="case" label="Вага" value="20 кг" tone="orange"/><FactVisual icon="car" label="Подача авто" value="До 1 години" tone="green"/><FactVisual icon="check" label="Оплата" value="Готівка" tone="teal"/><FactVisual icon="edit" label="Опис" value="Тест" tone="slate" wide/></div><div className="cargo-photo-placeholder"><VIcon name="image" size={28}/><span>Фото вантажу</span></div></section>;
}

function OrderDetail({ active }: { active: boolean }) {
  return <><a className="back-link" href="/customer/orders"><VIcon name="arrow"/>До замовлень</a><div className="order-detail-head"><div><small>Замовлення № 130 · 26.08.2026, 11:53</small><h2>{active ? "Перевезення в роботі" : "Отримано пропозицію водія"}</h2></div><span className={`big-status ${active ? "blue" : "green"}`}>{active ? "В роботі" : "Створено"}</span></div><div className="order-detail-grid"><div>
    {!active && <section className="customer-card driver-offer"><div className="offer-title"><span className="mini-avatar green">РС</span><div><strong>Рябенко Сергій</strong><small>★ 5.0 · ✓ 5 виконаних</small></div><span>Готовий виконати</span></div><div className="offer-values"><p><span>Ставка</span><strong>450 грн/год</strong></p><p><span>Мінімум</span><strong>1 година</strong></p><p><span>Прибуде</span><strong>до 30 хв</strong></p></div><div className="offer-actions"><a href="/customer/orders/130/active">Обрати водія</a><button>Відхилити</button></div></section>}
    {active && <section className="customer-card active-driver"><div><span className="mini-avatar green">РС</span><div><small>Ваш водій</small><h3>Рябенко Сергій</h3><p>★ 5.0 · зелений Fiat Ducato</p></div></div><a href="tel:+380504233382"><VIcon name="phone"/>Зателефонувати</a><div className="progress-steps"><span className="done"><i><VIcon name="check" size={13}/></i>Водія обрано</span><span className="current"><i>2</i>Прямує до вас</span><span><i>3</i>Перевезення</span><span><i>4</i>Завершено</span></div></section>}
    <OrderFacts/>
  </div><aside className="customer-card order-side"><h3>Стан замовлення</h3><div className="timeline"><p className="done"><i/><span><strong>Створено</strong><small>26.08.2026, 11:53</small></span></p><p className={active ? "done" : "current"}><i/><span><strong>{active ? "Водія підтверджено" : "Пропозиція від водія"}</strong><small>{active ? "26.08.2026, 11:58" : "26.08.2026, 11:55"}</small></span></p>{active && <p className="current"><i/><span><strong>Водій прямує до вас</strong><small>Орієнтовно до 30 хв</small></span></p>}</div>{!active && <p className="side-note">Перевірте ставку, рейтинг і час прибуття водія перед підтвердженням.</p>}{active && <p className="side-note blue">Після виконання перевезення ви зможете оцінити водія.</p>}</aside></div></>;
}

type ReportOrder = { id:number; date:string; driver:string; initials:string; from:string; to:string; distance:string; dimensions:string; weight:string; totalTime:string; cargoTime:string; idle:string; price:string; status:"Виконано"|"Затримка"; rating:string; review:string };
const reportOrders: Record<number, ReportOrder> = {
  130:{id:130,date:"26.08.2026, 11:53",driver:"Сергій Рябенко",initials:"СР",from:"Черкаси, вулиця Героїв Дніпра 81",to:"Черкаси, Руськополянський проїзд",distance:"8 км",dimensions:"1 × 1 × 0,5 м · 0,50 м³",weight:"20 кг",totalTime:"2 год 18 хв",cargoTime:"1 год 12 хв",idle:"18 хв",price:"450 грн",status:"Виконано",rating:"5,0",review:"Водій прибув вчасно, вантаж доставлено обережно."},
  124:{id:124,date:"25.08.2026, 13:57",driver:"Олексій Мельник",initials:"ОМ",from:"Черкаси, вулиця Шевченка 235",to:"Кропивницький, вулиця Шевченка 12",distance:"127 км",dimensions:"1 × 0,5 × 0,7 м · 0,35 м³",weight:"20 кг",totalTime:"4 год 46 хв",cargoTime:"3 год 08 хв",idle:"24 хв",price:"1 000 грн",status:"Виконано",rating:"4,8",review:"Перевезення виконано акуратно, зв’язок із водієм був постійний."},
  121:{id:121,date:"24.08.2026, 09:20",driver:"Іван Коваль",initials:"ІК",from:"Черкаси, бульвар Шевченка 207",to:"Слобода, Жовтнева вулиця 5",distance:"31 км",dimensions:"1,2 × 0,8 × 0,6 м · 0,58 м³",weight:"45 кг",totalTime:"2 год 04 хв",cargoTime:"1 год 21 хв",idle:"11 хв",price:"444 грн",status:"Виконано",rating:"5,0",review:"Все добре, водій допоміг із завантаженням."},
  118:{id:118,date:"23.08.2026, 15:10",driver:"Андрій Бондар",initials:"АБ",from:"Черкаси, вулиця Смілянська 122",to:"Сміла, вулиця Соборна 96",distance:"36 км",dimensions:"1,8 × 1,1 × 0,9 м · 1,78 м³",weight:"160 кг",totalTime:"2 год 42 хв",cargoTime:"1 год 34 хв",idle:"29 хв",price:"850 грн",status:"Затримка",rating:"4,2",review:"Вантаж доставлено цілим, але із запізненням."},
  115:{id:115,date:"22.08.2026, 08:15",driver:"Сергій Рябенко",initials:"СР",from:"Черкаси, вулиця Благовісна 170",to:"Київ, проспект Перемоги 24",distance:"192 км",dimensions:"2 × 1,2 × 1 м · 2,40 м³",weight:"280 кг",totalTime:"6 год 12 хв",cargoTime:"4 год 18 хв",idle:"22 хв",price:"3 200 грн",status:"Виконано",rating:"5,0",review:"Чітко за графіком, рекомендую водія."},
  112:{id:112,date:"21.08.2026, 10:40",driver:"Олексій Мельник",initials:"ОМ",from:"Черкаси, вулиця Надпільна 248",to:"Умань, вулиця Європейська 12",distance:"185 км",dimensions:"1,6 × 1 × 0,8 м · 1,28 м³",weight:"130 кг",totalTime:"5 год 24 хв",cargoTime:"3 год 46 хв",idle:"31 хв",price:"2 900 грн",status:"Виконано",rating:"4,7",review:"Умови виконані, вантаж передано без пошкоджень."},
  109:{id:109,date:"19.08.2026, 07:50",driver:"Іван Коваль",initials:"ІК",from:"Черкаси, вулиця Хрещатик 200",to:"Київ, вулиця Велика Васильківська 72",distance:"190 км",dimensions:"1,4 × 0,9 × 0,7 м · 0,88 м³",weight:"95 кг",totalTime:"6 год 03 хв",cargoTime:"4 год 11 хв",idle:"19 хв",price:"3 050 грн",status:"Виконано",rating:"4,9",review:"Водій завжди був на зв’язку, все виконано добре."},
  104:{id:104,date:"17.08.2026, 12:25",driver:"Андрій Бондар",initials:"АБ",from:"Черкаси, вулиця Чорновола 55",to:"Золотоноша, вулиця Шевченка 70",distance:"38 км",dimensions:"1 × 0,7 × 0,5 м · 0,35 м³",weight:"32 кг",totalTime:"2 год 31 хв",cargoTime:"1 год 28 хв",idle:"27 хв",price:"760 грн",status:"Виконано",rating:"4,6",review:"Замовлення виконано, зауважень до вантажу немає."},
};

function ReportOrderDetail({ orderId }: { orderId:number }) {
  const item = reportOrders[orderId] ?? reportOrders[130];
  return <><a className="back-link" href="/customer/reports"><VIcon name="arrow"/>До звітів</a><div className="order-detail-head"><div><small>Замовлення № {item.id} · {item.date}</small><h2>{item.from.split(",")[0]} → {item.to.split(",")[0]}</h2></div><span className={`big-status ${item.status === "Затримка" ? "orange" : "green"}`}>{item.status}</span></div><div className="order-detail-grid"><div><section className="customer-card active-driver report-driver-card"><div><span className="mini-avatar green">{item.initials}</span><div><small>Водій замовлення</small><h3>{item.driver}</h3><p>Оцінка від замовника: ★ {item.rating}</p></div></div></section><section className="customer-card order-facts-card"><h3>Маршрут і деталі</h3><div className="fact-route"><i className="from"/><div><span>Звідки</span><strong>{item.from}</strong></div><i className="to"/><div><span>Куди</span><strong>{item.to}</strong></div></div><div className="facts-visual-grid"><FactVisual icon="route" label="Відстань дорогами" value={item.distance} tone="blue"/><FactVisual icon="cube" label="Габарити" value={item.dimensions} tone="violet"/><FactVisual icon="case" label="Вага" value={item.weight} tone="orange"/><FactVisual icon="clock" label="Загальний час" value={item.totalTime} tone="blue"/><FactVisual icon="route" label="Від «Отримав» до «Віддав»" value={item.cargoTime} tone="green"/><FactVisual icon="clock" label="Очікування" value={item.idle} tone="orange"/><FactVisual icon="check" label="Фінальна ціна" value={item.price} tone="teal" wide/></div></section></div><aside><section className="customer-card order-side report-order-side"><h3>Історія виконання</h3><div className="timeline"><p className="done"><i/><span><strong>Створено</strong><small>09:10</small></span></p><p className="done"><i/><span><strong>Водія підтверджено</strong><small>09:24</small></span></p><p className="done"><i/><span><strong>Вантаж отримано</strong><small>10:08</small></span></p><p className="done"><i/><span><strong>Вантаж передано</strong><small>11:20</small></span></p><p className="done"><i/><span><strong>Замовлення завершено</strong><small>11:28</small></span></p></div></section><section className="customer-card customer-review-card"><span>Оцінка замовника</span><strong>★ {item.rating}</strong><p>{item.review}</p></section></aside></div></>;
}

function formatNotificationTime(value?: string) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getNotificationHref(item: PortalNotification, role: "customer" | "driver") {
  const data = item.data || {};
  const orderId = data.orderId != null ? String(data.orderId) : "";
  const target = data.navigateTo || "";

  if (target === "driverOrders" || target === "driverHistory") return "/driver/orders";
  if (target === "SupportRequest" || target === "supportRequest") return role === "driver" ? "/driver/support" : "/customer/support";
  if (target === "ratingDetail") return role === "driver" ? "/driver/orders" : "/customer/reports";
  if (orderId) {
    if (role === "driver") return `/driver/orders/${orderId}`;
    const params = new URLSearchParams({ notificationId: item.id });
    if (data.reminderStep) params.set("reminderStep", data.reminderStep);
    return `/customer/orders/${orderId}?${params.toString()}`;
  }
  return "";
}

export function Notifications({ role = "customer" }: { role?: "customer" | "driver" }) {
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const unreadCount = items.filter((item) => !item.read).length;

  async function loadNotifications() {
    const token = getStoredUserToken();
    if (!token) {
      window.location.href = "/";
      return;
    }
    try {
      setLoading(true);
      const nextItems = await customerApiFetch<PortalNotification[]>("/notifications", token);
      setItems(Array.isArray(nextItems) ? nextItems : []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося завантажити сповіщення");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function markAllRead() {
    const token = getStoredUserToken();
    if (!token) return;
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    notifyNotificationBadgeChanged();
    try {
      await customerApiFetch("/notifications/read-all", token, { method: "PUT" });
    } catch {
      loadNotifications();
    }
  }

  async function markRead(id: string) {
    const token = getStoredUserToken();
    if (!token || !id) return;
    setItems((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
    notifyNotificationBadgeChanged();
    try {
      await customerApiFetch(`/notifications/${id}/read`, token, { method: "PUT" });
    } catch {
      loadNotifications();
    }
  }

  return <><div className="customer-page-intro"><div><h2>Сповіщення</h2></div>{unreadCount > 0 && <button className="mark-read" onClick={markAllRead}>Прочитати всі</button>}</div>{loading ? <div className="customer-card customer-live-state">Завантаження сповіщень...</div> : error ? <div className="customer-card customer-live-state error">{error}</div> : items.length === 0 ? <div className="customer-card customer-empty compact"><span className="empty-illustration"><VIcon name="bell" size={32}/></span><h3>Сповіщень поки немає</h3><p>Тут з’являтимуться push-події, які бекенд надсилає вашому акаунту.</p></div> : <div className="notification-list">{items.map((item) => {
    const href = getNotificationHref(item, role);
    const content = <><span className="notification-icon"><VIcon name={item.read ? "bell" : "bell"}/></span><div><strong>{item.title || "Сповіщення"}</strong>{item.body && <p>{item.body}</p>}<small>{formatNotificationTime(item.receivedAt)}</small></div>{!item.read && <i/>}{href && <VIcon name="chevron"/>}</>;
    return href ? <a key={item.id} className={`customer-card notification-item ${item.read ? "" : "unread"}`} href={href} onClick={() => markRead(item.id)}>{content}</a> : <button key={item.id} className={`customer-card notification-item ${item.read ? "" : "unread"}`} onClick={() => markRead(item.id)}>{content}</button>;
  })}</div>}</>;
}

const SUPPORT_REFRESH_MS = 5000;

const SUPPORT_QUICK_QUESTIONS = [
  {
    id: "what-is-vango",
    question: "Що таке VanGo?",
    answer: "VanGo - це застосунок для швидкого пошуку вантажних перевезень. Клієнти можуть створювати замовлення, а водії - знаходити відповідні заявки, домовлятися про умови та виконувати перевезення.",
  },
  {
    id: "phone-format",
    question: "У якому форматі вводити номер телефону?",
    answer: "Вводьте український номер без зайвих символів. Найкраще використовувати формат +380XXXXXXXXX або 0XXXXXXXXX. Якщо код не надходить, спершу перевірте, чи немає помилки в цифрах.",
  },
  {
    id: "sms-not-received",
    question: "Не прийшло SMS з кодом. Що робити?",
    answer: "Перевірте введений номер, зачекайте до хвилини та спробуйте надіслати код ще раз. Також перевірте інтернет, сигнал мобільної мережі та чи не потрапило SMS у спам або заблоковані повідомлення.",
  },
  {
    id: "no-notifications",
    question: "Чому немає сповіщень?",
    answer: "Перевірте, чи дозволені сповіщення для VanGo в налаштуваннях телефону. Також переконайтесь, що є інтернет та чи ви увійшли в акаунт. Історію можна переглянути через дзвіночок у верхній частині екрана.",
  },
  {
    id: "create-order",
    question: "Як створити замовлення?",
    answer: "Перейдіть у роль \"Замовник\" і відкрийте вкладку \"Створити\". Заповніть точки завантаження та розвантаження, дату, параметри вантажу, оплату й опис. Якщо додаєте фото, дочекайтесь завершення завантаження, після чого натисніть кнопку створення замовлення.",
  },
  {
    id: "cannot-create-order",
    question: "Не вдається створити замовлення",
    answer: "Перевірте, чи заповнені обовʼязкові поля: адреси, дата, параметри вантажу, оплата та опис. Якщо є фото, дочекайтесь завершення завантаження. Після цього перевірте інтернет і спробуйте ще раз.",
  },
  {
    id: "delete-order",
    question: "Чи можна видалити замовлення?",
    answer: "Замовник може видалити лише своє замовлення зі статусом \"Створено\", поки водій ще не підтверджений і виконання не почалося. Якщо замовлення вже прийняте, в роботі, доставлене або виконане, видалити його не можна: можна скасувати підтвердженого водія, якщо така дія доступна, або передати питання у техпідтримку.",
  },
  {
    id: "search-orders",
    question: "Як шукати замовлення?",
    answer: "Перейдіть у роль \"Водій\" і відкрийте вкладку \"Мапа\". Там показуються доступні замовлення поруч із вами або в обраному районі. За потреби змініть фільтри пошуку, відкрийте потрібне замовлення та натисніть \"Відгукнутися\", щоб запропонувати свої умови.",
  },
  {
    id: "orders-not-visible",
    question: "Чому я не бачу замовлення?",
    answer: "Перевірте вашу роль, фільтри, мапу або список доступних замовлень. Для водія заявки можуть не показуватись, якщо немає активних замовлень у вибраному районі або фільтр звужує пошук.",
  },
  {
    id: "change-role",
    question: "Як змінити роль у застосунку?",
    answer: "Відкрийте налаштування та скористайтесь перемикачем ролі. Клієнт створює замовлення, водій шукає та виконує перевезення.",
  },
  {
    id: "app-error",
    question: "Що робити, якщо застосунок показує помилку?",
    answer: "Оновіть екран, перевірте інтернет і повторіть дію. Якщо помилка не зникає, перезапустіть застосунок. Для входу, SMS та сповіщень також варто перевірити дозволи застосунку в налаштуваннях телефону.",
  },
];

function supportStatusLabel(status?: string) {
  const normalized = status === "CLOSED" ? "ANSWERED" : status || "OPEN";
  return normalized === "ANSWERED" ? "Є відповідь" : "Передано";
}

function supportPhotoUrl(photo: string) {
  return normalizePhotoUrl(photo);
}

export function Support({ notify }: { notify: (message: string) => void }) {
  const [question, setQuestion] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [items, setItems] = useState<SupportQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [botQuestion, setBotQuestion] = useState("");
  const [botLoading, setBotLoading] = useState(false);
  const [botMessages, setBotMessages] = useState<SupportBotMessage[]>([
    { id: "welcome", role: "bot", text: "Привіт! Я робот підтримки VanGo. Питайте про замовлення, ролі, сповіщення, оплату або налаштування." },
  ]);
  const [activeSupportPanel, setActiveSupportPanel] = useState<"bot" | "request" | null>(null);
  const botMessagesEndRef = useRef<HTMLDivElement | null>(null);

  async function loadQuestions(silent = false) {
    const token = getStoredUserToken();
    if (!token) {
      window.location.href = "/";
      return;
    }
    if (!silent) setLoading(true);
    try {
      const data = await customerApiFetch<SupportQuestion[]>("/support/questions", token);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!silent) setErrorMessage(err instanceof Error ? err.message : "Не вдалося завантажити звернення");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    loadQuestions();
    const timer = window.setInterval(() => loadQuestions(true), SUPPORT_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeSupportPanel === "bot") {
      botMessagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [activeSupportPanel, botMessages]);

  function updatePhotos(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.currentTarget.files || []);
    setPhotos((current) => [...current, ...selected].slice(0, 5));
    event.currentTarget.value = "";
  }

  function removePhoto(index: number) {
    setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (!text || submitting) return;

    const token = getStoredUserToken();
    if (!token) {
      window.location.href = "/";
      return;
    }

    const form = new FormData();
    form.append("question", text);
    photos.forEach((photo) => form.append("photos", photo));

    setSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");
    try {
      const response = await customerApiFetch<{ message?: string }>("/support/questions", token, {
        method: "POST",
        body: form,
      });
      setQuestion("");
      setPhotos([]);
      setSuccessMessage(response.message || "Питання передано розробникам. Ви отримаєте відповідь у застосунку найближчим часом.");
      notify("Питання передано розробникам");
      await loadQuestions(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Не вдалося передати питання. Спробуйте ще раз.");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendBotQuestion(value: string) {
    const text = value.trim();
    if (!text || botLoading) return;

    const token = getStoredUserToken();
    if (!token) {
      window.location.href = "/";
      return;
    }

    const createdAt = Date.now();
    const pendingId = `bot-${createdAt}`;
    const history = botMessages
      .filter((message) => !message.pending && message.id !== "welcome")
      .slice(-8)
      .map((message) => ({ role: message.role, text: message.text }));
    setBotLoading(true);
    setBotQuestion("");
    setBotMessages((current) => [
      ...current,
      { id: `user-${createdAt}`, role: "user", text },
      { id: pendingId, role: "bot", text: "Готую відповідь...", pending: true },
    ]);
    try {
      const response = await customerApiFetch<{ answer?: string; error?: string }>("/support/ask", token, {
        method: "POST",
        body: JSON.stringify({ question: text, history }),
      });
      const answer = response.answer || "Не вдалося знайти відповідь на це питання.";
      setBotMessages((current) => current.map((message) => message.id === pendingId ? { ...message, text: answer, pending: false } : message));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Зараз не вдалося отримати відповідь. Спробуйте ще раз.";
      setBotMessages((current) => current.map((item) => item.id === pendingId ? { ...item, text: message, pending: false, error: true } : item));
    } finally {
      setBotLoading(false);
    }
  }

  async function askBot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendBotQuestion(botQuestion);
  }

  return <>
    {activeSupportPanel !== "bot" && <div className="customer-page-intro"><div><h2>Технічна підтримка</h2><p>Швидкі відповіді, робот підтримки та звернення до команди VanGo.</p></div></div>}
    <div className={`support-grid ${activeSupportPanel === "bot" ? "chat-mode" : ""}`}>
      <div className="support-main">
        <div className="support-action-row">
          <button type="button" className={`customer-card support-action-card ${activeSupportPanel === "bot" ? "active" : ""}`} onClick={() => setActiveSupportPanel("bot")}><span><VIcon name="headset" size={22}/></span><div><strong>Запитати робота</strong><small>Швидка відповідь про роботу VanGo</small></div><VIcon name="chevron" size={18}/></button>
          <button type="button" className={`customer-card support-action-card ${activeSupportPanel === "request" ? "active" : ""}`} onClick={() => setActiveSupportPanel("request")}><span><VIcon name="settings" size={22}/></span><div><strong>Передати у техпідтримку</strong><small>Зафіксувати питання для розробників</small></div><VIcon name="chevron" size={18}/></button>
        </div>

        {activeSupportPanel === "bot" && <section className="support-bot-card support-chat-screen" id="support-bot">
          <div className="support-chat-top"><button type="button" onClick={() => setActiveSupportPanel(null)}><VIcon name="arrow" size={18}/>Назад</button><strong>Робот підтримки</strong></div>
          <div className="support-chat-window">
            <div className="support-chat-date">Сьогодні</div>
            <div className="support-chat-messages">
              {botMessages.map((message) => <div className={`support-chat-message ${message.role} ${message.pending ? "pending" : ""} ${message.error ? "error" : ""}`} key={message.id}>
                {message.role === "bot" && <span className="support-chat-avatar"><VIcon name="headset" size={16}/></span>}
                <p>{message.text}</p>
              </div>)}
              <div ref={botMessagesEndRef}/>
            </div>
            <div className="support-chat-chips">
              {SUPPORT_QUICK_QUESTIONS.slice(0, 4).map((item) => <button type="button" key={item.id} onClick={() => sendBotQuestion(item.question)} disabled={botLoading}>{item.question}</button>)}
            </div>
          </div>
          <form className="support-chat-input" onSubmit={askBot}>
            <textarea value={botQuestion} onChange={(event) => setBotQuestion(event.target.value)} placeholder="Напишіть питання..." maxLength={800} disabled={botLoading} onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendBotQuestion(botQuestion);
              }
            }}/>
            <button className="customer-primary" type="submit" disabled={!botQuestion.trim() || botLoading} aria-label="Надіслати питання"><VIcon name="send" size={18}/>{botLoading ? "Пишу..." : "Надіслати"}</button>
          </form>
        </section>}

        {activeSupportPanel === "request" && <section className="customer-card support-form" id="support-request">
          <div className="support-section-head"><span><VIcon name="settings" size={24}/></span><div><h3>Питання розробникам</h3><p>Опишіть, що незрозуміло або що не працює. Можна додати до 5 фото.</p></div></div>
          <form onSubmit={submitQuestion}>
            <label>Ваше питання<textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Наприклад: не приходить SMS, не бачу сповіщення..." maxLength={1200} disabled={submitting}/></label>
            <div className="support-counter">{question.length}/1200</div>
            <div className="support-photo-field">
              <div><strong>Фото</strong><small>Додайте скрін або фото проблеми, якщо це допоможе розробникам.</small></div>
              <label className="support-photo-button"><input type="file" accept="image/*" multiple onChange={updatePhotos} disabled={submitting || photos.length >= 5}/><VIcon name="upload" size={18}/>Додати фото</label>
            </div>
            {photos.length > 0 && <div className="support-photo-list">{photos.map((photo, index) => <div className="support-photo-item" key={`${photo.name}-${index}`}><span>{photo.name}</span><button type="button" onClick={() => removePhoto(index)} disabled={submitting}>Прибрати</button></div>)}</div>}
            {successMessage && <div className="support-success"><VIcon name="check" size={18}/><span>{successMessage}</span></div>}
            {errorMessage && <p className="customer-form-error">{errorMessage}</p>}
            <button className="customer-primary" type="submit" disabled={!question.trim() || submitting}><VIcon name="send" size={18}/>{submitting ? "Передаємо..." : "Передати розробникам"}</button>
          </form>
        </section>}

        {activeSupportPanel !== "bot" && <section className="support-history">
          <div className="support-history-head"><h3>Мої звернення</h3>{loading && <span>Завантаження...</span>}</div>
          {!loading && items.length === 0 ? <div className="customer-card customer-empty compact"><span className="empty-illustration"><VIcon name="headset" size={32}/></span><h3>Звернень ще немає</h3><p>Після відправки питання воно зʼявиться тут разом зі статусом.</p></div> : <div className="support-history-list">{items.map((item) => <article className="customer-card support-history-card" key={item.id}>
            <div className="support-history-top"><small>{customerDateTime(item.createdAt)}</small><span className={item.status === "ANSWERED" || item.status === "CLOSED" ? "answered" : ""}>{supportStatusLabel(item.status)}</span></div>
            <p>{item.question}</p>
            {Array.isArray(item.photos) && item.photos.length > 0 && <div className="support-history-photos">{item.photos.map((photo, index) => <a href={supportPhotoUrl(photo)} target="_blank" rel="noreferrer" key={`${item.id}-${photo}-${index}`}><img src={supportPhotoUrl(photo)} alt="Фото звернення"/></a>)}</div>}
            {item.answer && <div className="support-answer-box"><strong>Відповідь</strong><p>{item.answer}</p></div>}
          </article>)}</div>}
        </section>}
      </div>

      {activeSupportPanel !== "bot" && <aside className="customer-card support-aside">
        <div className="support-hero"><span><VIcon name="headset" size={28}/></span><h3>Швидкі питання</h3><p>Готові відповіді з мобільного застосунку.</p></div>
        <div className="faq support-quick-list">
          {SUPPORT_QUICK_QUESTIONS.map((item) => {
            const expanded = expandedQuestionId === item.id;
            return <button type="button" className={`support-question-card ${expanded ? "open" : ""}`} key={item.id} onClick={() => setExpandedQuestionId(expanded ? null : item.id)}>
              <span><strong>{item.question}</strong><VIcon name={expanded ? "arrow" : "chevron"} size={18}/></span>
              {expanded && <p>{item.answer}</p>}
            </button>;
          })}
        </div>
      </aside>}
    </div>
  </>;
}

export default function CustomerPortal({ view, orderId = 130 }: { view: CustomerView; orderId?: number }) {
  if (view === "orders" || view === "reports" || view === "settings" || view === "profile" || view === "create" || view === "createLocal" || view === "createLong" || view === "notifications" || view === "orderDetail") {
    return <LiveCustomerPortal view={view} orderId={orderId}/>;
  }

  const [tab, setTab] = useState("Створено"); const [toast, setToast] = useState("");
  const notify = (message:string) => { setToast(message); window.setTimeout(() => setToast(""),2600); };
  useEffect(()=>{ if(view==="loading"){const timer=window.setTimeout(()=>{window.location.href="/customer/orders"},1800);return()=>window.clearTimeout(timer)}},[view]);
  if(view==="loading") return <main className="customer-loader"><img src="/customer-loading-truck.png" alt="VanGo вантажівка з коробками"/><div className="loading-line"><span/></div></main>;
  const titles:Record<CustomerView,string>={loading:"Завантаження",orders:"Мої замовлення",reports:"Звіти",settings:"Налаштування",profile:"Мій профіль",create:"Створити",createLocal:"Місцеве перевезення",createLong:"Далеке перевезення",notifications:"Сповіщення",support:"Технічна підтримка",orderCreated:"Замовлення № 130",orderActive:"Замовлення № 130",orderReport:`Замовлення № ${orderId}`};
  const submitProfile=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();notify("Профіль успішно збережено")};
  return <main className="customer-shell"><aside className="customer-sidebar"><a className="customer-brand" href="/customer/orders"><span className="customer-brand-logo"><img src="/logo.png" alt="" /></span><strong>VanGo</strong></a><CustomerNav view={view}/><div className="customer-sidebar-foot"><a className="customer-sidebar-profile" href="/customer/settings" aria-label="Відкрити налаштування профілю"><span className="mini-avatar">РС</span><p><strong>Сергій Рябенко</strong><small>Замовник</small></p></a></div></aside><section className="customer-workspace"><Header title={titles[view]}/><div className={`customer-content ${view==="profile"?"profile-content":""}`}>
    {view==="create"&&<><div className="create-choice-intro"><span>Нове замовлення</span><h2>Яке перевезення потрібне?</h2></div><div className="transport-types"><a href="/customer/create/local" className="customer-card"><span className="type-icon local"><VIcon name="clock" size={28}/></span><div><h3>Місцеве перевезення</h3><ul><li>Водії запропонують ціну та умови</li><li>Місто та передмістя</li><li>Погодинна оплата</li></ul></div><VIcon name="chevron"/></a><a href="/customer/create/long-distance" className="customer-card"><span className="type-icon long"><VIcon name="trail-sign" size={28}/></span><div><h3>Далеке перевезення</h3><ul><li>Ви пропонуєте ціну або обираєте «Договірна»</li><li>Для маршрутів поза містом</li></ul></div><VIcon name="chevron"/></a></div></>}
    {view==="createLocal"&&<><div className="customer-page-intro"><div><h2>Створити місцеве перевезення</h2></div></div><CreateForm longDistance={false}/></>}
    {view==="createLong"&&<><div className="customer-page-intro"><div><h2>Створити далеке перевезення</h2></div></div><CreateForm longDistance/></>}
    {view==="orders"&&<><div className="customer-page-intro"><div><h2>Мої замовлення</h2></div><a className="customer-primary" href="/customer/create"><VIcon name="plus" size={19}/>Створити замовлення</a></div><section className="customer-card orders-empty-card"><div className="customer-tabs">{["В роботі","Створено","Історія"].map(i=><button key={i} className={tab===i?"active":""} onClick={()=>setTab(i)}>{i}<span>{i==="Історія"?0:1}</span></button>)}</div>{tab==="Створено"?<a className="created-order-row" href="/customer/orders/130"><div><span className="big-status green">Створено</span><h3>Замовлення № 130</h3><p>Черкаси → Черкаси</p></div><div><span>Водій</span><strong>Ще не призначено</strong></div><div><span>Оновлення</span><strong>1 пропозиція</strong></div><div><span>Сума</span><strong>450 грн</strong></div><VIcon name="chevron"/></a>:tab==="В роботі"?<a className="created-order-row" href="/customer/orders/130/active"><div><span className="big-status blue">Водій в дорозі</span><h3>Замовлення № 130</h3><p>Черкаси → Черкаси</p></div><div><span>Водій</span><strong>Рябенко Сергій</strong></div><div><span>Оновлення</span><strong>Прибуде до 30 хв</strong></div><div><span>Сума</span><strong>450 грн</strong></div><VIcon name="chevron"/></a>:<div className="customer-empty compact"><span className="empty-illustration"><VIcon name="case" size={32}/></span><h3>Історія поки порожня</h3></div>}</section></>}
    {view==="reports"&&<Reports/>}
    {view==="orderCreated"&&<OrderDetail active={false}/>} {view==="orderActive"&&<OrderDetail active/>} {view==="orderReport"&&<ReportOrderDetail orderId={orderId}/>} {view==="notifications"&&<Notifications role="customer"/>} {view==="support"&&<Support notify={notify}/>}
    {view==="settings"&&<><div className="customer-page-intro"><div><h2>Налаштування</h2></div></div><div className="settings-grid"><section className="customer-card profile-summary"><div className="large-avatar">РС</div><div className="profile-name"><h3>Сергій Рябенко</h3><p><span>★</span> 5.0 <b>✓ 4</b></p><small>+380504233382</small></div><a className="profile-edit-link" href="/customer/profile"><VIcon name="edit"/><span><strong>Редагувати профіль</strong><small>Особисті дані та контакти</small></span><VIcon name="chevron"/></a></section><div className="settings-side"><section className="customer-card role-card"><div className="role-icon"><VIcon name="user"/></div><div><strong>Замовник</strong><p>Створюйте та керуйте своїми замовленнями.</p></div></section><section className="customer-card account-mode"><h3>Режим облікового запису</h3><div className="mode-switch"><button className="active"><VIcon name="user"/>Замовник</button><a href="/driver/settings"><VIcon name="car"/>Водій</a></div><p>Після перемикання зміняться доступні сторінки та можливості.</p></section><button className="logout-button" onClick={()=>notify("Вихід із демонстраційного кабінету")}><VIcon name="logout"/>Вийти</button><p className="version">Версія 1.0.18</p></div></div></>}
    {view==="profile"&&<><a href="/customer/settings" className="back-link"><VIcon name="arrow"/>До налаштувань</a><div className="customer-page-intro"><div><h2>Мій профіль</h2></div></div><form className="customer-card profile-form" onSubmit={submitProfile}><section><div><h3>Особисті дані</h3><p>Ім’я відображається водіям у ваших замовленнях</p></div><div className="profile-form-grid"><label>Прізвище<input defaultValue="Рябенко"/></label><label>Ім’я<input defaultValue="Сергій"/></label><label>По батькові<input placeholder="Не вказано"/></label></div></section><section><div><h3>Контакти</h3><p>Номер використовується для зв’язку</p></div><div className="profile-form-grid one"><label>Номер телефону<input defaultValue="+380504233382"/></label></div></section><section><div><h3>Фото профілю</h3><p>Додайте селфі, щоб вас було простіше впізнати</p></div><div className="photo-actions"><button type="button"><VIcon name="upload"/>Завантажити фото</button><button type="button">Зробити фото</button></div></section><div className="profile-form-actions"><a href="/customer/settings">Скасувати</a><button className="customer-primary">Зберегти зміни</button></div></form></>}
  </div><div className="customer-mobile-nav"><CustomerNav view={view}/></div></section>{toast&&<div className="customer-toast"><span>✓</span>{toast}</div>}</main>;
}
