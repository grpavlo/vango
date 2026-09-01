const adminSections = {
  dashboard: {
    title: "Адмін",
    eyebrow: "Операційна панель",
  },
  orders: {
    title: "Замовлення",
    eyebrow: "Адмін",
  },
  users: {
    title: "Користувачі",
    eyebrow: "Адмін",
  },
  admins: {
    title: "Адміни порталу",
    eyebrow: "Адмін",
  },
  groups: {
    title: "Команди",
    eyebrow: "Адмін",
  },
  support: {
    title: "Звернення",
    eyebrow: "Адмін",
  },
};

function normalizeAdminSection(section) {
  return Object.prototype.hasOwnProperty.call(adminSections, section) ? section : "dashboard";
}

function getInitialAdminSection() {
  if (typeof window === "undefined") return "orders";
  const sectionFromPath = window.location.pathname.match(/^\/portal\/(admin|orders|users|admins|groups|support)\/?$/)?.[1];
  if (sectionFromPath === "admin") return "dashboard";
  return normalizeAdminSection(sectionFromPath || new URLSearchParams(window.location.search).get("section"));
}

const state = {
  token: localStorage.getItem("vango.portal.token") || "",
  user: null,
  users: [],
  portalAdmins: [],
  orders: [],
  groups: [],
  supportQuestions: [],
  analyticsReport: null,
  tab: getInitialAdminSection(),
  activeGroupId: null,
  activeSupportQuestionId: null,
  addMembersOpen: false,
  authMethod: "phone",
  loading: false,
};

const page = document.body.dataset.page;
const authGate = document.getElementById("authGate");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginSubmitButton = document.getElementById("loginSubmitButton");
const sendCodeButton = document.getElementById("sendCodeButton");
const toastRegion = document.getElementById("toastRegion");

const statusLabels = {
  CREATED: "Створено",
  ACCEPTED: "Прийнято",
  IN_PROGRESS: "В дорозі",
  DELIVERED: "Доставлено",
  COMPLETED: "Завершено",
  PENDING: "Очікує",
  CANCELLED: "Скасовано",
  REJECTED: "Відхилено",
};

const roleLabels = {
  ADMIN: "Адмін",
  DRIVER: "Водій",
  CUSTOMER: "Замовник",
  BOTH: "Замовник і водій",
};

const supportStatusLabels = {
  OPEN: "Передано",
  ANSWERED: "Є відповідь",
};

function normalizeSupportStatus(status) {
  return status === "CLOSED" ? "ANSWERED" : status;
}

function text(value, fallback = "-") {
  const normalized = value === null || value === undefined ? "" : String(value).trim();
  return normalized || fallback;
}

function normalizePhotoList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      return normalizePhotoList(JSON.parse(trimmed));
    } catch {
      return [trimmed];
    }
  }
  return [];
}

function money(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return `${Math.round(num).toLocaleString("uk-UA")} грн`;
}

function number(value, suffix = "") {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return `${num.toLocaleString("uk-UA")}${suffix ? ` ${suffix}` : ""}`;
}

function date(value) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateInputValue(value) {
  const dt = value ? new Date(value) : new Date();
  if (Number.isNaN(dt.getTime())) return "";
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function duration(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return "-";
  if (minutes < 60) return `${Math.round(minutes)} хв`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours < 24) return rest ? `${hours} год ${rest} хв` : `${hours} год`;
  const days = Math.floor(hours / 24);
  const dayHours = hours % 24;
  return dayHours ? `${days} д ${dayHours} год` : `${days} д`;
}

function km(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return `${num.toLocaleString("uk-UA", { maximumFractionDigits: 1 })} км`;
}

function badge(label, type = "neutral") {
  return `<span class="badge ${type}">${label}</span>`;
}

function statusBadge(status) {
  const label = statusLabels[status] || status || "-";
  const type = ["COMPLETED", "DELIVERED"].includes(status)
    ? "ok"
    : ["CANCELLED", "REJECTED"].includes(status)
      ? "danger"
      : ["PENDING", "ACCEPTED", "IN_PROGRESS"].includes(status)
        ? "warn"
        : "neutral";
  return badge(label, type);
}

