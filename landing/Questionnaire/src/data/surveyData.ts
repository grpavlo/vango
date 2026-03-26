export interface SurveyOption {
  label: string;
  value: string;
  feedback: string;
  next: string;
}

export interface IntroNode {
  type: "intro";
  title: string;
  text: string;
  next: string;
}

export interface ChoiceNode {
  type: "choice";
  question: string;
  options: SurveyOption[];
}

export interface TextNode {
  type: "text";
  question: string;
  placeholder: string;
  hint: string;
  next: string;
}

export interface EndNode {
  type: "end";
  title: string;
  text: string;
}

export type SurveyNode = IntroNode | ChoiceNode | TextNode | EndNode;

export interface SurveyAnswer {
  question: string;
  label: string;
  value: string;
  feedback?: string;
  next?: string;
}

export const surveyData: { start: string; nodes: Record<string, SurveyNode> } = {
  start: "intro",
  nodes: {
    intro: {
      type: "intro",
      title: "Рухайся вільно — обирай мобільно",
      text: "VanGo (van go, vango, ванго, ван го) — це українська платформа перевезень, яка поєднує водіїв і замовників для доставки вантажів по місту та між містами України.",
      next: "q_role",
    },
    q_role: {
      type: "choice",
      question: "Ким ви себе більше бачите?",
      options: [
        { label: "🚗 Водій (хочу заробляти)", value: "driver", feedback: "Круто! Ми допоможемо вам знаходити замовлення.", next: "q_driver_now" },
        { label: "📦 Замовник (хочу відправляти)", value: "customer", feedback: "Чудово! Ми працюємо над зручною доставкою для вас.", next: "q_customer_important" },
        { label: "🔄 Обидва варіанти", value: "both", feedback: "Універсал! Ми врахуємо обидві сторони.", next: "both_driver_transport" },
        { label: "🤔 Ще не знаю, просто цікаво", value: "curious", feedback: "Без проблем! Давайте дізнаємось більше.", next: "q_customer_important" },
      ],
    },

    // ===== БЛОК ВОДІЯ (стандартний) =====
    q_driver_now: {
      type: "choice",
      question: "Чи працюєте ви зараз водієм?",
      options: [
        { label: "✅ Так", value: "yes", feedback: "Чудово, давайте дізнаємось більше про вашу роботу.", next: "q_driver_transport" },
        { label: "❌ Ні", value: "no", feedback: "Зрозуміло! Можливо, вам буде цікаво.", next: "q_want_drive" },
      ],
    },
    q_driver_transport: {
      type: "choice",
      question: "Який транспорт ви використовуєте?",
      options: [
        { label: "🚐 Фургон (Van)", value: "van", feedback: "Фургон — універсальний варіант!", next: "q_find_orders" },
        { label: "🛻 Пікап", value: "pickup", feedback: "Пікап — зручно для різних вантажів.", next: "q_find_orders" },
        { label: "🚛 Малий вантажний (до 3.5т)", value: "small_truck", feedback: "Малий вантажний — серйозний підхід!", next: "q_find_orders" },
        { label: "🔧 Інше", value: "other", feedback: "Добре, врахуємо!", next: "q_find_orders" },
      ],
    },
    q_find_orders: {
      type: "choice",
      question: "Як ви зараз знаходите замовлення?",
      options: [
        { label: "💬 Viber / Telegram групи", value: "messengers", feedback: "Месенджери — швидко і зручно.", next: "q_deliveries_week" },
        { label: "📋 Біржі перевезень", value: "exchanges", feedback: "Біржі — класичний спосіб.", next: "q_deliveries_week" },
        { label: "👥 Постійні клієнти", value: "regulars", feedback: "Постійні клієнти — основа стабільності.", next: "q_deliveries_week" },
        { label: "🌐 OLX / оголошення", value: "olx", feedback: "OLX — популярний канал.", next: "q_deliveries_week" },
      ],
    },
    q_deliveries_week: {
      type: "choice",
      question: "Скільки перевезень ви виконуєте за тиждень?",
      options: [
        { label: "1–5", value: "1-5", feedback: "Невеликий обсяг, але стабільно.", next: "q_avg_price" },
        { label: "5–10", value: "5-10", feedback: "Непоганий темп!", next: "q_avg_price" },
        { label: "10–20", value: "10-20", feedback: "Серйозний обсяг роботи!", next: "q_avg_price" },
        { label: "20+", value: "20+", feedback: "Ви справжній професіонал!", next: "q_avg_price" },
      ],
    },
    q_avg_price: {
      type: "choice",
      question: "Яка середня вартість одного перевезення?",
      options: [
        { label: "💵 до $20", value: "under_20", feedback: "Бюджетний сегмент.", next: "q_biggest_problem" },
        { label: "💵 $20–$50", value: "20-50", feedback: "Середній діапазон.", next: "q_biggest_problem" },
        { label: "💰 $50–$100", value: "50-100", feedback: "Хороший рівень!", next: "q_biggest_problem" },
        { label: "💎 $100+", value: "100+", feedback: "Преміум-сегмент!", next: "q_biggest_problem" },
      ],
    },
    q_biggest_problem: {
      type: "choice",
      question: "Яка найбільша проблема у вашій роботі?",
      options: [
        { label: "🔎 Складно знайти замовлення", value: "find_orders", feedback: "Ми це вирішимо!", next: "q_use_app" },
        { label: "📉 Низькі ціни", value: "low_prices", feedback: "Справедлива ціна — наш пріоритет.", next: "q_use_app" },
        { label: "😤 Ненадійні клієнти", value: "unreliable_clients", feedback: "Верифікація клієнтів допоможе.", next: "q_use_app" },
        { label: "⏳ Затримки оплат", value: "payment_delays", feedback: "Швидкі виплати — обов'язково.", next: "q_use_app" },
        { label: "🔧 Інше", value: "other", feedback: "Дякуємо, врахуємо!", next: "q_use_app" },
      ],
    },
    q_use_app: {
      type: "choice",
      question: "Чи користувалися б ви додатком, який дає замовлення напряму?",
      options: [
        { label: "👍 Так", value: "yes", feedback: "Чудово! Саме це ми будуємо.", next: "q_commission" },
        { label: "🤔 Можливо", value: "maybe", feedback: "Спробуйте — і вирішите!", next: "q_commission" },
        { label: "👎 Ні", value: "no", feedback: "Зрозуміло, дякуємо за чесність.", next: "q_commission" },
      ],
    },
    q_commission: {
      type: "choice",
      question: "Яка комісія сервісу для вас прийнятна?",
      options: [
        { label: "1–2%", value: "1-2", feedback: "Мінімальна комісія — ми це враховуємо.", next: "q_name_input" },
        { label: "3–5%", value: "3-5", feedback: "Збалансований варіант.", next: "q_name_input" },
        { label: "5–10%", value: "5-10", feedback: "Дякуємо за відповідь!", next: "q_name_input" },
      ],
    },

    // Гілка "Ні" — не працює водієм
    q_want_drive: {
      type: "choice",
      question: "Чи хотіли б ви працювати водієм?",
      options: [
        { label: "👍 Так", value: "yes", feedback: "Чудово! Давайте дізнаємось про ваш транспорт.", next: "q_potential_transport" },
        { label: "👎 Ні", value: "no", feedback: "Зрозуміло, дякуємо!", next: "q_name_input" },
      ],
    },
    q_potential_transport: {
      type: "choice",
      question: "Який у вас транспорт?",
      options: [
        { label: "🚐 Фургон", value: "van", feedback: "Фургон — чудовий вибір!", next: "q_name_input" },
        { label: "🛻 Пікап", value: "pickup", feedback: "Пікап — зручно!", next: "q_name_input" },
        { label: "🚛 Малий вантажний", value: "small_truck", feedback: "Серйозний підхід!", next: "q_name_input" },
        { label: "🔧 Інше", value: "other", feedback: "Добре, врахуємо!", next: "q_name_input" },
      ],
    },

    // ===== БЛОК ВОДІЯ (для "Обидва варіанти") =====
    both_driver_transport: {
      type: "choice",
      question: "Який транспорт ви використовуєте?",
      options: [
        { label: "🚐 Фургон (Van)", value: "van", feedback: "Фургон — універсальний варіант!", next: "both_find_orders" },
        { label: "🛻 Пікап", value: "pickup", feedback: "Пікап — зручно для різних вантажів.", next: "both_find_orders" },
        { label: "🚛 Малий вантажний (до 3.5т)", value: "small_truck", feedback: "Малий вантажний — серйозний підхід!", next: "both_find_orders" },
        { label: "🔧 Інше", value: "other", feedback: "Добре, врахуємо!", next: "both_find_orders" },
      ],
    },
    both_find_orders: {
      type: "choice",
      question: "Як ви зараз знаходите замовлення?",
      options: [
        { label: "💬 Viber / Telegram групи", value: "messengers", feedback: "Месенджери — швидко і зручно.", next: "both_deliveries_week" },
        { label: "📋 Біржі перевезень", value: "exchanges", feedback: "Біржі — класичний спосіб.", next: "both_deliveries_week" },
        { label: "👥 Постійні клієнти", value: "regulars", feedback: "Постійні клієнти — основа стабільності.", next: "both_deliveries_week" },
        { label: "🌐 OLX / оголошення", value: "olx", feedback: "OLX — популярний канал.", next: "both_deliveries_week" },
        { label: "🔍 Інше", value: "other", feedback: "Цікаво, врахуємо!", next: "both_deliveries_week" },
      ],
    },
    both_deliveries_week: {
      type: "choice",
      question: "Скільки перевезень ви виконуєте за тиждень?",
      options: [
        { label: "1–5", value: "1-5", feedback: "Невеликий обсяг, але стабільно.", next: "both_avg_price" },
        { label: "5–10", value: "5-10", feedback: "Непоганий темп!", next: "both_avg_price" },
        { label: "10–20", value: "10-20", feedback: "Серйозний обсяг роботи!", next: "both_avg_price" },
        { label: "20+", value: "20+", feedback: "Ви справжній професіонал!", next: "both_avg_price" },
      ],
    },
    both_avg_price: {
      type: "choice",
      question: "Яка середня вартість одного перевезення?",
      options: [
        { label: "💵 до $20", value: "under_20", feedback: "Бюджетний сегмент.", next: "both_biggest_problem" },
        { label: "💵 $20–$50", value: "20-50", feedback: "Середній діапазон.", next: "both_biggest_problem" },
        { label: "💰 $50–$100", value: "50-100", feedback: "Хороший рівень!", next: "both_biggest_problem" },
        { label: "💎 $100+", value: "100+", feedback: "Преміум-сегмент!", next: "both_biggest_problem" },
      ],
    },
    both_biggest_problem: {
      type: "choice",
      question: "Яка найбільша проблема у вашій роботі?",
      options: [
        { label: "🔎 Складно знайти замовлення", value: "find_orders", feedback: "Ми це вирішимо!", next: "both_use_app" },
        { label: "📉 Низькі ціни", value: "low_prices", feedback: "Справедлива ціна — наш пріоритет.", next: "both_use_app" },
        { label: "😤 Ненадійні клієнти", value: "unreliable_clients", feedback: "Верифікація клієнтів допоможе.", next: "both_use_app" },
        { label: "⏳ Затримки оплат", value: "payment_delays", feedback: "Швидкі виплати — обов'язково.", next: "both_use_app" },
        { label: "🔧 Інше", value: "other", feedback: "Дякуємо, врахуємо!", next: "both_use_app" },
      ],
    },
    both_use_app: {
      type: "choice",
      question: "Чи користувалися б ви додатком, який дає замовлення напряму?",
      options: [
        { label: "👍 Так", value: "yes", feedback: "Чудово! Саме це ми будуємо.", next: "both_commission" },
        { label: "🤔 Можливо", value: "maybe", feedback: "Спробуйте — і вирішите!", next: "both_commission" },
        { label: "👎 Ні", value: "no", feedback: "Зрозуміло, дякуємо за чесність.", next: "both_commission" },
      ],
    },
    both_commission: {
      type: "choice",
      question: "Яка комісія сервісу для вас прийнятна?",
      options: [
        { label: "1–2%", value: "1-2", feedback: "Мінімальна комісія — ми це враховуємо.", next: "both_what_ship" },
        { label: "3–5%", value: "3-5", feedback: "Збалансований варіант.", next: "both_what_ship" },
        { label: "5–10%", value: "5-10", feedback: "Дякуємо за відповідь!", next: "both_what_ship" },
      ],
    },

    // ===== БЛОК ЗАМОВНИКА (для "Обидва варіанти") =====
    both_what_ship: {
      type: "choice",
      question: "Що ви зазвичай перевозите?",
      options: [
        { label: "🛋️ Меблі", value: "furniture", feedback: "Меблі — популярна категорія!", next: "both_find_drivers" },
        { label: "📦 Посилки", value: "parcels", feedback: "Посилки — класика доставки.", next: "both_find_drivers" },
        { label: "💻 Побутову техніку", value: "tech", feedback: "Техніка потребує обережності.", next: "both_find_drivers" },
        { label: "🧱 Будівельні матеріали", value: "building", feedback: "Будматеріали — серйозні вантажі!", next: "both_find_drivers" },
        { label: "🔧 Інше", value: "other", feedback: "Добре, врахуємо!", next: "both_find_drivers" },
      ],
    },
    both_find_drivers: {
      type: "choice",
      question: "Як ви зараз знаходите водіїв?",
      options: [
        { label: "🌐 OLX / оголошення", value: "olx", feedback: "Онлайн — зручно, але не завжди надійно.", next: "both_how_often" },
        { label: "👥 Через знайомих", value: "friends", feedback: "Сарафанне радіо — перевірений спосіб.", next: "both_how_often" },
        { label: "🚚 Локальні служби доставки", value: "local", feedback: "Локальні служби — стабільний варіант.", next: "both_how_often" },
        { label: "💬 Telegram / групи", value: "telegram", feedback: "Месенджери — зручний канал.", next: "both_how_often" },
        { label: "🔍 Інше", value: "other", feedback: "Цікаво, врахуємо!", next: "both_how_often" },
      ],
    },
    both_how_often: {
      type: "choice",
      question: "Як часто вам потрібні перевезення?",
      options: [
        { label: "📅 Раз на місяць", value: "monthly", feedback: "Нечасто, але важливо.", next: "both_customer_problem" },
        { label: "📅 2–3 рази на місяць", value: "2-3_monthly", feedback: "Регулярна потреба!", next: "both_customer_problem" },
        { label: "📅 Щотижня", value: "weekly", feedback: "Щотижня — серйозний обсяг.", next: "both_customer_problem" },
        { label: "📅 Частіше", value: "more", feedback: "Вам точно потрібен надійний сервіс!", next: "both_customer_problem" },
      ],
    },
    both_customer_problem: {
      type: "choice",
      question: "Яка головна проблема зараз?",
      options: [
        { label: "🔎 Складно знайти водія", value: "find_driver", feedback: "Ми це вирішимо!", next: "both_customer_app" },
        { label: "💸 Немає зрозумілої ціни", value: "no_fixed_price", feedback: "Прозоре ціноутворення — наш пріоритет.", next: "both_customer_app" },
        { label: "🔒 Немає гарантій", value: "no_guarantees", feedback: "Гарантії — основа довіри.", next: "both_customer_app" },
        { label: "⏳ Довге очікування", value: "long_wait", feedback: "Швидкість — наша мета.", next: "both_customer_app" },
        { label: "🔧 Інше", value: "other", feedback: "Дякуємо, врахуємо!", next: "both_customer_app" },
      ],
    },
    both_customer_app: {
      type: "choice",
      question: "Чи користувалися б ви додатком для швидкого замовлення доставки?",
      options: [
        { label: "👍 Так", value: "yes", feedback: "Чудово! Саме це ми будуємо.", next: "both_delivery_priority" },
        { label: "🤔 Можливо", value: "maybe", feedback: "Спробуйте — і вирішите!", next: "both_delivery_priority" },
        { label: "👎 Ні", value: "no", feedback: "Зрозуміло, дякуємо за чесність.", next: "both_delivery_priority" },
      ],
    },
    both_delivery_priority: {
      type: "choice",
      question: "Що для вас найважливіше у доставці?",
      options: [
        { label: "⚡ Швидкість", value: "speed", feedback: "Швидкість — наша мета!", next: "q_early_access" },
        { label: "💰 Низька ціна", value: "low_price", feedback: "Доступність — важливий фактор.", next: "q_early_access" },
        { label: "🛡️ Надійність", value: "reliability", feedback: "Надійність — основа довіри.", next: "q_early_access" },
        { label: "📍 Можливість відстеження", value: "tracking", feedback: "Трекінг — сучасний стандарт!", next: "q_early_access" },
      ],
    },

    // ===== БЛОК ЗАМОВНИКА (стандартний) =====
    q_customer_important: {
      type: "choice",
      question: "Чи замовляєте ви перевезення вантажів?",
      options: [
        { label: "✅ Так", value: "yes", feedback: "Чудово! Розкажіть більше.", next: "q_what_ship" },
        { label: "❌ Ні", value: "no", feedback: "Зрозуміло, дякуємо!", next: "q_name_input" },
      ],
    },
    q_what_ship: {
      type: "choice",
      question: "Що ви зазвичай перевозите?",
      options: [
        { label: "🛋️ Меблі", value: "furniture", feedback: "Меблі — популярна категорія!", next: "q_find_drivers" },
        { label: "📦 Посилки", value: "parcels", feedback: "Посилки — класика доставки.", next: "q_find_drivers" },
        { label: "💻 Побутову техніку", value: "tech", feedback: "Техніка потребує обережності.", next: "q_find_drivers" },
        { label: "🧱 Будівельні матеріали", value: "building", feedback: "Будматеріали — серйозні вантажі!", next: "q_find_drivers" },
        { label: "🔧 Інше", value: "other", feedback: "Добре, врахуємо!", next: "q_find_drivers" },
      ],
    },
    q_find_drivers: {
      type: "choice",
      question: "Як ви зараз знаходите водіїв?",
      options: [
        { label: "🌐 OLX / оголошення", value: "olx", feedback: "Онлайн — зручно, але не завжди надійно.", next: "q_how_often" },
        { label: "👥 Через знайомих", value: "friends", feedback: "Сарафанне радіо — перевірений спосіб.", next: "q_how_often" },
        { label: "🚚 Локальні служби доставки", value: "local", feedback: "Локальні служби — стабільний варіант.", next: "q_how_often" },
        { label: "💬 Telegram / групи", value: "telegram", feedback: "Месенджери — зручний канал.", next: "q_how_often" },
        { label: "🔍 Інше", value: "other", feedback: "Цікаво, врахуємо!", next: "q_how_often" },
      ],
    },
    q_how_often: {
      type: "choice",
      question: "Як часто вам потрібні перевезення?",
      options: [
        { label: "📅 Раз на місяць", value: "monthly", feedback: "Нечасто, але важливо.", next: "q_customer_problem" },
        { label: "📅 2–3 рази на місяць", value: "2-3_monthly", feedback: "Регулярна потреба!", next: "q_customer_problem" },
        { label: "📅 Щотижня", value: "weekly", feedback: "Щотижня — серйозний обсяг.", next: "q_customer_problem" },
        { label: "📅 Частіше", value: "more", feedback: "Вам точно потрібен надійний сервіс!", next: "q_customer_problem" },
      ],
    },
    q_customer_problem: {
      type: "choice",
      question: "Яка головна проблема зараз?",
      options: [
        { label: "🔎 Складно знайти водія", value: "find_driver", feedback: "Ми це вирішимо!", next: "q_customer_app" },
        { label: "💸 Немає зрозумілої ціни", value: "no_fixed_price", feedback: "Прозоре ціноутворення — наш пріоритет.", next: "q_customer_app" },
        { label: "🔒 Немає гарантій", value: "no_guarantees", feedback: "Гарантії — основа довіри.", next: "q_customer_app" },
        { label: "⏳ Довге очікування", value: "long_wait", feedback: "Швидкість — наша мета.", next: "q_customer_app" },
        { label: "🔧 Інше", value: "other", feedback: "Дякуємо, врахуємо!", next: "q_customer_app" },
      ],
    },
    q_customer_app: {
      type: "choice",
      question: "Чи користувалися б ви додатком для швидкого замовлення доставки?",
      options: [
        { label: "👍 Так", value: "yes", feedback: "Чудово! Саме це ми будуємо.", next: "q_delivery_priority" },
        { label: "🤔 Можливо", value: "maybe", feedback: "Спробуйте — і вирішите!", next: "q_delivery_priority" },
        { label: "👎 Ні", value: "no", feedback: "Зрозуміло, дякуємо за чесність.", next: "q_delivery_priority" },
      ],
    },
    q_delivery_priority: {
      type: "choice",
      question: "Що для вас найважливіше у доставці?",
      options: [
        { label: "⚡ Швидкість", value: "speed", feedback: "Швидкість — наша мета!", next: "q_early_access" },
        { label: "💰 Низька ціна", value: "low_price", feedback: "Доступність — важливий фактор.", next: "q_early_access" },
        { label: "🛡️ Надійність", value: "reliability", feedback: "Надійність — основа довіри.", next: "q_early_access" },
        { label: "📍 Можливість відстеження", value: "tracking", feedback: "Трекінг — сучасний стандарт!", next: "q_early_access" },
      ],
    },

    // ===== ФІНАЛ =====
    q_early_access: {
      type: "choice",
      question: "Чи хочете ви отримати доступ до додатку Van Go першими?",
      options: [
        { label: "✅ Так", value: "yes", feedback: "Чудово! Залиште свій контакт.", next: "q_name_input" },
        { label: "❌ Ні", value: "no", feedback: "Зрозуміло, дякуємо за участь!", next: "q_name_input" },
      ],
    },
    q_name_input: {
      type: "text",
      question: "Як до вас можна звернутися?",
      placeholder: "Ваше ім'я",
      hint: "",
      next: "q_contact_input",
    },
    q_contact_input: {
      type: "text",
      question: "Як з вами зв'язатися?",
      placeholder: "@telegram / номер / email / instagram",
      hint: "Контакт використаємо лише для повідомлення про VanGo.",
      next: "thank_you",
    },
    thank_you: {
      type: "end",
      title: "Дякуємо! 🙌",
      text: "Ваші відповіді допоможуть нам зробити VanGo справді корисним і для водіїв, і для замовників.",
    },
  },
};
