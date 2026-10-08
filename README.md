# Vango Logistics Backend

Backend API for a logistics service mobile app using Node.js, Express and PostgreSQL.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables by copying `.env.example` to `.env` and setting values.

3. Run database migrations and seed basic data:
```bash
npm run seed
```

4. Start the server:
```bash
npm run dev
```


## Searching for Nearby Orders

The `GET /orders` endpoint accepts `lat`, `lon` and `radius` (in
kilometers) query parameters. All orders with pickup coordinates inside
the specified radius are returned. Coordinates are required – the
service does not perform address geocoding for this filter.

## Push Notification Consent

Users must explicitly agree to receiving push notifications. Call
`PUT /auth/push-consent` with `{ "consent": true }` in the request body
to enable notifications for the current user. Pass `false` to revoke the
consent.

## Agent Workspace

Agent setup is documented in `AGENTS.md`.

- Graph map: `25-AgentGraph/MOC - graph map.md`
- Saved plans: `10-Projects/plans/`
- Planning template: `templates/Agent-planning-brief.md`
- Agent graph node template: `templates/Agent-graph-node.md`

The repository root also acts as the vault root for agent notes and plans.


## Диспетчер у веб-порталі

Диспетчер — додаткове право `isDispatcher`, яке адміністратор надає користувачу
з робочою роллю `CUSTOMER` або `BOTH`. Роль і можливості мобільного застосунку
залишаються чинними. У веб-кабінеті диспетчер бачить власні замовлення та
розширені звіти; звичайний Замовник зберігає базовий звіт.

Перед оновленням API застосуйте до цільової БД адитивну міграцію:

```bash
node scripts/migrate-dispatcher-access.js up
```

Команда використовує чинну конфігурацію підключення backend і не запускає seed
або schema sync. Для відкату спочатку поверніть попередню версію застосунку,
потім виконайте цю команду з `down` (видаляє лише поле права диспетчера).

Адміністративне керування доступом:
`PATCH /api/admin/users/:id/dispatcher-access` з `{ "enabled": true }` або
`{ "enabled": false }`. Зміна діє на наступному запиті з чинним токеном.

Веб-API диспетчера:

- `GET /api/dispatcher/orders` — власні замовлення.
- `GET /api/dispatcher/orders/:id` — деталі власного замовлення.
- `GET /api/dispatcher/analytics/order-report` — звіт за власними замовленнями.

Фільтри звіту: `days` (default 30), `dateFrom`, `dateTo` (UTC календарні дати),
`driverId`; пагінація `page` (default 1), `pageSize` (default 50, максимум 100).
Підсумки й статистика водіїв охоплюють весь відфільтрований набір, незалежно від
сторінки. Експорт не включено.

У v1 погоджено виняток: чинні публічні URL `/uploads` залишаються доступними,
щоб зберегти мобільний перегляд фото. API звіту повертає лише посилання з
дозволених замовлень; прямий доступ за відомим URL не захищений авторизацією.

Перевірки без читання `.env` і без робочої БД:

```bash
DISPATCHER_TEST_DATABASE_URL=postgres://USER@HOST:PORT/vango_dispatcher_test node --test tests/dispatcher.integration.test.js
node --test webUserPortal/tests/dispatcher-report.test.mjs
```

Інтеграційний тест створює схему заново **лише в ізольованій тестовій БД**
`vango_dispatcher_test`. Не підключайте його до бази з потрібними даними.