function supportStatusBadge(status) {
  const normalizedStatus = normalizeSupportStatus(status);
  const label = supportStatusLabels[normalizedStatus] || normalizedStatus || "-";
  const type = normalizedStatus === "ANSWERED" ? "ok" : "warn";
  return badge(label, type);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message, type = "success") {
  if (!toastRegion) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`.trim();
  toast.textContent = message;
  toastRegion.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3400);
}

async function apiFetch(path, options = {}) {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
    ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(`/api${path}`, { ...options, headers });
  if (!response.ok) {
    const message = await response.text();
    const trimmed = String(message || "").trim();
    const isHtml = trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html");
    const friendlyMessage = isHtml
      ? `API endpoint недоступний (${response.status}): ${path}`
      : trimmed || `HTTP ${response.status}`;
    const error = new Error(friendlyMessage);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : response.text();
}

function showAuth(show) {
  authGate?.classList.toggle("hidden", !show);
}

function setAdminNavOpen(isOpen) {
  const group = document.getElementById("adminNavGroup");
  const button = document.querySelector("[data-admin-nav-toggle]");
  group?.classList.toggle("open", isOpen);
  button?.setAttribute("aria-expanded", String(isOpen));
  button?.setAttribute("aria-label", isOpen ? "Згорнути меню Адмін" : "Розгорнути меню Адмін");
}

function toggleAdminNavGroup() {
  const group = document.getElementById("adminNavGroup");
  setAdminNavOpen(!group?.classList.contains("open"));
}

function ensurePhonePrefix(input) {
  if (!input) return;
  const digits = String(input.value || "").replace(/\D/g, "");
  if (!digits) {
    input.value = "+380";
    return;
  }
  if (digits.startsWith("380")) {
    input.value = `+${digits}`;
    return;
  }
  if (digits.startsWith("0")) {
    input.value = `+38${digits}`;
    return;
  }
  input.value = `+380${digits}`;
}

function setLoading(isLoading) {
  state.loading = isLoading;
  document.querySelectorAll("#refreshButton").forEach((button) => {
    button.disabled = isLoading;
    button.textContent = isLoading ? "Оновлення..." : "Оновити";
  });
}

function setAuthMethod(method) {
  state.authMethod = method === "email" ? "email" : "phone";
  document.querySelectorAll("[data-auth-method]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authMethod === state.authMethod);
  });
  document.querySelectorAll("[data-auth-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.authPanel !== state.authMethod);
  });
  if (loginError) {
    loginError.classList.remove("success");
    loginError.textContent = "";
  }
}

async function login(event) {
  event.preventDefault();
  loginError.classList.remove("success");
  loginError.textContent = "";
  const formData = new FormData(loginForm);
  try {
    const result = state.authMethod === "phone"
      ? await loginWithPhone(formData)
      : await loginWithEmail(formData);
    state.token = result.token;
    localStorage.setItem("vango.portal.token", state.token);
    await boot();
  } catch (error) {
    loginError.textContent = error.message || "Не вдалося увійти";
  }
}

async function loginWithEmail(formData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) {
    throw new Error("Вкажіть email і пароль");
  }
  return apiFetch("/admin-auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

async function loginWithPhone(formData) {
  const phone = String(formData.get("phone") || "").trim();
  const code = String(formData.get("code") || "").trim();
  if (!phone || !code) {
    throw new Error("Вкажіть номер телефону та SMS-код");
  }
  return apiFetch("/admin-auth/verify-code", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
}

async function sendPhoneCode() {
  loginError.classList.remove("success");
  loginError.textContent = "";
  const formData = new FormData(loginForm);
  const phone = String(formData.get("phone") || "").trim();
  if (!phone) {
    loginError.textContent = "Вкажіть номер телефону";
    return;
  }

  if (sendCodeButton) {
    sendCodeButton.disabled = true;
    sendCodeButton.textContent = "Надсилаємо...";
  }

  try {
    await apiFetch("/admin-auth/send-code", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
    loginError.classList.add("success");
    loginError.textContent = "SMS-код надіслано";
    document.querySelector('input[name="code"]')?.focus();
  } catch (error) {
    loginError.textContent = error.message || "Не вдалося надіслати SMS";
  } finally {
    if (sendCodeButton) {
      sendCodeButton.disabled = false;
      sendCodeButton.textContent = "Надіслати код";
    }
  }
}

function logout() {
  state.token = "";
  state.user = null;
  localStorage.removeItem("vango.portal.token");
  showAuth(true);
}

async function loadProfile() {
  if (!state.token) return null;
  state.user = await apiFetch("/admin-auth/me");
  return state.user;
}

function renderAdminStats() {
  const totalUsers = state.users.length;
  const drivers = state.users.filter((user) => ["DRIVER", "BOTH"].includes(user.role)).length;
  const blocked = state.users.filter((user) => user.blocked).length;
  const activeOrders = state.orders.filter((order) => !["COMPLETED", "CANCELLED", "REJECTED"].includes(order.status)).length;
  const completed = state.orders.filter((order) => order.status === "COMPLETED").length;
  const openSupport = state.supportQuestions.filter((item) => item.status === "OPEN").length;
  const activeAdmins = state.portalAdmins.filter((admin) => admin.active).length;

  document.getElementById("adminStats").innerHTML = [
    ["Користувачів", totalUsers, `${drivers} водіїв`],
    ["Замовлень", state.orders.length, `${activeOrders} активних`],
    ["Команд", state.groups.length, "груп доступу"],
    ["Адмінів", activeAdmins, "мають доступ"],
    ["Звернення", openSupport, "очікують відповіді"],
    ["Завершено", completed, "за останньою вибіркою"],
    ["Заблоковано", blocked, "акаунтів"],
  ]
    .map(([label, value, note]) => `
      <article class="stat-card">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${number(value)}</div>
        <div class="stat-note">${note}</div>
      </article>
    `)
    .join("");
}

function renderOrders() {
  const table = document.getElementById("ordersTable");
  document.getElementById("ordersCount").textContent = `${state.orders.length} записів`;
  if (!state.orders.length) {
    table.innerHTML = `<tr><td colspan="7" class="muted">Немає замовлень</td></tr>`;
    return;
  }

  table.innerHTML = state.orders
    .map((order) => {
      const route = `${text(order.pickupCity || order.pickupLocation)} → ${text(order.dropoffCity || order.dropoffLocation)}`;
      const detail = [order.pickupAddress, order.dropoffAddress].filter(Boolean).join(" → ");
      const driver = order.driver || order.candidateDriver || order.reservedDriver;
      return `
        <tr>
          <td><strong>${escapeHtml(order.orderNumber || order.id)}</strong></td>
          <td class="route-cell">
            <strong>${escapeHtml(route)}</strong>
            <span class="muted">${escapeHtml(detail || order.cargoType || "-")}</span>
          </td>
          <td class="user-cell">
            <strong>${escapeHtml(text(order.customer?.name))}</strong>
            <span class="muted">${escapeHtml(text(order.customer?.phone))}</span>
          </td>
          <td class="user-cell">
            <strong>${escapeHtml(text(driver?.name))}</strong>
            <span class="muted">${escapeHtml(text(driver?.phone))}</span>
          </td>
          <td>${statusBadge(order.status)}</td>
          <td>${escapeHtml(money(order.finalPrice ?? order.price))}</td>
          <td class="muted">${escapeHtml(date(order.updatedAt || order.createdAt))}</td>
        </tr>
      `;
    })
    .join("");
}

function getSearchQuery() {
  return String(document.getElementById("searchInput")?.value || "").trim().toLowerCase();
}

function matchesSearch(values, query = getSearchQuery()) {
  if (!query) return true;
  return values.some((value) => String(value || "").toLowerCase().includes(query));
}

function renderUsers() {
  const table = document.getElementById("usersTable");
  const users = state.users.filter((user) =>
    matchesSearch([
      user.id,
      user.name,
      user.phone,
      user.email,
      roleLabels[user.role] || user.role,
      user.group?.name,
      user.blocked ? "заблоковано" : "активний",
    ])
  );
  document.getElementById("usersCount").textContent = `${users.length} з ${state.users.length} записів`;
  if (!users.length) {
    table.innerHTML = `<tr><td colspan="6" class="muted">Немає користувачів</td></tr>`;
    return;
  }

  table.innerHTML = users
    .map((user) => {
      const canBlock = ["DRIVER", "BOTH"].includes(user.role);
      const groupName = user.group?.name || "";
      const groupId = user.groupId || "";
      const roleText = user.isAdmin
        ? `Адмін · ${roleLabels[user.role] || user.role}`
        : roleLabels[user.role] || user.role;
      return `
        <tr>
          <td>${escapeHtml(user.id)}</td>
          <td class="user-cell">
            <strong>${escapeHtml(text(user.name))}</strong>
            <span class="muted">${escapeHtml(text(user.phone || user.email))}</span>
          </td>
          <td>${escapeHtml(roleText)}</td>
          <td>
            <div class="group-editor">
              <input type="text" value="${escapeHtml(groupName)}" placeholder="Почніть вводити" data-group-combobox="${user.id}" data-original-group-id="${escapeHtml(groupId)}" autocomplete="off" />
              <button class="action-button" data-group-save="${user.id}" type="button">Зберегти</button>
              <div class="group-dropdown hidden" data-group-dropdown="${user.id}"></div>
            </div>
          </td>
          <td>${user.blocked ? badge("Заблоковано", "danger") : badge("Активний", "ok")}</td>
          <td>
            ${
              canBlock
                ? `<button class="action-button ${user.blocked ? "" : "danger"}" data-user-id="${user.id}" data-action="${user.blocked ? "unblock" : "block"}">${user.blocked ? "Розблокувати" : "Блокувати"}</button>`
                : ""
            }
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderPortalAdmins() {
  const table = document.getElementById("portalAdminsTable");
  const count = document.getElementById("portalAdminsCount");
  if (!table || !count) return;

  const admins = state.portalAdmins.filter((admin) =>
    matchesSearch([
      admin.id,
      admin.name,
      admin.email,
      admin.phone,
      admin.active ? "активний" : "вимкнено",
      admin.linkedUser?.name,
      admin.linkedUser?.email,
      admin.linkedUser?.phone,
    ])
  );

  count.textContent = `${admins.length} з ${state.portalAdmins.length} записів`;
  if (!admins.length) {
    table.innerHTML = `<tr><td colspan="6" class="muted">Адмінів ще немає</td></tr>`;
    return;
  }

  table.innerHTML = admins
    .map((admin) => {
      const linked = admin.linkedUser;
      const name = text(admin.name || linked?.name, "Без імені");
      const active = Boolean(admin.active);
      return `
        <tr>
          <td><strong>${escapeHtml(admin.id)}</strong></td>
          <td class="user-cell">
            <strong>${escapeHtml(name)}</strong>
          </td>
          <td>${escapeHtml(text(admin.phone || linked?.phone))}</td>
          <td>${active ? badge("Активний", "ok") : badge("Вимкнено", "danger")}</td>
          <td class="muted">${escapeHtml(date(admin.createdAt))}</td>
          <td>
            <button class="action-button ${active ? "danger" : "dirty"}" data-portal-admin-id="${escapeHtml(admin.id)}" data-portal-admin-active="${active ? "false" : "true"}" type="button">
              ${active ? "Вимкнути" : "Увімкнути"}
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderGroups() {
  const list = document.getElementById("groupsList");
  const count = document.getElementById("groupsCount");
  if (!list || !count) return;

  const groups = state.groups.filter((group) =>
    matchesSearch([group.id, group.name, group.users?.length])
  );
  count.textContent = `${groups.length} з ${state.groups.length} записів`;
  if (!groups.length) {
    list.innerHTML = `<div class="muted">Команд ще немає</div>`;
    return;
  }

  list.innerHTML = groups
    .map((group) => {
      const initials = text(group.name, "?").slice(0, 2).toUpperCase();
      const photo = group.photo
        ? `<img class="group-photo" src="${escapeHtml(group.photo)}" alt="${escapeHtml(group.name)}" />`
        : `<div class="group-photo placeholder">${escapeHtml(initials)}</div>`;
      return `
        <article class="group-card">
          <button class="group-card-main" type="button" data-group-open="${escapeHtml(group.id)}">
            ${photo}
            <div>
              <strong>${escapeHtml(group.name)}</strong>
              <div class="muted">${number(group.users?.length || 0)} користувачів</div>
            </div>
          </button>
          <div class="group-card-actions">
            <button class="icon-action close-action group-delete" type="button" data-group-delete="${escapeHtml(group.id)}" aria-label="Видалити команду">×</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function userDisplay(user) {
  const name = text(
    user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(" "),
    `ID ${user?.id || "-"}`
  );
  const contact = text(user?.phone || user?.email);
  return { name, contact };
}

function getSupportPhotos(item) {
  return normalizePhotoList(item?.photos);
}

function renderSupportQuestions() {
  const table = document.getElementById("supportQuestionsTable");
  const count = document.getElementById("supportCount");
  if (!table || !count) return;
  const selectedStatus = String(document.getElementById("supportStatusFilter")?.value || "ALL");

  const items = state.supportQuestions
    .filter((item) => selectedStatus === "ALL" || normalizeSupportStatus(item.status) === selectedStatus)
    .filter((item) =>
      matchesSearch([
        item.id,
        item.question,
        item.answer,
        getSupportPhotos(item).join(" "),
        item.status,
        supportStatusLabels[item.status],
        item.user?.name,
        item.user?.firstName,
        item.user?.lastName,
        item.user?.phone,
        item.user?.email,
        item.user?.role,
      ])
    );

  count.textContent = `${items.length} з ${state.supportQuestions.length} записів`;

  if (!items.length) {
    table.innerHTML = `<tr><td colspan="6" class="muted">Немає звернень</td></tr>`;
    return;
  }

  table.innerHTML = items
    .map((item) => {
      const user = userDisplay(item.user);
      const photos = getSupportPhotos(item);
      return `
        <tr>
          <td><strong>${escapeHtml(item.id)}</strong></td>
          <td class="user-cell">
            <strong>${escapeHtml(user.name)}</strong>
            <span class="muted">${escapeHtml(user.contact)} · ${escapeHtml(roleLabels[item.user?.role] || item.user?.role || "-")}</span>
          </td>
          <td class="support-question-cell">
            <button class="support-question-open" data-support-open="${escapeHtml(item.id)}" type="button">
              ${escapeHtml(item.question)}
            </button>
            ${photos.length ? `<span class="support-attachment-note">${photos.length} фото</span>` : ""}
            ${item.answer ? `<span class="muted">Відповідь: ${escapeHtml(item.answer)}</span>` : ""}
          </td>
          <td>${supportStatusBadge(item.status)}</td>
          <td class="muted">${escapeHtml(date(item.createdAt))}</td>
          <td>
            <button class="action-button dirty" data-support-answer="${escapeHtml(item.id)}" type="button">Відповісти</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderAdmin() {
  renderAdminStats();
  renderOrders();
  renderUsers();
  renderPortalAdmins();
  renderGroups();
  renderSupportQuestions();
}

async function loadAdminData() {
  setLoading(true);
  try {
    const status = document.getElementById("statusFilter").value;
    const q = document.getElementById("searchInput").value.trim();
    const params = new URLSearchParams({ limit: "300", status });
    if (q) params.set("q", q);
    const [users, portalAdmins, orders, groups, supportQuestions] = await Promise.all([
      apiFetch("/admin/users"),
      apiFetch("/admin/portal-admins"),
      apiFetch(`/admin/orders?${params.toString()}`),
      apiFetch("/admin/groups"),
      apiFetch("/admin/support-questions?limit=300"),
    ]);
    state.users = users;
    state.portalAdmins = portalAdmins;
    state.orders = orders;
    state.groups = groups;
    state.supportQuestions = supportQuestions;
    renderAdmin();
    if (state.activeGroupId) renderGroupModal();
    if (state.addMembersOpen) renderAddMembersModal();
    if (state.activeSupportQuestionId) renderSupportQuestionModal();
  } finally {
    setLoading(false);
  }
}

function getActiveGroup() {
  return state.groups.find((group) => Number(group.id) === Number(state.activeGroupId)) || null;
}

function openGroupModal(groupId) {
  state.activeGroupId = Number(groupId);
  state.addMembersOpen = false;
  renderGroupModal();
  document.getElementById("groupModal").classList.remove("hidden");
}

function closeModal(id) {
  document.getElementById(id)?.classList.add("hidden");
  if (id === "groupModal") {
    state.activeGroupId = null;
    state.addMembersOpen = false;
    document.getElementById("addMembersModal")?.classList.add("hidden");
  }
  if (id === "addMembersModal") {
    state.addMembersOpen = false;
  }
  if (id === "supportQuestionModal") {
    state.activeSupportQuestionId = null;
  }
}

function getActiveSupportQuestion() {
  return state.supportQuestions.find((item) => Number(item.id) === Number(state.activeSupportQuestionId)) || null;
}

function openSupportQuestionModal(id) {
  state.activeSupportQuestionId = Number(id);
  renderSupportQuestionModal();
  document.getElementById("supportQuestionModal")?.classList.remove("hidden");
  document.getElementById("supportAnswerInput")?.focus();
}

function renderSupportQuestionModal() {
  const item = getActiveSupportQuestion();
  if (!item) return;

  const user = userDisplay(item.user);
  document.getElementById("supportModalTitle").textContent = `Звернення #${item.id}`;
  document.getElementById("supportModalStatus").innerHTML = supportStatusBadge(item.status);
  document.getElementById("supportModalUser").textContent = user.name;
  document.getElementById("supportModalContact").textContent = `${user.contact} · ${roleLabels[item.user?.role] || item.user?.role || "-"}`;
  document.getElementById("supportModalDate").textContent = date(item.createdAt);
  document.getElementById("supportModalQuestion").textContent = item.question || "-";
  const photos = getSupportPhotos(item);
  const photosSection = document.getElementById("supportModalPhotosSection");
  const photosContainer = document.getElementById("supportModalPhotos");
  photosSection?.classList.toggle("hidden", photos.length === 0);
  if (photosContainer) {
    photosContainer.innerHTML = photos
      .map((photo, index) => `
        <a class="support-photo-link" href="${escapeHtml(photo)}" target="_blank" rel="noopener">
          <img src="${escapeHtml(photo)}" alt="Фото ${index + 1}" />
        </a>
      `)
      .join("");
  }
  const normalizedStatus = normalizeSupportStatus(item.status);
  document.getElementById("supportAnswerStatus").value = supportStatusLabels[normalizedStatus]
    ? normalizedStatus
    : "OPEN";
  document.getElementById("supportAnswerInput").value = item.answer || "";
}

function renderGroupModal() {
  const group = getActiveGroup();
  const title = document.getElementById("groupModalTitle");
  const list = document.getElementById("groupMembersList");
  if (!group || !title || !list) return;

  title.textContent = group.name;
  const users = [...(group.users || [])].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "uk"));
  if (!users.length) {
    list.innerHTML = `<div class="muted">У цій команді ще немає учасників</div>`;
    return;
  }

  list.innerHTML = users
    .map(
      (user) => `
        <div class="member-row">
          <div>
            <strong>${escapeHtml(text(user.name))}</strong>
            <span class="member-meta">${escapeHtml(text(user.phone || user.email))} · ${escapeHtml(roleLabels[user.role] || user.role)}</span>
          </div>
          <div class="member-actions">
            ${user.blocked ? badge("Заблоковано", "danger") : badge("Активний", "ok")}
            <button class="icon-action close-action member-remove" type="button" data-remove-user-from-group="${escapeHtml(user.id)}" aria-label="Видалити з команди">×</button>
          </div>
        </div>
      `
    )
    .join("");
}

function openAddMembersModal() {
  if (!state.activeGroupId) return;
  state.addMembersOpen = true;
  renderAddMembersModal();
  document.getElementById("addMembersModal").classList.remove("hidden");
  document.getElementById("memberSearchInput")?.focus();
}

function renderAddMembersModal() {
  const group = getActiveGroup();
  const title = document.getElementById("addMembersModalTitle");
  const list = document.getElementById("availableMembersList");
  if (!group || !title || !list) return;

  const query = String(document.getElementById("memberSearchInput")?.value || "").trim().toLowerCase();
  title.textContent = group.name;
  const users = state.users
    .filter((user) => Number(user.groupId || 0) !== Number(group.id))
    .filter((user) =>
      matchesSearch([user.name, user.phone, user.email, roleLabels[user.role] || user.role], query)
    )
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "uk"));

  if (!users.length) {
    list.innerHTML = `<div class="muted">Немає користувачів для додавання</div>`;
    return;
  }

  list.innerHTML = users
    .map(
      (user) => `
        <div class="member-row">
          <div>
            <strong>${escapeHtml(text(user.name))}</strong>
            <span class="member-meta">${escapeHtml(text(user.phone || user.email))} · ${escapeHtml(roleLabels[user.role] || user.role)}</span>
          </div>
          <button class="action-button dirty" type="button" data-add-user-to-group="${escapeHtml(user.id)}">Додати</button>
        </div>
      `
    )
    .join("");
}

async function addUserToActiveGroup(button) {
  const group = getActiveGroup();
  const userId = button.dataset.addUserToGroup;
  if (!group || !userId) return;

  button.disabled = true;
  try {
    await apiFetch(`/admin/users/${userId}/group`, {
      method: "PATCH",
      body: JSON.stringify({ groupId: group.id }),
    });
    showToast("Користувача додано до команди");
    await loadAdminData();
  } catch (error) {
    showToast(error.message || "Не вдалося додати користувача", "error");
  } finally {
    button.disabled = false;
  }
}

async function deleteGroup(button) {
  const groupId = button.dataset.groupDelete;
  const group = state.groups.find((item) => Number(item.id) === Number(groupId));
  if (!group) return;
  if (!window.confirm(`Видалити команду "${group.name}"? Учасники залишаться без команди.`)) return;

  button.disabled = true;
  try {
    await apiFetch(`/admin/groups/${groupId}`, { method: "DELETE" });
    showToast("Команду видалено");
    if (Number(state.activeGroupId) === Number(groupId)) closeModal("groupModal");
    await loadAdminData();
  } catch (error) {
    showToast(error.message || "Не вдалося видалити команду", "error");
  } finally {
    button.disabled = false;
  }
}

async function removeUserFromActiveGroup(button) {
  const userId = button.dataset.removeUserFromGroup;
  if (!userId) return;

  button.disabled = true;
  try {
    await apiFetch(`/admin/users/${userId}/group`, {
      method: "PATCH",
      body: JSON.stringify({ groupId: null }),
    });
    showToast("Користувача видалено з команди");
    await loadAdminData();
  } catch (error) {
    showToast(error.message || "Не вдалося видалити користувача з команди", "error");
  } finally {
    button.disabled = false;
  }
}

function findGroupIdByName(name) {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) return null;
  const group = state.groups.find((item) => String(item.name || "").trim().toLowerCase() === normalized);
  return group?.id || undefined;
}

function getGroupIdFromInput(input) {
  const groupName = String(input?.value || "").trim();
  return findGroupIdByName(groupName);
}

function updateGroupSaveState(input) {
  const userId = input?.dataset.groupCombobox;
  if (!userId) return;
  const button = document.querySelector(`[data-group-save="${CSS.escape(userId)}"]`);
  if (!button) return;

  const original = input.dataset.originalGroupId || "";
  const groupName = String(input.value || "").trim();
  const current = groupName ? getGroupIdFromInput(input) : null;
  const currentKey = current === undefined ? `invalid:${groupName}` : current == null ? "" : String(current);
  button.classList.toggle("dirty", currentKey !== original);
}

function getFilteredGroups(query) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return state.groups;
  return state.groups.filter((group) => String(group.name || "").toLowerCase().includes(normalized));
}

