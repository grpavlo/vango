"use client";

import { Fragment, FormEvent, useEffect, useMemo, useState } from "react";
import { ThemeToggle } from "./customer/customer-portal";
import { VIcon } from "./customer/v-icon";

type Role = "CUSTOMER" | "DRIVER" | "BOTH" | "ADMIN" | "ANALYST";
type AuthKind = "user" | "portal-admin";
type LoginScope = "user" | "admin";

type UserProfile = {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  patronymic?: string;
  role?: Role;
  isAdmin?: boolean;
  blocked?: boolean;
  groupId?: number | null;
  group?: { id: number; name: string } | null;
  selfiePhoto?: string | null;
  driverRating?: number;
  customerRating?: number;
  rating?: number;
  driverCompletedOrders?: number;
  customerCompletedOrders?: number;
};

type PortalAdminProfile = {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  patronymic?: string;
  selfiePhoto?: string | null;
  photo?: string | null;
  avatarUrl?: string | null;
  linkedUser?: UserProfile | null;
  isPortalAdmin: true;
};

type Order = {
  id: number;
  orderNumber?: number;
  status?: string;
  pickupCity?: string;
  pickupLocation?: string;
  pickupAddress?: string;
  dropoffCity?: string;
  dropoffLocation?: string;
  dropoffAddress?: string;
  cargoType?: string;
  price?: number;
  finalPrice?: number;
  updatedAt?: string;
  createdAt?: string;
  customer?: UserProfile;
  driver?: UserProfile;
  responseCount?: number;
};

type AnalyticsOverview = {
  periodDays?: number;
  gmv?: { period?: { value?: number }; allTime?: number };
  activeUsers?: { dau?: number; mau?: number; dauToMauPercent?: number };
  liquidity?: { foundDriverPercent?: number; responsesPerOrder?: number; avgTimeToCloseHours?: number };
  retention?: { driversTotal?: number; retention7d?: { percent?: number }; retention30d?: { percent?: number } };
};

type AdminGroup = {
  id: number;
  name: string;
  photo?: string | null;
  users?: UserProfile[];
};

type PortalAdminItem = {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  active?: boolean;
  createdAt?: string;
  linkedUser?: UserProfile | null;
};

type SupportQuestionItem = {
  id: number;
  question?: string;
  answer?: string | null;
  status?: "OPEN" | "ANSWERED" | string;
  photos?: string[] | string | null;
  createdAt?: string;
  answeredAt?: string | null;
  user?: UserProfile | null;
};

type OrderReportRow = Order & {
  revenue?: number;
  roadDistanceKm?: number | null;
  totalDurationMinutes?: number | null;
  cargoDurationMinutes?: number | null;
  acceptedAt?: string | null;
  receivedAt?: string | null;
  completedAt?: string | null;
  deliveredAt?: string | null;
  customerRating?: number | null;
  customerRatingComment?: string | null;
  customerRatingCreatedAt?: string | null;
};

type DriverReportRow = {
  driverId?: number | null;
  driver?: UserProfile | null;
  orderCount?: number;
  completedCount?: number;
  activeCount?: number;
  cancelledCount?: number;
  totalRevenue?: number;
  totalDistanceKm?: number;
  totalDurationMinutes?: number | null;
  totalCargoDurationMinutes?: number | null;
  avgDistanceKm?: number | null;
  avgTotalDurationMinutes?: number | null;
  avgCargoDurationMinutes?: number | null;
};

type OrderAnalyticsReport = {
  generatedAt?: string;
  period?: { from?: string; to?: string; days?: number };
  drivers?: UserProfile[];
  driverRows?: DriverReportRow[];
  orderRows?: OrderReportRow[];
  customerRatings?: {
    count?: number;
    average?: number | null;
    buckets?: { five?: number; four?: number; threeOrLess?: number };
  };
};

type AdminTab = "overview" | "reports" | "users" | "groups" | "admins" | "support" | "account";
type ReportPeriod = "currentMonth" | "previousMonth" | "last7" | "last30" | "last90" | "custom";

const ADMIN_TABS: { id: AdminTab; label: string; icon: string }[] = [
  { id: "overview", label: "Огляд", icon: "eye" },
  { id: "reports", label: "Звіти", icon: "chart" },
  { id: "users", label: "Користувачі", icon: "user" },
  { id: "groups", label: "Групи", icon: "case" },
  { id: "admins", label: "Адміни", icon: "shield" },
  { id: "support", label: "Звернення", icon: "headset" },
];

type Session = {
  token: string;
  kind: AuthKind;
  profile: UserProfile | PortalAdminProfile;
};

const TOKEN_KEY = "vango.webUserPortal.token";
const KIND_KEY = "vango.webUserPortal.kind";
const PORTAL_AUTO_REFRESH_MS = 10000;

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function isAuthError(err: unknown) {
  return err instanceof ApiError && err.status === 401;
}

function clearStoredSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(KIND_KEY);
}

async function apiFetch<T>(path: string, token?: string, options: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const message = (await response.text()).trim();
    throw new ApiError(message || `HTTP ${response.status}`, response.status);
  }

  if (response.status === 204) return null as T;
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : ((await response.text()) as T);
}

function asArray<T>(value: T[] | unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function isTechnicalDisplayName(value?: string | null) {
  return /^(user|portal)_\d+@vango\.(phone|admin)$/i.test(String(value || "").trim());
}

function profileFullName(profile?: Pick<UserProfile, "firstName" | "lastName" | "patronymic"> | null) {
  return [profile?.lastName, profile?.firstName, profile?.patronymic].filter(Boolean).join(" ").trim();
}

function displayName(profile?: UserProfile | PortalAdminProfile | null) {
  const linkedUser = "linkedUser" in (profile || {}) ? (profile as PortalAdminProfile).linkedUser : null;
  const linkedName = linkedUser ? displayName(linkedUser) : "";
  const fullName = profileFullName(profile);
  const name = String(profile?.name || "").trim();
  if (linkedName) return linkedName;
  if (fullName) return fullName;
  if (name && !isTechnicalDisplayName(name)) return name;
  return profile?.phone || profile?.email || "Користувач VanGo";
}

function initials(profile?: UserProfile | PortalAdminProfile | null) {
  const source = displayName(profile);
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "V") + (parts[1]?.[0] || "G");
}

function normalizeProfilePhotoUrl(photo?: string | null) {
  const value = String(photo || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("blob:") || value.startsWith("data:")) return value;
  if (value.startsWith("/uploads/")) return value;
  if (value.includes("\\uploads\\")) return `/uploads/${value.split("\\uploads\\").pop()}`;
  if (value.includes("/uploads/")) return `/uploads/${value.split("/uploads/").pop()}`;
  return value.startsWith("/") ? value : `/uploads/${value}`;
}

function profilePhoto(profile?: UserProfile | PortalAdminProfile | null) {
  const candidate = profile as { selfiePhoto?: string | null; photo?: string | null; avatarUrl?: string | null } | null | undefined;
  return normalizeProfilePhotoUrl(candidate?.selfiePhoto || candidate?.photo || candidate?.avatarUrl || "");
}

function PortalAvatar({ profile, className }: { profile?: (UserProfile | PortalAdminProfile) | null; className: string }) {
  const [failed, setFailed] = useState(false);
  const photo = failed ? "" : profilePhoto(profile);
  return <span className={className}>{photo ? <img src={photo} alt={displayName(profile)} onError={() => setFailed(true)}/> : initials(profile)}</span>;
}

function money(value: unknown) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return `${Math.round(num).toLocaleString("uk-UA")} грн`;
}

