# Vango Logistics Backend

Backend API for a logistics service mobile app using Node.js, Express and PostgreSQL.

## Тестовий акаунт App Review

Номер `380000000001` має демонстраційну анкету водія з явно позначеними
синтетичними зображеннями (`assets/demo-account/` → `/demo-assets/`). Профіль
доповнюється при старті сервера, вході або читанні `/api/auth/me`; статус
`DRAFT` не означає перевірку справжніх документів. Наявні поля не перезаписуються.

Admin/dispatcher права цього номера відкликаються; старі токени й пов’язаний
PortalAdmin також не дають привілейованого доступу. Звичайні API профілю не
дозволяють привласнити або змінити зарезервований номер. Мобільний застосунок
показує банер «Тестовий акаунт» і пропускає первинну анкету водія лише за
серверним підтвердженням готового демопрофілю. Це не ізольована пісочниця:
видимі замовлення можуть належати поточному середовищу.

Зміни в репозиторії набудуть чинності для рев’юера після окремого
розгортання backend і встановлення відповідної мобільної збірки.

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

## AI бот підтримки

Без `SUPPORT_BOT_PROVIDER` бот використовує OpenAI (сумісна попередня поведінка).
Для Claude задайте в оточенні процесу backend:

```dotenv
SUPPORT_BOT_PROVIDER=anthropic
ANTHROPIC_API_KEY=<YOUR_ANTHROPIC_API_KEY>
ANTHROPIC_MODEL=claude-haiku-5-5
SUPPORT_BOT_TIMEOUT_MS=10000
```

Пріоритет налаштувань:

| Провайдер | Ключ | Модель |
| --- | --- | --- |
| `openai` (типово) | `SUPPORT_BOT_API_KEY`, потім `OPENAI_API_KEY` | `SUPPORT_BOT_MODEL`, потім `OPENAI_MODEL`, потім `gpt-4o-mini` |
| `anthropic` | `SUPPORT_BOT_API_KEY`, потім `ANTHROPIC_API_KEY` | `SUPPORT_BOT_MODEL`, потім `ANTHROPIC_MODEL`, потім `claude-haiku-5-5` |

Якщо раніше задані `SUPPORT_BOT_API_KEY` або `SUPPORT_BOT_MODEL`, оператор має
прибрати їх або замінити значеннями для Claude: вони мають найвищий пріоритет.
`OPENAI_API_KEY` і `OPENAI_MODEL` не використовуються для Anthropic, і навпаки.
Невідомий провайдер, відсутній ключ, помилка API або порожня відповідь переводять
бота на локальні відповіді. Таймаут скасовує запит; `publicMode` завжди працює
локально. Контракт відповіді залишається `{ answer, source }`.

Anthropic використовує `POST https://api.anthropic.com/v1/messages`, заголовки
`x-api-key` та `anthropic-version: 2026-10-21`, поле `system`, історію `messages`
(до восьми попередніх повідомлень) і `max_tokens: 1024`. З відповіді беруться лише
блоки `content` з типом `text`. Якщо Anthropic повертає `stop_reason: max_tokens`,
бот використовує локальну відповідь замість обірваного тексту.
Формат перевірено за [офіційною документацією Messages API](https://platform.claude.com/docs/en/api/http/messages/create),
модель — за [переліком моделей Anthropic](https://platform.claude.com/docs/en/models/overview).

Для увімкнення на сервері оператор має встановити ці змінні через чинний механізм
керування секретами/оточенням і перезапустити backend з оновленим оточенням.
Не записуйте справжні ключі в репозиторій. Для повернення до OpenAI задайте
`SUPPORT_BOT_PROVIDER=openai` та відповідні ключ і модель.

Перевірки без мережевих запитів, платних API, `.env` або БД:

```bash
node --test tests/support-bot.test.js
```