function closeGroupDropdowns(exceptUserId = null) {
  document.querySelectorAll("[data-group-dropdown]").forEach((dropdown) => {
    if (exceptUserId && dropdown.dataset.groupDropdown === String(exceptUserId)) return;
    dropdown.classList.add("hidden");
  });
}

function renderGroupDropdown(input) {
  const userId = input.dataset.groupCombobox;
  const dropdown = document.querySelector(`[data-group-dropdown="${CSS.escape(userId)}"]`);
  if (!dropdown) return;

  const groups = getFilteredGroups(input.value);
  const emptyOption = `<button class="group-option empty" type="button" data-group-option="">Без команди</button>`;
  const groupOptions = groups
    .map((group) => `<button class="group-option" type="button" data-group-option="${escapeHtml(group.name)}">${escapeHtml(group.name)}</button>`)
    .join("");

  dropdown.innerHTML = groups.length
    ? `${emptyOption}${groupOptions}`
    : `${emptyOption}<button class="group-option empty" type="button" disabled>Нічого не знайдено</button>`;
  dropdown.classList.remove("hidden");
  closeGroupDropdowns(userId);
}

async function saveUserGroup(button) {
  const userId = button.dataset.groupSave;
  const input = document.querySelector(`[data-group-combobox="${CSS.escape(userId)}"]`);
  const groupName = String(input?.value || "").trim();
  const groupId = findGroupIdByName(groupName);

  if (groupName && groupId === undefined) {
    input?.setCustomValidity("Оберіть команду зі списку");
    input?.reportValidity();
    return;
  }

  input?.setCustomValidity("");
  button.disabled = true;
  if (input) input.disabled = true;
  try {
    const updated = await apiFetch(`/admin/users/${userId}/group`, {
      method: "PATCH",
      body: JSON.stringify({ groupId: groupId || null }),
    });
    if (input) {
      input.dataset.originalGroupId = updated?.groupId ? String(updated.groupId) : "";
      input.value = updated?.group?.name || "";
      updateGroupSaveState(input);
    }
    showToast("Команду користувача збережено");
    await loadAdminData();
  } catch (error) {
    showToast(error.message || "Не вдалося зберегти команду", "error");
  } finally {
    button.disabled = false;
    if (input) input.disabled = false;
  }
}