function number(value: unknown, suffix = "") {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return `${num.toLocaleString("uk-UA")}${suffix}`;
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getReportRange(period: ReportPeriod, now = new Date()) {
  const end = new Date(now);
  const start = new Date(now);
  if (period === "currentMonth") {
    start.setDate(1);
  } else if (period === "previousMonth") {
    start.setMonth(start.getMonth() - 1, 1);
    end.setDate(0);
  } else if (period === "last7") {
    start.setDate(start.getDate() - 6);
  } else if (period === "last90") {
    start.setDate(start.getDate() - 89);
  } else {
    start.setDate(start.getDate() - 29);
  }
  return { from: toDateInputValue(start), to: toDateInputValue(end) };
}

function roleLabel(role?: string) {
  const labels: Record<string, string> = {
    ADMIN: "Адмін",
    ANALYST: "Аналітик",
    DRIVER: "Водій",
    CUSTOMER: "Замовник",
    BOTH: "Замовник і водій",
  };
  return role ? labels[role] || role : "-";
}

function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    CREATED: "Створено",
    PRICE_UPDATED: "Ціну змінено",
    ACCEPTED: "Прийнято",
    IN_PROGRESS: "В дорозі",
    DELIVERED: "Доставлено",
    COMPLETED: "Завершено",
    PENDING: "Очікує",
    CANCELLED: "Скасовано",
    REJECTED: "Відхилено",
  };
  return status ? labels[status] || status : "-";
}

function supportStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    OPEN: "Відкрите",
    ANSWERED: "Відповіли",
  };
  return status ? labels[status] || status : "-";
}

function supportPhotos(value?: SupportQuestionItem["photos"]) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [trimmed];
  } catch {
    return [trimmed];
  }
}

function routeText(order: Order) {
  const from = order.pickupCity || order.pickupLocation || "Звідки";
  const to = order.dropoffCity || order.dropoffLocation || "Куди";
  return `${from} -> ${to}`;
}

function minutes(value?: number | null) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  if (num < 60) return `${Math.round(num)} хв`;
  return `${Math.round(num / 60)} год`;
}

function minutesBetweenDates(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diff = endDate.getTime() - startDate.getTime();
  if (!Number.isFinite(diff) || diff < 0) return null;
  return Math.round(diff / 60000);
}

function orderTotalMinutes(order: OrderReportRow) {
  const value = Number(order.totalDurationMinutes);
  if (Number.isFinite(value) && value > 0) return value;
  return minutesBetweenDates(order.createdAt, order.completedAt || order.deliveredAt || order.updatedAt);
}

function orderCargoMinutes(order: OrderReportRow) {
  const value = Number(order.cargoDurationMinutes);
  if (Number.isFinite(value) && value > 0) return value;
  return minutesBetweenDates(order.receivedAt || order.acceptedAt || order.createdAt, order.deliveredAt || order.completedAt || order.updatedAt);
}

