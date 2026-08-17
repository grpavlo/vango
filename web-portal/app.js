const state = {
  token: localStorage.getItem("vango.portal.token") || "",
  user: null,
  users: [],
  orders: [],
  groups: [],
  tab: "orders",
  activeGroupId: null,
  addMembersOpen: false,
  authMethod: "email",
  loading: false,
};

const page = document.body.dataset.page;
const authGate = document.getElementById("authGate");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const sendCodeButton = document.getElementById("sendCodeButton");
const loginSubmitButton = document.getElementById("loginSubmitButton");
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

function text(value, fallback = "-") {
  const normalized = value === null || value === undefined ? "" : String(value).trim();
  return normalized || fallback;
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
    throw new Error(message || `HTTP ${response.status}`);
  }
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : response.text();
}

function showAuth(show) {
  authGate?.classList.toggle("hidden", !show);
}

function setLoading(isLoading) {
  state.loading = isLoading;
  document.querySelectorAll("#refreshButton").forEach((button) => {
    button.disabled = isLoading;
    button.textContent = isLoading ? "Оновлення..." : "Оновити";
  });
}

async function login(event) {
  event.preventDefault();
  loginError.classList.remove("success");
  loginError.textContent = "";
  const formData = new FormData(loginForm);
  try {
    const result =
      state.authMethod === "phone"
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
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

async function loginWithPhone(formData) {
  const phone = String(formData.get("phone") || "").trim();
  const code = String(formData.get("code") || "").trim();
  if (!phone) {
    throw new Error("Вкажіть номер телефону");
  }
  if (!/^\d{6}$/.test(code)) {
    throw new Error("Введіть 6-значний SMS-код");
  }
  return apiFetch("/auth/verify-code", {
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

  const previousText = sendCodeButton.textContent;
  sendCodeButton.disabled = true;
  sendCodeButton.textContent = "Надсилання...";
  try {
    await apiFetch("/auth/send-code", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
    sendCodeButton.classList.remove("dirty");
    loginError.classList.add("success");
    loginError.textContent = "Код надіслано. Введіть його нижче.";
  } catch (error) {
    loginError.classList.remove("success");
    loginError.textContent = error.message || "Не вдалося надіслати код";
  } finally {
    sendCodeButton.disabled = false;
    sendCodeButton.textContent = previousText;
  }
}

function setAuthMethod(method) {
  state.authMethod = method;
  document.querySelectorAll("[data-auth-method]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authMethod === method);
  });
  document.querySelectorAll("[data-auth-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.authPanel !== method);
  });
  if (loginSubmitButton) {
    loginSubmitButton.textContent = method === "phone" ? "Увійти за кодом" : "Увійти";
  }
  loginError.classList.remove("success");
  loginError.textContent = "";
}

function logout() {
  state.token = "";
  state.user = null;
  localStorage.removeItem("vango.portal.token");
  showAuth(true);
}

async function loadProfile() {
  if (!state.token) return null;
  state.user = await apiFetch("/auth/me");
  return state.user;
}

function renderAdminStats() {
  const totalUsers = state.users.length;
  const drivers = state.users.filter((user) => ["DRIVER", "BOTH"].includes(user.role)).length;
  const blocked = state.users.filter((user) => user.blocked).length;
  const activeOrders = state.orders.filter((order) => !["COMPLETED", "CANCELLED", "REJECTED"].includes(order.status)).length;
  const completed = state.orders.filter((order) => order.status === "COMPLETED").length;

  document.getElementById("adminStats").innerHTML = [
    ["Користувачів", totalUsers, `${drivers} водіїв`],
    ["Замовлень", state.orders.length, `${activeOrders} активних`],
    ["Команд", state.groups.length, "груп доступу"],
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
      return `
        <tr>
          <td>${escapeHtml(user.id)}</td>
          <td class="user-cell">
            <strong>${escapeHtml(text(user.name))}</strong>
            <span class="muted">${escapeHtml(text(user.phone || user.email))}</span>
          </td>
          <td>${escapeHtml(roleLabels[user.role] || user.role)}</td>
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

function renderAdmin() {
  renderAdminStats();
  renderOrders();
  renderUsers();
  renderGroups();
}

async function loadAdminData() {
  setLoading(true);
  try {
    const status = document.getElementById("statusFilter").value;
    const q = document.getElementById("searchInput").value.trim();
    const params = new URLSearchParams({ limit: "300", status });
    if (q) params.set("q", q);
    const [users, orders, groups] = await Promise.all([
      apiFetch("/admin/users"),
      apiFetch(`/admin/orders?${params.toString()}`),
      apiFetch("/admin/groups"),
    ]);
    state.users = users;
    state.orders = orders;
    state.groups = groups;
    renderAdmin();
    if (state.activeGroupId) renderGroupModal();
    if (state.addMembersOpen) renderAddMembersModal();
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

function bindAdmin() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.tab = tab.dataset.tab;
      document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === tab));
      document.getElementById("ordersPanel").classList.toggle("hidden", state.tab !== "orders");
      document.getElementById("usersPanel").classList.toggle("hidden", state.tab !== "users");
      document.getElementById("groupsPanel").classList.toggle("hidden", state.tab !== "groups");
      document.getElementById("statusFilter").classList.toggle("hidden", state.tab !== "orders");
    });
  });

  document.getElementById("refreshButton").addEventListener("click", loadAdminData);
  document.getElementById("groupForm").addEventListener("submit", createGroup);
  document.getElementById("openAddMembersButton").addEventListener("click", openAddMembersModal);
  document.getElementById("memberSearchInput").addEventListener("input", renderAddMembersModal);
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
  document.getElementById("searchInput").addEventListener(
    "input",
    debounce(() => {
      if (state.tab === "orders") {
        loadAdminData();
      } else if (state.tab === "users") {
        renderUsers();
      } else if (state.tab === "groups") {
        renderGroups();
      }
    }, 250)
  );
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
    const data = await apiFetch(`/admin/analytics/overview?days=${encodeURIComponent(days)}`);
    renderAnalytics(data);
  } finally {
    setLoading(false);
  }
}

function bindAnalytics() {
  document.getElementById("refreshButton").addEventListener("click", loadAnalytics);
  document.getElementById("analyticsDays").addEventListener("change", loadAnalytics);
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
    if (!state.user?.isAdmin && state.user?.role !== "ADMIN") {
      throw new Error("Потрібен адмінський доступ");
    }
    showAuth(false);
    if (page === "admin") {
      await loadAdminData();
    } else if (page === "analytics") {
      await loadAnalytics();
    }
  } catch (error) {
    loginError.textContent = error.message || "Сесія недійсна";
    logout();
  }
}

loginForm?.addEventListener("submit", login);
sendCodeButton?.addEventListener("click", sendPhoneCode);
loginForm?.phone?.addEventListener("input", () => {
  sendCodeButton?.classList.add("dirty");
});
document.querySelectorAll("[data-auth-method]").forEach((button) => {
  button.addEventListener("click", () => setAuthMethod(button.dataset.authMethod));
});
document.getElementById("logoutButton")?.addEventListener("click", logout);

if (page === "admin") bindAdmin();
if (page === "analytics") bindAnalytics();
boot();