async function createGroup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("button[type='submit']");
  const formData = new FormData(form);
  submit.disabled = true;
  try {
    await apiFetch("/admin/groups", {
      method: "POST",
      body: formData,
    });
    form.reset();
    showToast("Команду створено");
    await loadAdminData();
  } catch (error) {
    showToast(error.message || "Не вдалося створити команду", "error");
  } finally {
    submit.disabled = false;
  }
}

async function toggleDriverBlock(button) {
  const userId = button.dataset.userId;
  const action = button.dataset.action;
  button.disabled = true;
  try {
    await apiFetch(`/admin/drivers/${userId}/${action}`, { method: "POST" });
    showToast(action === "block" ? "Користувача заблоковано" : "Користувача розблоковано");
    await loadAdminData();
  } catch (error) {
    showToast(error.message || "Не вдалося оновити користувача", "error");
  } finally {
    button.disabled = false;
  }
}

async function createPortalAdmin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("button[type='submit']");
  const phone = String(new FormData(form).get("phone") || "").trim();

  if (!phone) {
    showToast("Вкажіть номер телефону", "error");
    return;
  }

  submit.disabled = true;
  try {
    await apiFetch("/admin/portal-admins", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
    form.reset();
    ensurePhonePrefix(form.elements.phone);
    showToast("Адміна додано");
    await loadAdminData();
  } catch (error) {
    showToast(error.message || "Не вдалося додати адміна", "error");
  } finally {
    submit.disabled = false;
  }
}