function dayKey(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function dayLabel(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("uk-UA", { weekday: "short" }).replace(".", "");
}

function percent(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function groupInitials(name?: string) {
  return String(name || "?").trim().slice(0, 2).toUpperCase();
}

function canBlockUser(user: UserProfile) {
  return user.role === "DRIVER" || user.role === "BOTH";
}

function isUserProfile(profile?: Session["profile"] | null): profile is UserProfile {
  return Boolean(profile && !("isPortalAdmin" in profile));
}

function hasAdminAccess(session: Session | null) {
  return session?.kind === "portal-admin";
}

function hasAnalyticsAccess(session: Session | null) {
  return hasAdminAccess(session);
}

function usePortalData(session: Session | null, onAuthExpired?: () => void) {
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(silent = false) {
    if (!session) return;
    if (!silent) setLoading(true);
    if (!silent) setError("");
    try {
      if (session.kind === "user") {
        const orders = await apiFetch<Order[]>("/orders/my", session.token).catch(() => []);
        setMyOrders(asArray<Order>(orders));
      } else {
        setMyOrders([]);
      }

      if (hasAdminAccess(session)) {
        const [orders, usersResult, analyticsResult] = await Promise.all([
          apiFetch<Order[]>("/admin/orders?limit=120&status=ALL", session.token),
          apiFetch<UserProfile[]>("/admin/users", session.token),
          apiFetch<AnalyticsOverview>("/admin/analytics/overview?days=30", session.token),
        ]);
        setAdminOrders(asArray<Order>(orders));
        setUsers(asArray<UserProfile>(usersResult));
        setAnalytics(analyticsResult);
      } else {
        setAdminOrders([]);
        setUsers([]);
        setAnalytics(null);
      }
    } catch (err) {
      if (isAuthError(err)) {
        onAuthExpired?.();
        return;
      }
      if (silent) return;
      setError(err instanceof Error ? err.message : "Не вдалося завантажити дані");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [session?.token, session?.kind]);

  useEffect(() => {
    if (!session?.token) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, PORTAL_AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [session?.token, session?.kind]);

  return { myOrders, adminOrders, users, analytics, loading, error, reload: load };
}

function LoginPanel({ onLogin }: { onLogin: (session: Session) => void }) {
  const [scope, setScope] = useState<LoginScope>("user");
  const [phone, setPhone] = useState("+380");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const authBase = scope === "admin" ? "/admin-auth" : "/auth";

  async function sendCode() {
    setLoading(true);
    setMessage("");
    try {
      const result = await apiFetch<{ devCode?: string | number; smsSkipped?: boolean }>(`${authBase}/send-code`, undefined, {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      if (result?.devCode) {
        setCode(String(result.devCode));
        setMessage(`Тестовий код: ${result.devCode}`);
        return;
      }
      setMessage("SMS-код надіслано");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не вдалося надіслати SMS");
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const loginResult = await apiFetch<{ token: string }>(`${authBase}/verify-code`, undefined, {
        method: "POST",
        body: JSON.stringify({ phone, code }),
      });

      const kind: AuthKind = scope === "admin" ? "portal-admin" : "user";
      const profilePath = kind === "portal-admin" ? "/admin-auth/me" : "/auth/me";
      const profile = await apiFetch<UserProfile | PortalAdminProfile>(profilePath, loginResult.token);
      window.localStorage.setItem(TOKEN_KEY, loginResult.token);
      window.localStorage.setItem(KIND_KEY, kind);
      onLogin({ token: loginResult.token, kind, profile });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не вдалося увійти");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="portal-auth">
      <section className="portal-auth-card">
        <div className="portal-auth-brand">
          <img src="/logo.png" alt="VanGo" />
          <div>
            <small>{scope === "admin" ? "Вхід адміністратора" : "Єдиний веб-портал"}</small>
          </div>
        </div>
        <form onSubmit={submit}>
          <label>Телефон<input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" inputMode="tel" autoComplete="tel" /></label>
          <label>SMS-код<div className="portal-code-row"><input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" maxLength={6} /><button type="button" onClick={sendCode} disabled={loading}>Надіслати</button></div></label>

          <button className="portal-primary" disabled={loading}>{loading ? "Зачекайте..." : "Увійти"}</button>
          {message && <p className="portal-form-message">{message}</p>}
          <button type="button" className="portal-admin-login-link" onClick={() => { setScope(scope === "admin" ? "user" : "admin"); setCode(""); setMessage(""); }}>
            {scope === "admin" ? "Увійти як користувач" : "Ввійти як адміністратор"}
          </button>
        </form>
      </section>
    </main>
  );
}

function StatCard({ icon, label, value, note, tone = "green" }: { icon: string; label: string; value: string; note: string; tone?: "green" | "blue" | "orange" | "dark" }) {
  return (
    <article className="portal-stat">
      <span className={`portal-stat-icon ${tone}`}><VIcon name={icon} /></span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <span>{note}</span>
      </div>
    </article>
  );
}

function PortalRoleChoice({ profile, myOrdersCount, completedCount, rating }: { profile: Session["profile"]; myOrdersCount: number; completedCount?: number; rating?: number }) {
  return (
    <>
      <section className="portal-role-hero">
        <div>
          <PortalAvatar profile={profile} className="portal-avatar" />
          <div>
            <small>Головний екран</small>
            <h2>{displayName(profile)}</h2>
            <p>Оберіть, у якому кабінеті працювати зараз.</p>
          </div>
        </div>
        <span>{isUserProfile(profile) ? roleLabel(profile.role) : "Користувач"}</span>
      </section>
      <div className="portal-role-grid">
        <a className="portal-role-card customer" href="/customer/orders">
          <span><VIcon name="user" /></span>
          <div>
            <small>Кабінет замовника</small>
            <strong>Створювати та керувати замовленнями</strong>
            <p>{number(myOrdersCount)} замовлень у цьому акаунті</p>
          </div>
          <em><VIcon name="chevron" /></em>
        </a>
        <a className="portal-role-card driver" href="/driver/map">
          <span><VIcon name="car" /></span>
          <div>
            <small>Кабінет водія</small>
            <strong>Шукати перевезення та вести роботу</strong>
            <p>★ {number(rating)} · ✓ {number(completedCount)} завершених</p>
          </div>
          <em><VIcon name="chevron" /></em>
        </a>
      </div>
    </>
  );
}

function OrdersTable({ title, orders, emptyText }: { title: string; orders: Order[]; emptyText: string }) {
  return (
    <section className="portal-panel">
      <div className="portal-panel-head">
        <div>
          <h2>{title}</h2>
          <p>{orders.length} записів</p>
        </div>
      </div>
      <div className="portal-table-wrap">
        <table className="portal-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Маршрут</th>
              <th>Статус</th>
              <th>Сума</th>
              <th>Оновлено</th>
            </tr>
          </thead>
          <tbody>
            {orders.length ? orders.slice(0, 12).map((order) => (
              <tr key={order.id}>
                <td><strong>{order.orderNumber || order.id}</strong></td>
                <td><span>{routeText(order)}</span><small>{order.cargoType || order.pickupAddress || order.dropoffAddress || "-"}</small></td>
                <td><b className="portal-status">{statusLabel(order.status)}</b></td>
                <td>{money(order.finalPrice ?? order.price)}</td>
                <td>{formatDate(order.updatedAt || order.createdAt)}</td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="portal-empty-cell">{emptyText}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AdminSection({
  session,
  orders,
  users,
  analytics,
  onReload,
  tab,
  onSessionChange,
  onAuthExpired,
}: {
  session: Session;
  orders: Order[];
  users: UserProfile[];
  analytics: AnalyticsOverview | null;
  onReload: () => void;
  tab: AdminTab;
  onSessionChange: (session: Session) => void;
  onAuthExpired: () => void;
}) {
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [portalAdmins, setPortalAdmins] = useState<PortalAdminItem[]>([]);
  const [supportQuestions, setSupportQuestions] = useState<SupportQuestionItem[]>([]);
  const [report, setReport] = useState<OrderAnalyticsReport | null>(null);
  const initialReportRange = useMemo(() => getReportRange("currentMonth"), []);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("currentMonth");
  const [reportDateFrom, setReportDateFrom] = useState(initialReportRange.from);
  const [reportDateTo, setReportDateTo] = useState(initialReportRange.to);
  const [reportDriverId, setReportDriverId] = useState("ALL");
  const [orderDriverFilterId, setOrderDriverFilterId] = useState("ALL");
  const [search, setSearch] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupPhoto, setGroupPhoto] = useState<File | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [activeSupportQuestionId, setActiveSupportQuestionId] = useState<number | null>(null);
  const [supportStatusFilter, setSupportStatusFilter] = useState("ALL");
  const [supportAnswer, setSupportAnswer] = useState("");
  const [supportAnswerStatus, setSupportAnswerStatus] = useState("ANSWERED");
  const [expandedDriverId, setExpandedDriverId] = useState<string>("");
  const [adminPhone, setAdminPhone] = useState("+380");
  const [loadingTools, setLoadingTools] = useState(false);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [switchingToUser, setSwitchingToUser] = useState(false);

  const activeOrders = orders.filter((order) => !["COMPLETED", "CANCELLED", "REJECTED"].includes(order.status || "")).length;
  const drivers = users.filter((user) => user.role === "DRIVER" || user.role === "BOTH").length;
  const blocked = users.filter((user) => user.blocked).length;
  const normalizedSearch = search.trim().toLowerCase();

  function matches(values: unknown[]) {
    if (!normalizedSearch) return true;
    return values.some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
  }

  const filteredUsers = users.filter((user) =>
    matches([user.id, user.name, user.phone, user.email, roleLabel(user.role), user.group?.name, user.blocked ? "заблоковано" : "активний"])
  );
  const filteredGroups = groups.filter((group) => matches([group.id, group.name, group.users?.length]));
  const filteredAdmins = portalAdmins.filter((admin) =>
    matches([admin.id, admin.name, admin.phone, admin.email, admin.active ? "активний" : "вимкнено", admin.linkedUser?.name])
  );
  const filteredSupportQuestions = supportQuestions
    .filter((item) => supportStatusFilter === "ALL" || item.status === supportStatusFilter)
    .filter((item) =>
      matches([item.id, item.question, item.answer, supportStatusLabel(item.status), item.user?.name, item.user?.phone, item.user?.email, item.user?.role])
    );
  const openSupportCount = supportQuestions.filter((item) => item.status === "OPEN").length;
  const activeSupportQuestion = activeSupportQuestionId
    ? supportQuestions.find((item) => Number(item.id) === Number(activeSupportQuestionId)) || null
    : null;
  const orderRows = asArray<OrderReportRow>(report?.orderRows).filter((order) =>
    matches([order.id, order.orderNumber, routeText(order), statusLabel(order.status), order.customer?.name, order.driver?.name, order.cargoType])
  );
  const driverRows = asArray<DriverReportRow>(report?.driverRows).filter((row) =>
    matches([row.driverId, row.driver?.name, row.driver?.phone, row.orderCount, row.completedCount])
  );
  const userRatingsById = new Map(users.map((user) => [Number(user.id), Number(user.rating)]));
  const reportDriverOptions = asArray<UserProfile>(report?.drivers).length
    ? asArray<UserProfile>(report?.drivers)
    : users.filter((user) => user.role === "DRIVER" || user.role === "BOTH");
  const selectedOrderRows = orderDriverFilterId === "ALL"
    ? orderRows
    : orderRows.filter((order) => String(order.driver?.id || "") === orderDriverFilterId);
  const activeOrderDriver = orderDriverFilterId === "ALL"
    ? null
    : reportDriverOptions.find((driver) => String(driver.id) === orderDriverFilterId)
      || driverRows.find((row) => String(row.driverId || "") === orderDriverFilterId)?.driver
      || selectedOrderRows[0]?.driver
      || null;
  const completedOrderRows = orderRows.filter((order) => ["DELIVERED", "COMPLETED"].includes(order.status || ""));
  const reportCompletionRate = orderRows.length ? Math.round((completedOrderRows.length / orderRows.length) * 100) : 0;
  const reportDistanceKm = orderRows.reduce((sum, order) => sum + (Number(order.roadDistanceKm) || 0), 0);
  const reportDurations = completedOrderRows
    .map((order) => orderTotalMinutes(order))
    .filter((value): value is number => Number.isFinite(value) && Number(value) > 0);
  const reportAvgDuration = reportDurations.length
    ? Math.round(reportDurations.reduce((sum, value) => sum + value, 0) / reportDurations.length)
    : null;
  const dailyReportMap = new Map<string, { key: string; label: string; count: number; revenue: number }>();
  completedOrderRows.forEach((order) => {
    const dateValue = order.completedAt || order.deliveredAt || order.updatedAt || order.createdAt;
    const key = dayKey(dateValue);
    if (!key) return;
    const current = dailyReportMap.get(key) || { key, label: dayLabel(dateValue), count: 0, revenue: 0 };
    current.count += 1;
    current.revenue += Number(order.revenue ?? order.finalPrice ?? order.price) || 0;
    dailyReportMap.set(key, current);
  });
  const dailyReportRows = [...dailyReportMap.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-14);
  const maxDailyCount = Math.max(1, ...dailyReportRows.map((row) => row.count));
  const totalCompletedRevenue = completedOrderRows.reduce((sum, order) => sum + (Number(order.revenue ?? order.finalPrice ?? order.price) || 0), 0);
  const ratingSummary = report?.customerRatings;
  const ratingValues = asArray<OrderReportRow>(report?.orderRows)
    .map((order) => Number(order.customerRating))
    .filter((value) => Number.isFinite(value) && value > 0);
  const driverRatingValues = driverRows
    .map((row) => Number(row.driver?.rating ?? userRatingsById.get(Number(row.driverId))))
    .filter((value) => Number.isFinite(value) && value > 0);
  const displayRatingValues = ratingValues.length ? ratingValues : driverRatingValues;
  const ratingCount = Number(ratingSummary?.count || ratingValues.length || driverRatingValues.length) || 0;
  const ratingAverage = Number(
    ratingSummary?.average
      || (displayRatingValues.length ? displayRatingValues.reduce((sum, value) => sum + value, 0) / displayRatingValues.length : 0)
  );
  const ratingBuckets = {
    five: Number(ratingSummary?.buckets?.five || ratingValues.filter((value) => value >= 5).length || driverRatingValues.filter((value) => value >= 4.75).length) || 0,
    four: Number(ratingSummary?.buckets?.four || ratingValues.filter((value) => value >= 4 && value < 5).length || driverRatingValues.filter((value) => value >= 4 && value < 4.75).length) || 0,
    threeOrLess: Number(ratingSummary?.buckets?.threeOrLess || ratingValues.filter((value) => value < 4).length || driverRatingValues.filter((value) => value < 4).length) || 0,
  };

  function getDriverOrders(row: DriverReportRow) {
    const driverId = Number(row.driverId);
    if (!Number.isFinite(driverId) || driverId <= 0) {
      return orderRows.filter((order) => !order.driver?.id);
    }
    return orderRows.filter((order) => Number(order.driver?.id) === driverId);
  }

  function getDriverRating(row: DriverReportRow) {
    const ratings = getDriverOrders(row)
      .map((order) => Number(order.customerRating))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (ratings.length) return (ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1);
    const profileRating = Number(row.driver?.rating ?? userRatingsById.get(Number(row.driverId)));
    return Number.isFinite(profileRating) && profileRating > 0 ? profileRating.toFixed(1) : "-";
  }

  function getTopDirections(row: DriverReportRow) {
    const counts = new Map<string, number>();
    getDriverOrders(row).forEach((order) => {
      const direction = routeText(order);
      counts.set(direction, (counts.get(direction) || 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "uk"))
      .slice(0, 3)
      .map(([direction]) => direction);
  }

  function driverKey(row: DriverReportRow, index = 0) {
    return String(row.driverId ?? `unassigned-${index}`);
  }

  const activeGroup = activeGroupId ? groups.find((group) => Number(group.id) === Number(activeGroupId)) || null : null;
  const activeGroupMemberIds = new Set((activeGroup?.users || []).map((user) => Number(user.id)));
  const normalizedMemberSearch = memberSearch.trim().toLowerCase();
  const groupMembers = [...(activeGroup?.users || [])].sort((a, b) => displayName(a).localeCompare(displayName(b), "uk"));
  const availableGroupUsers = users
    .filter((user) => !activeGroupMemberIds.has(Number(user.id)))
    .filter((user) => !user.group?.id && !user.groupId)
    .filter((user) => {
      if (!normalizedMemberSearch) return true;
      return [user.id, user.name, user.phone, user.email, roleLabel(user.role)]
        .some((value) => String(value || "").toLowerCase().includes(normalizedMemberSearch));
    })
    .slice(0, 30);

  function getReportQuery() {
    const params = new URLSearchParams();
    const from = new Date(reportDateFrom);
    const to = new Date(reportDateTo);
    const days = Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())
      ? 30
      : Math.max(1, Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1);
    params.set("days", String(days));
    if (reportDateFrom) params.set("dateFrom", reportDateFrom);
    if (reportDateTo) params.set("dateTo", reportDateTo);
    if (reportDriverId !== "ALL") params.set("driverId", reportDriverId);
    return params.toString();
  }

  async function loadAdminTools(silent = false) {
    if (!silent) setLoadingTools(true);
    try {
      const reportQuery = getReportQuery();
      const [groupsResult, adminsResult, supportResult, reportResult] = await Promise.all([
        apiFetch<AdminGroup[]>("/admin/groups", session.token),
        apiFetch<PortalAdminItem[]>("/admin/portal-admins", session.token),
        apiFetch<SupportQuestionItem[]>("/admin/support-questions?limit=300", session.token),
        apiFetch<OrderAnalyticsReport>(`/admin/analytics/order-report?${reportQuery}`, session.token),
      ]);
      setGroups(asArray<AdminGroup>(groupsResult));
      setPortalAdmins(asArray<PortalAdminItem>(adminsResult));
      setSupportQuestions(asArray<SupportQuestionItem>(supportResult));
      setReport(reportResult);
    } catch (err) {
      if (isAuthError(err)) {
        onAuthExpired();
        return;
      }
      if (silent) return;
      setMessage(err instanceof Error ? err.message : "Не вдалося завантажити службові дані");
    } finally {
      if (!silent) setLoadingTools(false);
    }
  }

  async function reloadEverything() {
    await Promise.all([loadAdminTools(), Promise.resolve(onReload())]);
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = groupName.trim();
    if (!name) {
      setMessage("Вкажіть назву групи");
      return;
    }
    setSaving("group");
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("name", name);
      if (groupPhoto) formData.append("photo", groupPhoto);
      await apiFetch<AdminGroup>("/admin/groups", session.token, {
        method: "POST",
        body: formData,
      });
      setGroupName("");
      setGroupPhoto(null);
      setMessage("Групу створено");
      await reloadEverything();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не вдалося створити групу");
    } finally {
      setSaving("");
    }
  }

  async function deleteGroup(id: number) {
    if (!window.confirm("Видалити групу? Користувачі залишаться без групи.")) return;
    setSaving(`group-${id}`);
    setMessage("");
    try {
      await apiFetch<{ deleted: boolean }>(`/admin/groups/${id}`, session.token, { method: "DELETE" });
      setMessage("Групу видалено");
      await reloadEverything();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не вдалося видалити групу");
    } finally {
      setSaving("");
    }
  }

  async function updateUserGroup(userId: number, groupId: string) {
    setSaving(`user-group-${userId}`);
    setMessage("");
    try {
      await apiFetch<UserProfile>(`/admin/users/${userId}/group`, session.token, {
        method: "PATCH",
        body: JSON.stringify({ groupId: groupId ? Number(groupId) : null }),
      });
      setMessage("Групу користувача оновлено");
      await reloadEverything();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не вдалося оновити групу користувача");
    } finally {
      setSaving("");
    }
  }

  async function addUserToActiveGroup(userId: number) {
    if (!activeGroup) return;
    await updateUserGroup(userId, String(activeGroup.id));
  }

  async function removeUserFromActiveGroup(userId: number) {
    await updateUserGroup(userId, "");
  }

  async function toggleBlocked(user: UserProfile) {
    const action = user.blocked ? "unblock" : "block";
    setSaving(`user-block-${user.id}`);
    setMessage("");
    try {
      await apiFetch<UserProfile>(`/admin/users/${user.id}/${action}`, session.token, { method: "POST" });
      setMessage(user.blocked ? "Користувача розблоковано" : "Користувача заблоковано");
      await reloadEverything();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не вдалося змінити статус користувача");
    } finally {
      setSaving("");
    }
  }

  async function createPortalAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const phone = adminPhone.trim();
    if (!phone) {
      setMessage("Вкажіть телефон адміністратора");
      return;
    }
    setSaving("admin");
    setMessage("");
    try {
      await apiFetch<PortalAdminItem>("/admin/portal-admins", session.token, {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setAdminPhone("+380");
      setMessage("Адміністратора додано");
      await reloadEverything();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не вдалося додати адміністратора");
    } finally {
      setSaving("");
    }
  }

  async function togglePortalAdmin(admin: PortalAdminItem) {
    setSaving(`admin-${admin.id}`);
    setMessage("");
    try {
      await apiFetch<PortalAdminItem>(`/admin/portal-admins/${admin.id}`, session.token, {
        method: "PATCH",
        body: JSON.stringify({ active: !admin.active }),
      });
      setMessage(admin.active ? "Адміністратора вимкнено" : "Адміністратора увімкнено");
      await reloadEverything();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не вдалося змінити доступ адміністратора");
    } finally {
      setSaving("");
    }
  }

  function openSupportQuestion(item: SupportQuestionItem) {
    setActiveSupportQuestionId(item.id);
    setSupportAnswer(item.answer || "");
    setSupportAnswerStatus(item.status === "OPEN" ? "ANSWERED" : item.status || "ANSWERED");
  }

  async function saveSupportAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeSupportQuestion) return;
    const answer = supportAnswer.trim();
    if (supportAnswerStatus === "ANSWERED" && !answer) {
      setMessage("Напишіть відповідь перед закриттям звернення");
      return;
    }
    setSaving(`support-${activeSupportQuestion.id}`);
    setMessage("");
    try {
      const updated = await apiFetch<SupportQuestionItem>(`/admin/support-questions/${activeSupportQuestion.id}`, session.token, {
        method: "PATCH",
        body: JSON.stringify({ answer, status: supportAnswerStatus }),
      });
      setSupportQuestions((items) => items.map((item) => (Number(item.id) === Number(updated.id) ? updated : item)));
      setActiveSupportQuestionId(null);
      setSupportAnswer("");
      setSupportAnswerStatus("ANSWERED");
      setMessage("Відповідь збережено");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не вдалося зберегти відповідь");
    } finally {
      setSaving("");
    }
  }

  async function switchToLinkedUser() {
    if (session.kind === "user") {
      window.location.href = "/customer/settings";
      return;
    }

    setSwitchingToUser(true);
    setMessage("");
    try {
      const result = await apiFetch<{ token: string; user: UserProfile }>("/admin-auth/switch-to-user", session.token, { method: "POST" });
      window.localStorage.setItem(TOKEN_KEY, result.token);
      window.localStorage.setItem(KIND_KEY, "user");
      onSessionChange({ token: result.token, kind: "user", profile: result.user });
      window.location.href = "/customer/settings";
    } catch (err) {
      if (isAuthError(err)) {
        onAuthExpired();
        return;
      }
      setMessage(err instanceof Error ? err.message : "Не вдалося перемкнутись на користувача");
    } finally {
      setSwitchingToUser(false);
    }
  }

  function changeReportPeriod(period: ReportPeriod) {
    setReportPeriod(period);
    if (period === "custom") return;
    const range = getReportRange(period);
    setReportDateFrom(range.from);
    setReportDateTo(range.to);
  }

  function changeReportDriver(driverId: string) {
    setReportDriverId(driverId);
    setOrderDriverFilterId(driverId);
    setExpandedDriverId("");
  }

  function toggleDriverDetails(row: DriverReportRow, key: string) {
    const isOpen = expandedDriverId === key;
    setExpandedDriverId(isOpen ? "" : key);
    setOrderDriverFilterId(isOpen ? reportDriverId : String(row.driverId || "ALL"));
  }

  useEffect(() => {
    loadAdminTools();
  }, [session.token, reportDriverId, reportDateFrom, reportDateTo]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !saving) void loadAdminTools(true);
    }, PORTAL_AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [session.token, reportDriverId, reportDateFrom, reportDateTo, saving]);

  useEffect(() => {
    if (activeGroupId && !groups.some((group) => Number(group.id) === Number(activeGroupId))) {
      setActiveGroupId(null);
    }
  }, [groups, activeGroupId]);

  return (
    <section className="portal-admin-area">
      {tab === "overview" && (
        <>
      <div className="portal-stats">
        <StatCard icon="list" label="Замовлення" value={number(orders.length)} note={`${activeOrders} активних`} tone="blue" />
        <StatCard icon="user" label="Користувачі" value={number(users.length)} note={`${drivers} водіїв`} tone="green" />
        <StatCard icon="case" label="Групи" value={number(groups.length)} note={`${blocked} заблоковано`} tone="orange" />
        <StatCard icon="money" label="GMV 30 днів" value={money(analytics?.gmv?.period?.value)} note={`MAU ${number(analytics?.activeUsers?.mau)}`} tone="dark" />
      </div>
        </>
      )}

      {tab !== "account" && (
        <div className="portal-admin-toolbar">
          <label>
            <span>Пошук</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ім'я, телефон, замовлення, група..." />
          </label>
          <button type="button" onClick={reloadEverything} disabled={loadingTools || Boolean(saving)}>
            <VIcon name="refresh" />{loadingTools ? "Завантаження" : "Оновити адмін-дані"}
          </button>
        </div>
      )}
      {message && <div className="portal-inline-message">{message}</div>}

      {tab === "account" && (
        <section className="portal-panel portal-account-panel">
          <div className="portal-account-card">
            <PortalAvatar profile={session.profile} className="portal-account-avatar" />
            <div>
              <small>Адмін порталу</small>
              <h2>{displayName(session.profile)}</h2>
              <p>{session.profile.phone || session.profile.email || "Контакти не вказані"}</p>
            </div>
          </div>
          <div className="portal-account-actions">
            <button type="button" className="portal-primary" onClick={switchToLinkedUser} disabled={switchingToUser}>
              <VIcon name="user" />{switchingToUser ? "Перемикання..." : "Перемкнутись на користувача"}
            </button>
            <p>Відкриється користувацький кабінет для акаунта, пов’язаного з цим адміністратором.</p>
          </div>
        </section>
      )}

      {tab === "overview" && (
        <div className="portal-analytics-grid" id="analytics">
          <section className="portal-panel">
            <div className="portal-panel-head"><div><h2>Аналітика</h2><p>Огляд marketplace за 30 днів</p></div></div>
            <div className="portal-metrics">
              <p><span>GMV весь час</span><strong>{money(analytics?.gmv?.allTime)}</strong></p>
              <p><span>DAU / MAU</span><strong>{number(analytics?.activeUsers?.dauToMauPercent, "%")}</strong></p>
              <p><span>Знайшли водія</span><strong>{number(analytics?.liquidity?.foundDriverPercent, "%")}</strong></p>
              <p><span>Відгуків на замовлення</span><strong>{number(analytics?.liquidity?.responsesPerOrder)}</strong></p>
              <p><span>Retention 7 днів</span><strong>{number(analytics?.retention?.retention7d?.percent, "%")}</strong></p>
              <p><span>Retention 30 днів</span><strong>{number(analytics?.retention?.retention30d?.percent, "%")}</strong></p>
            </div>
          </section>
          <OrdersTable title="Останні замовлення в базі" orders={orders} emptyText="У базі ще немає замовлень або API недоступний." />
        </div>
      )}

      {tab === "reports" && (
        <section className="portal-panel">
          <div className="portal-panel-head">
            <div>
              <h2>Звіти</h2>
              <p>Загальна інформація перебудовується після зміни фільтрів</p>
            </div>
          </div>
          <div className="portal-report-filter-card">
            <div className="portal-report-filter-title">
              <span><VIcon name="chart" /></span>
              <div>
                <h3>Параметри звіту</h3>
                <p>Дані перебудовуються після зміни фільтрів</p>
              </div>
            </div>
            <label>
              <span>Водії</span>
              <select value={reportDriverId} onChange={(event) => changeReportDriver(event.target.value)}>
                <option value="ALL">Усі водії</option>
                {reportDriverOptions.map((driver) => (
                  <option key={driver.id} value={driver.id}>{displayName(driver)}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Період</span>
              <select value={reportPeriod} onChange={(event) => changeReportPeriod(event.target.value as ReportPeriod)}>
                <option value="currentMonth">Поточний місяць</option>
                <option value="previousMonth">Попередній місяць</option>
                <option value="last7">Останні 7 днів</option>
                <option value="last30">Останні 30 днів</option>
                <option value="last90">Останні 90 днів</option>
                <option value="custom">Власний період</option>
              </select>
            </label>
            <label>
              <span>Дата з</span>
              <input type="date" value={reportDateFrom} onChange={(event) => { setReportPeriod("custom"); setReportDateFrom(event.target.value); }} />
            </label>
            <label>
              <span>Дата по</span>
              <input type="date" value={reportDateTo} onChange={(event) => { setReportPeriod("custom"); setReportDateTo(event.target.value); }} />
            </label>
          </div>
          <div className="portal-report-summary-grid">
            <article>
              <span className="green"><VIcon name="check" /></span>
              <div>
                <small>Виконані замовлення</small>
                <strong>{number(completedOrderRows.length)} <em>із {number(orderRows.length)}</em></strong>
                <p>Рівень виконання {number(reportCompletionRate, "%")}</p>
              </div>
            </article>
            <article>
              <span className="blue"><VIcon name="route" /></span>
              <div>
                <small>Відстань дорогами</small>
                <strong>{number(reportDistanceKm, " км")}</strong>
                <p>За обраний період</p>
              </div>
            </article>
            <article>
              <span className="orange"><VIcon name="clock" /></span>
              <div>
                <small>Середній час замовлення</small>
                <strong>{minutes(reportAvgDuration)}</strong>
                <p>Від створення до завершення</p>
              </div>
            </article>
          </div>
          <div className="portal-report-grid">
            <section className="portal-report-card wide">
              <header>
                <div>
                  <h3>Замовлення за днями</h3>
                  <p>Кількість і сума завершених замовлень</p>
                </div>
                <strong>{number(completedOrderRows.length)} · {money(totalCompletedRevenue)}</strong>
              </header>
              {dailyReportRows.length ? (
                <div className="portal-day-chart">
                  {dailyReportRows.map((row) => (
                    <div className="portal-day-bar" key={row.key}>
                      <strong>{number(row.count)}</strong>
                      <span style={{ height: `${Math.max(16, Math.round((row.count / maxDailyCount) * 128))}px` }} />
                      <small>{row.label}</small>
                      <em>{money(row.revenue)}</em>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="portal-report-empty">За обраний період немає завершених замовлень.</p>
              )}
            </section>
            <section className="portal-report-card">
              <header>
                <div>
                  <h3>Оцінка від замовників</h3>
                  <p>Лише оцінки, залишені замовниками після виконання</p>
                </div>
              </header>
              <div className="portal-rating-summary">
                <div className="portal-rating-circle">{ratingCount ? ratingAverage.toFixed(1).replace(".", ",") : "-"}</div>
                <p><span>середня оцінка за</span><strong>{number(ratingCount)} відгуками</strong></p>
              </div>
              <div className="portal-rating-bars">
                <p><span>5 зірок</span><strong>{percent(ratingBuckets.five, ratingCount)}</strong></p>
                <p><span>4 зірки</span><strong>{percent(ratingBuckets.four, ratingCount)}</strong></p>
                <p><span>3 зірки та нижче</span><strong>{percent(ratingBuckets.threeOrLess, ratingCount)}</strong></p>
              </div>
            </section>
          </div>
          <section className="portal-driver-report">
            <header>
              <div>
                <h3>Статистика за водіями</h3>
                <p>Розкрийте водія, щоб побачити його замовлення нижче</p>
              </div>
              <strong>{number(driverRows.length)} водії</strong>
            </header>
            <div className="portal-table-wrap">
              <table className="portal-table portal-driver-table">
                <thead>
                  <tr>
                    <th>Водій</th>
                    <th>Замовлення</th>
                    <th>Виконано</th>
                    <th>Відстань</th>
                    <th>Загальний час</th>
                    <th>Час із вантажем</th>
                    <th>Сума замовлень</th>
                    <th>Оцінка</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {driverRows.length ? driverRows.map((row, index) => {
                    const key = driverKey(row, index);
                    const isOpen = expandedDriverId === key;
                    const driverOrders = getDriverOrders(row);
                    const driverCompletedOrders = driverOrders.filter((order) => ["DELIVERED", "COMPLETED"].includes(order.status || ""));
                    const topDirections = getTopDirections(row);
                    const driverTotalDuration = Number(row.totalDurationMinutes) > 0
                      ? Number(row.totalDurationMinutes)
                      : driverOrders.reduce((sum, order) => sum + (orderTotalMinutes(order) || 0), 0);
                    const driverCargoDuration = Number(row.totalCargoDurationMinutes) > 0
                      ? Number(row.totalCargoDurationMinutes)
                      : driverOrders.reduce((sum, order) => sum + (orderCargoMinutes(order) || 0), 0);
                    const driverCompleted = Number(row.completedCount) > 0 ? Number(row.completedCount) : driverCompletedOrders.length;
                    const driverAvgCargoDuration = Number(row.avgCargoDurationMinutes) > 0
                      ? Number(row.avgCargoDurationMinutes)
                      : driverCompleted ? Math.round(driverCargoDuration / driverCompleted) : null;
                    return (
                      <Fragment key={key}>
                        <tr className={isOpen ? "expanded" : ""}>
                          <td>
                            <span className="portal-driver-cell">
                              <i>{initials(row.driver)}</i>
                              <strong>{displayName(row.driver)}</strong>
                            </span>
                          </td>
                          <td>{number(row.orderCount)}</td>
                          <td><strong>{number(row.completedCount)}</strong></td>
                          <td>{number(row.totalDistanceKm, " км")}</td>
                          <td>{minutes(driverTotalDuration)}</td>
                          <td>{minutes(driverCargoDuration)}</td>
                          <td><strong>{money(row.totalRevenue)}</strong></td>
                          <td>{getDriverRating(row)}</td>
                          <td>
                            <button
                              type="button"
                              className={`portal-expand-button ${isOpen ? "open" : ""}`}
                              onClick={() => toggleDriverDetails(row, key)}
                              aria-label={isOpen ? "Згорнути водія" : "Розкрити водія"}
                            >
                              <VIcon name="chevron" size={18} />
                            </button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="portal-driver-detail-row">
                            <td colSpan={9}>
                              <div className="portal-driver-detail">
                                <div className="portal-driver-facts">
                                  <p><span>Середня відстань</span><strong>{number(row.avgDistanceKm, " км")}</strong></p>
                                  <p><span>Середній час із вантажем</span><strong>{minutes(driverAvgCargoDuration)}</strong></p>
                                  <p><span>Найчастіші напрямки</span><strong>{topDirections.length ? topDirections.join(" · ") : "-"}</strong></p>
                                </div>
                                <div className="portal-driver-orders">
                                  <span>Конкретні замовлення водія</span>
                                  <div>
                                    {driverOrders.length ? driverOrders.slice(0, 6).map((order) => (
                                      <article key={order.id}>
                                        <strong>№ {order.orderNumber || order.id}</strong>
                                        <small>{routeText(order)}</small>
                                      </article>
                                    )) : (
                                      <p>Замовлень за обраний період немає.</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  }) : (
                    <tr><td colSpan={9} className="portal-empty-cell">За цей період немає статистики по водіях.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <section className="portal-order-analytics">
            <header>
              <div>
                <h3>Аналітика за замовленнями</h3>
                <p>Фактична відстань і тривалість кожного етапу</p>
              </div>
              <strong>{number(selectedOrderRows.length)} замовлень</strong>
            </header>
            {activeOrderDriver && (
              <div className="portal-order-filter-strip">
                <span><VIcon name="user" size={18} />Активний фільтр: <strong>{displayName(activeOrderDriver)}</strong></span>
                <button type="button" onClick={() => setOrderDriverFilterId("ALL")}>Показати всі замовлення</button>
              </div>
            )}
            <div className="portal-table-wrap">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Маршрут</th>
                    <th>Учасники</th>
                    <th>Статус</th>
                    <th>Дистанція</th>
                    <th>Тривалість</th>
                    <th>Дохід</th>
                    <th>Створено</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrderRows.length ? selectedOrderRows.slice(0, 80).map((order) => (
                    <tr key={order.id}>
                      <td><strong>{order.orderNumber || order.id}</strong></td>
                      <td><span>{routeText(order)}</span><small>{order.cargoType || "-"}</small></td>
                      <td><span>{displayName(order.customer)}</span><small>{displayName(order.driver)}</small></td>
                      <td><b className="portal-status">{statusLabel(order.status)}</b></td>
                      <td>{number(order.roadDistanceKm, " км")}</td>
                      <td>{minutes(orderTotalMinutes(order))}</td>
                      <td>{money(order.revenue ?? order.finalPrice ?? order.price)}</td>
                      <td>{formatDate(order.createdAt)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={8} className="portal-empty-cell">За цей період звіту немає замовлень для вибраного водія.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      )}

      {tab === "users" && (
        <section className="portal-panel">
          <div className="portal-panel-head"><div><h2>Користувачі</h2><p>{filteredUsers.length} з {users.length} записів</p></div></div>
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Користувач</th>
                  <th>Роль</th>
                  <th>Група</th>
                  <th>Статус</th>
                  <th>Дія</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length ? filteredUsers.slice(0, 120).map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.id}</strong></td>
                    <td><span>{displayName(user)}</span><small>{user.phone || user.email || "-"}</small></td>
                    <td>{user.isAdmin ? `Адмін · ${roleLabel(user.role)}` : roleLabel(user.role)}</td>
                    <td>
                      <select
                        className="portal-table-select"
                        value={String(user.group?.id || user.groupId || "")}
                        onChange={(event) => updateUserGroup(user.id, event.target.value)}
                        disabled={Boolean(saving)}
                      >
                        <option value="">Без групи</option>
                        {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                      </select>
                    </td>
                    <td><b className={`portal-status ${user.blocked ? "danger" : ""}`}>{user.blocked ? "Заблоковано" : "Активний"}</b></td>
                    <td>
                      {canBlockUser(user) && (
                        <button type="button" className={`portal-row-action ${user.blocked ? "" : "danger"}`} onClick={() => toggleBlocked(user)} disabled={saving === `user-block-${user.id}`}>
                          {user.blocked ? "Розблокувати" : "Блокувати"}
                        </button>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="portal-empty-cell">Користувачів не знайдено.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "groups" && (
        <section className="portal-panel">
          <div className="portal-panel-head">
            <div><h2>Групи</h2><p>{filteredGroups.length} з {groups.length} груп</p></div>
            <form className="portal-inline-form" onSubmit={createGroup}>
              <input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Назва групи" />
              <label className="portal-file-button">
                <input type="file" accept="image/*" onChange={(event) => setGroupPhoto(event.target.files?.[0] || null)} />
                <VIcon name="image" />{groupPhoto ? groupPhoto.name : "Фото"}
              </label>
              <button type="submit" disabled={saving === "group"}>Створити</button>
            </form>
          </div>
          <div className="portal-group-grid">
            {filteredGroups.length ? filteredGroups.map((group) => (
              <article className="portal-group-card" key={group.id} onClick={() => setActiveGroupId(group.id)}>
                <button type="button" className="portal-group-main" onClick={() => setActiveGroupId(group.id)}>
                  <span>{group.photo ? <img src={group.photo} alt={group.name} /> : groupInitials(group.name)}</span>
                  <div>
                    <strong>{group.name}</strong>
                    <small>{number(group.users?.length || 0)} користувачів</small>
                  </div>
                </button>
                <button type="button" onClick={(event) => { event.stopPropagation(); deleteGroup(group.id); }} disabled={saving === `group-${group.id}`}>Видалити</button>
              </article>
            )) : (
              <p className="portal-empty-list">Груп ще немає.</p>
            )}
          </div>
        </section>
      )}

      {activeGroup && (
        <div className="portal-modal-backdrop" role="presentation" onMouseDown={() => setActiveGroupId(null)}>
          <section className="portal-group-modal" role="dialog" aria-modal="true" aria-label={`Група ${activeGroup.name}`} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div className="portal-group-modal-title">
                <span>{activeGroup.photo ? <img src={activeGroup.photo} alt={activeGroup.name} /> : groupInitials(activeGroup.name)}</span>
                <div>
                  <h2>{activeGroup.name}</h2>
                  <p>{number(groupMembers.length)} учасників</p>
                </div>
              </div>
              <button type="button" className="portal-modal-close" onClick={() => setActiveGroupId(null)} aria-label="Закрити">×</button>
            </header>
            <div className="portal-group-modal-grid">
              <section>
                <div className="portal-modal-section-head">
                  <h3>Учасники групи</h3>
                  <span>{number(groupMembers.length)}</span>
                </div>
                <div className="portal-member-list">
                  {groupMembers.length ? groupMembers.map((user) => (
                    <article className="portal-member-row" key={user.id}>
                      <div>
                        <strong>{displayName(user)}</strong>
                        <small>{user.phone || user.email || roleLabel(user.role)}</small>
                      </div>
                      <button type="button" className="danger" onClick={() => removeUserFromActiveGroup(user.id)} disabled={Boolean(saving)}>
                        Прибрати
                      </button>
                    </article>
                  )) : (
                    <p className="portal-empty-list">У групі ще немає учасників.</p>
                  )}
                </div>
              </section>
              <section>
                <div className="portal-modal-section-head">
                  <h3>Додати учасника</h3>
                  <span>{number(availableGroupUsers.length)}</span>
                </div>
                <input className="portal-member-search" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Пошук за іменем або телефоном" />
                <div className="portal-member-list">
                  {availableGroupUsers.length ? availableGroupUsers.map((user) => (
                    <article className="portal-member-row" key={user.id}>
                      <div>
                        <strong>{displayName(user)}</strong>
                        <small>{user.phone || user.email || roleLabel(user.role)}</small>
                      </div>
                      <button type="button" onClick={() => addUserToActiveGroup(user.id)} disabled={Boolean(saving)}>
                        Додати
                      </button>
                    </article>
                  )) : (
                    <p className="portal-empty-list">Немає користувачів для додавання.</p>
                  )}
                </div>
              </section>
            </div>
          </section>
        </div>
      )}

      {tab === "admins" && (
        <section className="portal-panel">
          <div className="portal-panel-head">
            <div><h2>Адміністратори</h2><p>{filteredAdmins.length} з {portalAdmins.length} записів</p></div>
            <form className="portal-inline-form" onSubmit={createPortalAdmin}>
              <input value={adminPhone} onChange={(event) => setAdminPhone(event.target.value)} placeholder="+380..." />
              <button type="submit" disabled={saving === "admin"}>Додати</button>
            </form>
          </div>
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Адмін</th>
                  <th>Телефон</th>
                  <th>Пов'язаний user</th>
                  <th>Статус</th>
                  <th>Створено</th>
                  <th>Дія</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmins.length ? filteredAdmins.map((admin) => (
                  <tr key={admin.id}>
                    <td><strong>{admin.id}</strong></td>
                    <td><span>{displayName(admin.linkedUser || admin)}</span><small>{admin.email || "-"}</small></td>
                    <td>{admin.phone || admin.linkedUser?.phone || "-"}</td>
                    <td>{admin.linkedUser ? `${displayName(admin.linkedUser)} · ${roleLabel(admin.linkedUser.role)}` : "-"}</td>
                    <td><b className={`portal-status ${admin.active ? "" : "danger"}`}>{admin.active ? "Активний" : "Вимкнено"}</b></td>
                    <td>{formatDate(admin.createdAt)}</td>
                    <td>
                      <button type="button" className={`portal-row-action ${admin.active ? "danger" : ""}`} onClick={() => togglePortalAdmin(admin)} disabled={saving === `admin-${admin.id}`}>
                        {admin.active ? "Вимкнути" : "Увімкнути"}
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="portal-empty-cell">Адміністраторів не знайдено.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "support" && (
        <section className="portal-panel">
          <div className="portal-panel-head">
            <div>
              <h2>Звернення користувачів</h2>
              <p>{filteredSupportQuestions.length} з {supportQuestions.length} звернень, відкритих: {openSupportCount}</p>
            </div>
            <label className="portal-select-label">
              <span>Статус</span>
              <select value={supportStatusFilter} onChange={(event) => setSupportStatusFilter(event.target.value)}>
                <option value="ALL">Усі</option>
                <option value="OPEN">Відкриті</option>
                <option value="ANSWERED">З відповіддю</option>
              </select>
            </label>
          </div>
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Користувач</th>
                  <th>Питання</th>
                  <th>Статус</th>
                  <th>Дата</th>
                  <th>Дія</th>
                </tr>
              </thead>
              <tbody>
                {filteredSupportQuestions.length ? filteredSupportQuestions.map((item) => {
                  const photos = supportPhotos(item.photos);
                  return (
                    <tr key={item.id}>
                      <td><strong>{item.id}</strong></td>
                      <td><span>{displayName(item.user)}</span><small>{item.user?.phone || item.user?.email || roleLabel(item.user?.role)}</small></td>
                      <td><span>{item.question || "-"}</span><small>{item.answer ? `Відповідь: ${item.answer}` : photos.length ? `${photos.length} фото` : ""}</small></td>
                      <td><b className={`portal-status ${item.status === "OPEN" ? "warning" : ""}`}>{supportStatusLabel(item.status)}</b></td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>
                        <button type="button" className="portal-row-action" onClick={() => openSupportQuestion(item)}>
                          Відповісти
                        </button>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={6} className="portal-empty-cell">Звернень не знайдено.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeSupportQuestion && (
        <div className="portal-modal-backdrop" role="presentation" onMouseDown={() => setActiveSupportQuestionId(null)}>
          <section className="portal-support-modal" role="dialog" aria-modal="true" aria-label={`Звернення ${activeSupportQuestion.id}`} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <h2>Звернення #{activeSupportQuestion.id}</h2>
                <p>{displayName(activeSupportQuestion.user)} · {formatDate(activeSupportQuestion.createdAt)}</p>
              </div>
              <button type="button" className="portal-modal-close" onClick={() => setActiveSupportQuestionId(null)} aria-label="Закрити">×</button>
            </header>
            <div className="portal-support-body">
              <section>
                <h3>Питання користувача</h3>
                <p>{activeSupportQuestion.question}</p>
                {supportPhotos(activeSupportQuestion.photos).length > 0 && (
                  <div className="portal-support-photos">
                    {supportPhotos(activeSupportQuestion.photos).map((photo) => (
                      <a key={photo} href={photo} target="_blank" rel="noreferrer">
                        <img src={photo} alt="Фото звернення" />
                      </a>
                    ))}
                  </div>
                )}
              </section>
              <form onSubmit={saveSupportAnswer}>
                <label>
                  <span>Відповідь адміністратора</span>
                  <textarea value={supportAnswer} onChange={(event) => setSupportAnswer(event.target.value)} placeholder="Напишіть відповідь користувачу..." />
                </label>
                <label>
                  <span>Статус</span>
                  <select value={supportAnswerStatus} onChange={(event) => setSupportAnswerStatus(event.target.value)}>
                    <option value="ANSWERED">Відповіли</option>
                    <option value="OPEN">Відкрите</option>
                  </select>
                </label>
                <button type="submit" className="portal-primary" disabled={saving === `support-${activeSupportQuestion.id}`}>
                  {saving === `support-${activeSupportQuestion.id}` ? "Збереження..." : "Зберегти відповідь"}
                </button>
              </form>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function PortalShell({ session, onLogout, onSessionChange }: { session: Session; onLogout: () => void; onSessionChange: (session: Session) => void }) {
  const data = usePortalData(session, onLogout);
  const profile = session.profile;
  const admin = hasAdminAccess(session);
  const analytics = hasAnalyticsAccess(session);
  const [adminTab, setAdminTab] = useState<AdminTab>("overview");
  const userStats = useMemo(() => {
    if (!isUserProfile(profile)) return null;
    return {
      rating: profile.driverRating ?? profile.customerRating,
      completed: (profile.driverCompletedOrders || 0) + (profile.customerCompletedOrders || 0),
    };
  }, [profile]);

  return (
    <main className={`portal-shell ${admin ? "admin-mode" : ""}`}>
      <aside className="portal-sidebar">
        <a className="portal-brand" href="/">
          <img src="/logo.png" alt="VanGo" />
          <strong>VanGo</strong>
        </a>
        <nav className="portal-nav" aria-label="Навігація порталу">
          {admin ? (
            ADMIN_TABS.map((item) => (
              <button key={item.id} type="button" className={adminTab === item.id ? "active" : ""} onClick={() => setAdminTab(item.id)}>
                <VIcon name={item.icon} />{item.label}
              </button>
            ))
          ) : (
            <>
            <a className="active" href="/"><VIcon name="case" />Огляд</a>
            <a href="/customer"><VIcon name="user" />Кабінет замовника</a>
            <a href="/driver/map"><VIcon name="car" />Кабінет водія</a>
            {analytics && <a href="#analytics"><VIcon name="chart" />Аналітика</a>}
            </>
          )}
        </nav>
        {admin ? (
          <button type="button" className={`portal-profile portal-profile-button ${adminTab === "account" ? "active" : ""}`} onClick={() => setAdminTab("account")}>
            <PortalAvatar profile={profile} className="" />
            <div>
              <strong>{displayName(profile)}</strong>
              <small>{session.kind === "portal-admin" ? "Адмін порталу" : isUserProfile(profile) ? roleLabel(profile.role) : ""}</small>
            </div>
          </button>
        ) : (
          <div className="portal-profile">
            <PortalAvatar profile={profile} className="" />
            <div>
              <strong>{displayName(profile)}</strong>
              <small>{isUserProfile(profile) ? roleLabel(profile.role) : ""}</small>
            </div>
          </div>
        )}
      </aside>
      <section className="portal-workspace">
        <header className="portal-topbar">
          <div>
            <small>Дані з VanGo API</small>
            <h1>Портал застосунку</h1>
          </div>
          <div className="portal-actions">
            <ThemeToggle />
            <button type="button" onClick={onLogout}><VIcon name="logout" />Вийти</button>
          </div>
        </header>
        <div className="portal-content">
          {data.error && <div className="portal-alert">{data.error}</div>}
          {!admin ? (
            <PortalRoleChoice
              profile={profile}
              myOrdersCount={data.myOrders.length}
              completedCount={userStats?.completed}
              rating={userStats?.rating}
            />
          ) : (
            <div id="admin"><AdminSection session={session} orders={data.adminOrders} users={data.users} analytics={data.analytics} onReload={data.reload} tab={adminTab} onSessionChange={onSessionChange} onAuthExpired={onLogout} /></div>
          )}
        </div>
      </section>
    </main>
  );
}

export default function PortalDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      const token = window.localStorage.getItem(TOKEN_KEY);
      const kind = (window.localStorage.getItem(KIND_KEY) || "user") as AuthKind;
      if (!token) {
        setBooting(false);
        return;
      }

      try {
        const profilePath = kind === "portal-admin" ? "/admin-auth/me" : "/auth/me";
        const profile = await apiFetch<UserProfile | PortalAdminProfile>(profilePath, token);
        setSession({ token, kind, profile });
      } catch {
        clearStoredSession();
      } finally {
        setBooting(false);
      }
    }

    restoreSession();
  }, []);

  function logout() {
    clearStoredSession();
    setSession(null);
  }

  if (booting) {
    return <main className="portal-auth"><div className="portal-loading">Завантаження порталу...</div></main>;
  }

  if (!session) return <LoginPanel onLogin={setSession} />;
  return <PortalShell session={session} onLogout={logout} onSessionChange={setSession} />;
}