async function togglePortalAdmin(button) {
  const adminId = button.dataset.portalAdminId;
  const active = button.dataset.portalAdminActive === "true";
  if (!adminId) return;

  button.disabled = true;
  try {
    await apiFetch(`/admin/portal-admins/${adminId}`, {
      method: "PATCH",
      body: JSON.stringify({ active }),
    });
    showToast(active ? "Доступ адміна увімкнено" : "Доступ адміна вимкнено");
    await loadAdminData();
  } catch (error) {
    showToast(error.message || "Не вдалося оновити доступ", "error");
  } finally {
    button.disabled = false;
  }
}

async function saveSupportQuestionAnswer(event) {
  event.preventDefault();
  const item = getActiveSupportQuestion();
  if (!item) return;

  const form = event.currentTarget;
  const submit = form.querySelector("button[type='submit']");
  const answer = String(document.getElementById("supportAnswerInput")?.value || "").trim();
  const status = String(document.getElementById("supportAnswerStatus")?.value || "").trim();

  submit.disabled = true;
  try {
    await apiFetch(`/admin/support-questions/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ answer, status }),
    });
    showToast("Відповідь збережено");
    await loadAdminData();
    state.activeSupportQuestionId = item.id;
    renderSupportQuestionModal();
  } catch (error) {
    showToast(error.message || "Не вдалося зберегти відповідь", "error");
  } finally {
    submit.disabled = false;
  }
}

function setAdminSection(section, options = {}) {
  const nextSection = normalizeAdminSection(section);
  state.tab = nextSection;

  document.getElementById("dashboardPanel")?.classList.toggle("hidden", nextSection !== "dashboard");
  document.getElementById("adminToolbar")?.classList.toggle("hidden", nextSection === "dashboard");
  document.getElementById("ordersPanel")?.classList.toggle("hidden", nextSection !== "orders");
  document.getElementById("usersPanel")?.classList.toggle("hidden", nextSection !== "users");
  document.getElementById("adminsPanel")?.classList.toggle("hidden", nextSection !== "admins");
  document.getElementById("groupsPanel")?.classList.toggle("hidden", nextSection !== "groups");
  document.getElementById("supportPanel")?.classList.toggle("hidden", nextSection !== "support");
  document.getElementById("statusFilter")?.classList.toggle("hidden", nextSection !== "orders");
  document.getElementById("supportStatusFilter")?.classList.toggle("hidden", nextSection !== "support");

  const meta = adminSections[nextSection];
  const title = document.getElementById("pageTitle");
  const eyebrow = document.getElementById("pageEyebrow");
  if (title) title.textContent = meta.title;
  if (eyebrow) eyebrow.textContent = meta.eyebrow;

  document.querySelectorAll("[data-admin-section]").forEach((link) => {
    link.classList.toggle("active", link.dataset.adminSection === nextSection);
  });
  document.querySelector('.nav-parent-link[data-admin-section="dashboard"]')?.classList.add("active");
  document.querySelector(".nav-group-head")?.classList.add("active");

  setAdminNavOpen(true);

  if (options.push && typeof window !== "undefined") {
    const url = new URL(window.location.href);
    url.pathname = nextSection === "dashboard" ? "/portal/admin" : `/portal/${nextSection}`;
    url.searchParams.delete("section");
    window.history.pushState({ section: nextSection }, "", url);
  } else if (options.replace && typeof window !== "undefined") {
    const url = new URL(window.location.href);
    url.pathname = nextSection === "dashboard" ? "/portal/admin" : `/portal/${nextSection}`;
    url.searchParams.delete("section");
    window.history.replaceState({ section: nextSection }, "", url);
  }
}

function bindAdmin() {
  document.querySelectorAll("[data-admin-section]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      setAdminSection(link.dataset.adminSection, { push: true });
    });
  });
  window.addEventListener("popstate", () => setAdminSection(getInitialAdminSection()));
  setAdminSection(state.tab, {
    replace: window.location.pathname === "/portal/" || window.location.pathname === "/portal",
  });

  document.getElementById("refreshButton").addEventListener("click", loadAdminData);
  document.getElementById("portalAdminForm").addEventListener("submit", createPortalAdmin);
  document.getElementById("groupForm").addEventListener("submit", createGroup);
  document.getElementById("openAddMembersButton").addEventListener("click", openAddMembersModal);
  document.getElementById("memberSearchInput").addEventListener("input", renderAddMembersModal);
  document.getElementById("supportQuestionForm").addEventListener("submit", saveSupportQuestionAnswer);
  document.querySelectorAll("[data-modal-close]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.modalClose));
  });
  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeModal(backdrop.id);
    });
  });
  document.getElementById("groupsList").addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-group-delete]");
    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();
      deleteGroup(deleteButton);
      return;
    }

    const card = event.target.closest("[data-group-open]");
    if (card) openGroupModal(card.dataset.groupOpen);
  });
  document.getElementById("availableMembersList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-user-to-group]");
    if (button) addUserToActiveGroup(button);
  });
  document.getElementById("groupMembersList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-user-from-group]");
    if (button) removeUserFromActiveGroup(button);
  });
  document.getElementById("statusFilter").addEventListener("change", loadAdminData);
  document.getElementById("supportStatusFilter").addEventListener("change", renderSupportQuestions);
  document.getElementById("searchInput").addEventListener(
    "input",
    debounce(() => {
      if (state.tab === "orders") {
        loadAdminData();
      } else if (state.tab === "users") {
        renderUsers();
      } else if (state.tab === "admins") {
        renderPortalAdmins();
      } else if (state.tab === "groups") {
        renderGroups();
      } else if (state.tab === "support") {
        renderSupportQuestions();
      }
    }, 250)
  );
  document.getElementById("portalAdminsTable").addEventListener("click", (event) => {
    const button = event.target.closest("[data-portal-admin-id]");
    if (button) togglePortalAdmin(button);
  });
  document.getElementById("supportQuestionsTable").addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-support-open]");
    if (openButton) {
      openSupportQuestionModal(openButton.dataset.supportOpen);
      return;
    }

    const button = event.target.closest("[data-support-answer]");
    if (button) openSupportQuestionModal(button.dataset.supportAnswer);
  });
  document.getElementById("usersTable").addEventListener("click", (event) => {
    const option = event.target.closest("[data-group-option]");
    if (option) {
      const dropdown = option.closest("[data-group-dropdown]");
      const userId = dropdown?.dataset.groupDropdown;
      const input = document.querySelector(`[data-group-combobox="${CSS.escape(userId)}"]`);
      if (input) {
        input.value = option.dataset.groupOption || "";
        input.setCustomValidity("");
        updateGroupSaveState(input);
      }
      closeGroupDropdowns();
      return;
    }

    const input = event.target.closest("[data-group-combobox]");
    if (input) {
      renderGroupDropdown(input);
      return;
    }

    const groupButton = event.target.closest("[data-group-save]");
    if (groupButton) {
      saveUserGroup(groupButton).catch(() => {});
      return;
    }

    const button = event.target.closest("[data-user-id]");
    if (button) toggleDriverBlock(button);
  });
  document.getElementById("usersTable").addEventListener("keydown", (event) => {
    const input = event.target.closest("[data-group-combobox]");
    if (input && event.key === "Enter") {
      event.preventDefault();
      const button = document.querySelector(`[data-group-save="${CSS.escape(input.dataset.groupCombobox)}"]`);
      if (button) saveUserGroup(button).catch(() => {});
    } else if (input && event.key === "Escape") {
      closeGroupDropdowns();
    }
  });
  document.getElementById("usersTable").addEventListener("input", (event) => {
    const input = event.target.closest("[data-group-combobox]");
    if (input) {
      input.setCustomValidity("");
      renderGroupDropdown(input);
      updateGroupSaveState(input);
    }
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".group-editor")) closeGroupDropdowns();
  });
}

function metricCard(label, value, note = "") {
  return `
    <article class="stat-card">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
      <div class="stat-note">${note}</div>
    </article>
  `;
}

function metricRow(label, value, percent = null) {
  const width = Math.max(0, Math.min(100, Number(percent) || 0));
  return `
    <div class="metric-row">
      <div>
        <strong>${label}</strong>
        <div class="metric-bar"><span style="width: ${width}%"></span></div>
      </div>
      <div class="metric-value">${value}</div>
    </div>
  `;
}

function getAnalyticsRangeForDays(days) {
  const parsedDays = Number.parseInt(days, 10);
  const safeDays = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 30;
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - safeDays + 1);
  return {
    from: dateInputValue(start),
    to: dateInputValue(end),
  };
}

function setAnalyticsDateRangeFromPeriod() {
  const days = document.getElementById("analyticsDays")?.value || "30";
  const range = getAnalyticsRangeForDays(days);
  const fromInput = document.getElementById("analyticsDateFrom");
  const toInput = document.getElementById("analyticsDateTo");
  if (fromInput) fromInput.value = range.from;
  if (toInput) toInput.value = range.to;
}

function syncAnalyticsDriverOptions(drivers = []) {
  const select = document.getElementById("analyticsDriver");
  if (!select) return;
  const selected = select.value || "ALL";
  select.innerHTML = [
    `<option value="ALL">Усі водії</option>`,
    ...drivers.map((driver) => {
      const display = userDisplay(driver);
      return `<option value="${escapeHtml(driver.id)}">${escapeHtml(display.name)}${display.contact !== "-" ? ` · ${escapeHtml(display.contact)}` : ""}</option>`;
    }),
  ].join("");
  select.value = [...select.options].some((option) => option.value === selected) ? selected : "ALL";
}

function getAnalyticsReportQuery() {
  const params = new URLSearchParams();
  const days = document.getElementById("analyticsDays")?.value || "30";
  const driverId = document.getElementById("analyticsDriver")?.value || "ALL";
  const dateFrom = document.getElementById("analyticsDateFrom")?.value || "";
  const dateTo = document.getElementById("analyticsDateTo")?.value || "";

  params.set("days", days);
  if (driverId && driverId !== "ALL") params.set("driverId", driverId);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  return params;
}

function sumBy(rows, field) {
  return rows.reduce((total, row) => {
    const value = Number(row?.[field]);
    return Number.isFinite(value) ? total + value : total;
  }, 0);
}

function renderDriverReport(report) {
  const table = document.getElementById("driverReportTable");
  const footer = document.getElementById("driverReportFooter");
  const count = document.getElementById("driverReportCount");
  if (!table || !count) return;

  const rows = report?.driverRows || [];
  count.textContent = `${rows.length} водіїв`;
  if (!rows.length) {
    table.innerHTML = `<tr><td colspan="10" class="muted">Немає даних за вибраний період</td></tr>`;
    if (footer) footer.innerHTML = "";
    return;
  }

  table.innerHTML = rows
    .map((row) => {
      const display = row.driver ? userDisplay(row.driver) : { name: "Без водія", contact: "-" };
      return `
        <tr>
          <td class="user-cell">
            <strong>${escapeHtml(display.name)}</strong>
            <span class="muted">${escapeHtml(display.contact)}</span>
          </td>
          <td><strong>${number(row.orderCount)}</strong></td>
          <td>${number(row.completedCount)}</td>
          <td>${number(row.activeCount)}</td>
          <td>${number(row.cancelledCount)}</td>
          <td>${escapeHtml(money(row.totalRevenue))}</td>
          <td>${escapeHtml(km(row.totalDistanceKm))}</td>
          <td>${escapeHtml(km(row.avgDistanceKm))}</td>
          <td>${escapeHtml(duration(row.avgTotalDurationMinutes))}</td>
          <td>${escapeHtml(duration(row.avgCargoDurationMinutes))}</td>
        </tr>
      `;
    })
    .join("");

  if (footer) {
    const totalOrders = sumBy(rows, "orderCount");
    const totalCompleted = sumBy(rows, "completedCount");
    const totalActive = sumBy(rows, "activeCount");
    const totalCancelled = sumBy(rows, "cancelledCount");
    const totalRevenue = sumBy(rows, "totalRevenue");
    const totalDistance = sumBy(rows, "totalDistanceKm");
    footer.innerHTML = `
      <tr class="table-total-row">
        <td>Разом</td>
        <td>${number(totalOrders)}</td>
        <td>${number(totalCompleted)}</td>
        <td>${number(totalActive)}</td>
        <td>${number(totalCancelled)}</td>
        <td>${escapeHtml(money(totalRevenue))}</td>
        <td>${escapeHtml(km(totalDistance))}</td>
        <td colspan="3"></td>
      </tr>
    `;
  }
}

function orderRouteText(order) {
  return `${text(order.pickupCity || order.pickupLocation)} → ${text(order.dropoffCity || order.dropoffLocation)}`;
}

function getOrderPhotos(order) {
  return normalizePhotoList(order?.photos);
}

function mergeOrderPhotosIntoReport(report, orders = []) {
  const photosByOrderId = new Map(
    orders
      .map((order) => [String(order.id), getOrderPhotos(order)])
      .filter(([, photos]) => photos.length > 0)
  );

  return {
    ...report,
    orderRows: (report?.orderRows || []).map((order) => {
      const photos = getOrderPhotos(order);
      if (photos.length) return { ...order, photos };
      return { ...order, photos: photosByOrderId.get(String(order.id)) || [] };
    }),
  };
}

function renderOrderPhotoGallery(order) {
  const photos = getOrderPhotos(order);
  if (!photos.length) {
    return `
      <div class="order-photo-section empty">
        <span class="detail-label">Фото</span>
        <span class="muted">Фото не додано</span>
      </div>
    `;
  }

  return `
    <div class="order-photo-section">
      <span class="detail-label">Фото</span>
      <div class="order-photo-gallery">
        ${photos
          .map(
            (photo, index) => `
              <a class="order-photo-link" href="${escapeHtml(photo)}" target="_blank" rel="noopener">
                <img src="${escapeHtml(photo)}" alt="Фото замовлення ${index + 1}" loading="lazy" />
              </a>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderOrderReport(report) {
  const table = document.getElementById("orderReportTable");
  const footer = document.getElementById("orderReportFooter");
  const count = document.getElementById("orderReportCount");
  if (!table || !count) return;

  const rows = report?.orderRows || [];
  count.textContent = `${rows.length} замовлень`;
  if (!rows.length) {
    table.innerHTML = `<tr><td colspan="10" class="muted">Немає замовлень за вибраний період</td></tr>`;
    if (footer) footer.innerHTML = "";
    return;
  }

  table.innerHTML = rows
    .map((order) => {
      const driver = order.driver ? userDisplay(order.driver) : { name: "Без водія", contact: "-" };
      const route = orderRouteText(order);
      const detailId = `order-report-detail-${order.id}`;
      const photos = getOrderPhotos(order);
      return `
        <tr>
          <td>
            <button class="expand-button" type="button" data-order-report-toggle="${escapeHtml(detailId)}" aria-expanded="false" aria-label="Деталі замовлення">⌄</button>
          </td>
          <td><strong>${escapeHtml(order.orderNumber || order.id)}</strong></td>
          <td class="route-cell">
            <strong>${escapeHtml(route)}</strong>
            <span class="muted">${escapeHtml(order.cargoType || "-")}</span>
            ${photos.length ? `<span class="support-attachment-note">${photos.length} фото</span>` : ""}
          </td>
          <td class="user-cell">
            <strong>${escapeHtml(driver.name)}</strong>
            <span class="muted">${escapeHtml(driver.contact)}</span>
          </td>
          <td>${statusBadge(order.status)}</td>
          <td>${escapeHtml(km(order.roadDistanceKm))}</td>
          <td>${escapeHtml(duration(order.totalDurationMinutes))}</td>
          <td>${escapeHtml(duration(order.cargoDurationMinutes))}</td>
          <td>${escapeHtml(money(order.revenue))}</td>
          <td class="muted">${escapeHtml(date(order.createdAt))}</td>
        </tr>
        <tr class="order-detail-row hidden" id="${escapeHtml(detailId)}">
          <td colspan="10">
            <div class="order-detail-grid">
              <div>
                <span class="detail-label">Завантаження</span>
                <strong>${escapeHtml(text(order.pickupCity || order.pickupLocation))}</strong>
                <span class="muted">${escapeHtml(text(order.pickupAddress))}</span>
              </div>
              <div>
                <span class="detail-label">Вивантаження</span>
                <strong>${escapeHtml(text(order.dropoffCity || order.dropoffLocation))}</strong>
                <span class="muted">${escapeHtml(text(order.dropoffAddress))}</span>
              </div>
              <div>
                <span class="detail-label">Створено</span>
                <strong>${escapeHtml(date(order.createdAt))}</strong>
              </div>
              <div>
                <span class="detail-label">Прийнято</span>
                <strong>${escapeHtml(date(order.acceptedAt))}</strong>
              </div>
              <div>
                <span class="detail-label">Отримав</span>
                <strong>${escapeHtml(date(order.receivedAt))}</strong>
              </div>
              <div>
                <span class="detail-label">Віддав</span>
                <strong>${escapeHtml(date(order.deliveredAt))}</strong>
              </div>
              <div>
                <span class="detail-label">Сума оформлення</span>
                <strong>${escapeHtml(money(order.revenue))}</strong>
              </div>
              ${renderOrderPhotoGallery(order)}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  if (footer) {
    const totalRevenue = sumBy(rows, "revenue");
    const totalDistance = sumBy(rows, "roadDistanceKm");
    footer.innerHTML = `
      <tr class="table-total-row">
        <td colspan="5">Разом</td>
        <td>${escapeHtml(km(totalDistance))}</td>
        <td colspan="2"></td>
        <td>${escapeHtml(money(totalRevenue))}</td>
        <td></td>
      </tr>
    `;
  }
}

function renderAnalyticsReport(report) {
  syncAnalyticsDriverOptions(report?.drivers || []);
  renderDriverReport(report);
  renderOrderReport(report);
}

function isAnalyticsReportPage() {
  return page === "analytics-drivers" || page === "analytics-orders";
}

function renderAnalytics(data) {
  document.getElementById("analyticsStats").innerHTML = [
    metricCard("GMV за період", money(data?.gmv?.period?.value), `${data?.periodDays || 30} днів`),
    metricCard("GMV весь час", money(data?.gmv?.allTime), "усі закриті угоди"),
    metricCard("MAU", number(data?.activeUsers?.mau), `DAU ${number(data?.activeUsers?.dau)}`),
    metricCard("DAU / MAU", number(data?.activeUsers?.dauToMauPercent, "%"), "залученість"),
  ].join("");

  document.getElementById("liquidityRows").innerHTML = [
    metricRow("Знайшли водія", number(data?.liquidity?.foundDriverPercent, "%"), data?.liquidity?.foundDriverPercent),
    metricRow("Середній час закриття", number(data?.liquidity?.avgTimeToCloseHours, "год"), 100 - Math.min(100, data?.liquidity?.avgTimeToCloseHours || 0)),
    metricRow("Відгуків на замовлення", number(data?.liquidity?.responsesPerOrder), Math.min(100, (data?.liquidity?.responsesPerOrder || 0) * 20)),
    metricRow("Всього відгуків", number(data?.liquidity?.totalResponses), 100),
  ].join("");

  document.getElementById("retentionRows").innerHTML = [
    metricRow("7 днів", number(data?.retention?.retention7d?.percent, "%"), data?.retention?.retention7d?.percent),
    metricRow("30 днів", number(data?.retention?.retention30d?.percent, "%"), data?.retention?.retention30d?.percent),
    metricRow("90 днів", number(data?.retention?.retention90d?.percent, "%"), data?.retention?.retention90d?.percent),
    metricRow("Водіїв у базі", number(data?.retention?.driversTotal), 100),
  ].join("");
}

async function loadAnalytics() {
  setLoading(true);
  try {
    const days = document.getElementById("analyticsDays").value;
    if (isAnalyticsReportPage()) {
      const reportQuery = getAnalyticsReportQuery();
      const [report, orders] = await Promise.all([
        apiFetch(`/admin/analytics/order-report?${reportQuery.toString()}`),
        apiFetch("/admin/orders?limit=500&status=ALL").catch(() => []),
      ]);
      state.orders = Array.isArray(orders) ? orders : [];
      state.analyticsReport = mergeOrderPhotosIntoReport(report, state.orders);
      renderAnalyticsReport(state.analyticsReport);
      return;
    }

    const data = await apiFetch(`/admin/analytics/overview?days=${encodeURIComponent(days)}`);
    renderAnalytics(data);
  } finally {
    setLoading(false);
  }
}

function bindAnalytics() {
  setAnalyticsDateRangeFromPeriod();
  document.getElementById("refreshButton").addEventListener("click", loadAnalytics);
  document.getElementById("analyticsDays").addEventListener("change", () => {
    setAnalyticsDateRangeFromPeriod();
    loadAnalytics();
  });
  document.getElementById("analyticsDriver")?.addEventListener("change", loadAnalytics);
  document.getElementById("analyticsDateFrom")?.addEventListener("change", loadAnalytics);
  document.getElementById("analyticsDateTo")?.addEventListener("change", loadAnalytics);
  document.getElementById("orderReportTable")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-order-report-toggle]");
    if (!button) return;
    const row = document.getElementById(button.dataset.orderReportToggle);
    const isOpen = !row?.classList.contains("hidden");
    row?.classList.toggle("hidden", isOpen);
    button.classList.toggle("open", !isOpen);
    button.setAttribute("aria-expanded", String(!isOpen));
  });
}

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}

async function boot() {
  if (!state.token) {
    showAuth(true);
    return;
  }

  try {
    await loadProfile();
    if (!state.user?.isPortalAdmin) {
      throw new Error("Потрібен адмінський доступ");
    }
    showAuth(false);
  } catch (error) {
    loginError.textContent = error.message || "Сесія недійсна";
    logout();
    return;
  }

  try {
    if (page === "admin") {
      await loadAdminData();
    } else if (page === "analytics" || isAnalyticsReportPage()) {
      await loadAnalytics();
    }
  } catch (error) {
    showToast(error.message || "Не вдалося завантажити дані сторінки", "error");
  }
}

loginForm?.addEventListener("submit", login);
sendCodeButton?.addEventListener("click", sendPhoneCode);
document.querySelectorAll("[data-auth-method]").forEach((button) => {
  button.addEventListener("click", () => setAuthMethod(button.dataset.authMethod));
});
document.querySelectorAll('input[name="phone"]').forEach((input) => {
  ensurePhonePrefix(input);
  input.addEventListener("focus", () => ensurePhonePrefix(input));
  input.addEventListener("input", () => {
    ensurePhonePrefix(input);
    loginError?.classList.remove("success");
    if (loginError) loginError.textContent = "";
  });
});
document.getElementById("logoutButton")?.addEventListener("click", logout);
document.querySelector("[data-admin-nav-toggle]")?.addEventListener("click", toggleAdminNavGroup);

setAuthMethod(state.authMethod);
if (page === "admin") bindAdmin();
if (page === "analytics" || isAnalyticsReportPage()) bindAnalytics();
boot();
