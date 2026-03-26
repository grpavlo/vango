export interface AnswerEntry {
  question: string;
  answer: string;
}

export interface SurveyResponse {
  id: number;
  name: string;
  contact: string;
  role: string;
  device: "Android" | "iOS" | "Desktop";
  city: string;
  createdAt: string;
  answers: AnswerEntry[];
}

export const mockResponses: SurveyResponse[] = [
  { id: 1, name: "Олександр К.", contact: "+380991234567", role: "Водій", device: "Android", city: "Київ", createdAt: "2026-03-10", answers: [
    { question: "Ким ви себе більше бачите?", answer: "🚗 Водій (хочу заробляти)" },
    { question: "Чи працюєте ви зараз водієм?", answer: "✅ Так" },
    { question: "Який транспорт ви використовуєте?", answer: "🚐 Фургон (Van)" },
    { question: "Як ви зараз знаходите замовлення?", answer: "💬 Viber / Telegram групи" },
    { question: "Скільки перевезень ви виконуєте за тиждень?", answer: "10–20" },
    { question: "Яка середня вартість одного перевезення?", answer: "💵 $20–$50" },
    { question: "Яка найбільша проблема у вашій роботі?", answer: "🔎 Складно знайти замовлення" },
    { question: "Чи користувалися б ви додатком?", answer: "👍 Так" },
    { question: "Яка комісія сервісу для вас прийнятна?", answer: "3–5%" },
  ]},
  { id: 2, name: "Марія Л.", contact: "maria@gmail.com", role: "Замовник", device: "iOS", city: "Львів", createdAt: "2026-03-10", answers: [
    { question: "Ким ви себе більше бачите?", answer: "📦 Замовник (хочу відправляти)" },
    { question: "Що ви зазвичай перевозите?", answer: "🛋️ Меблі" },
    { question: "Як ви зараз знаходите водіїв?", answer: "🌐 OLX / оголошення" },
    { question: "Як часто вам потрібні перевезення?", answer: "📅 2–3 рази на місяць" },
    { question: "Яка головна проблема зараз?", answer: "💸 Немає зрозумілої ціни" },
    { question: "Чи користувалися б ви додатком?", answer: "👍 Так" },
  ]},
  { id: 3, name: "Ігор П.", contact: "+380671112233", role: "Обидва", device: "Android", city: "Одеса", createdAt: "2026-03-11", answers: [
    { question: "Ким ви себе більше бачите?", answer: "🔄 Обидва варіанти" },
    { question: "Який транспорт ви використовуєте?", answer: "🛻 Пікап" },
    { question: "Як ви зараз знаходите замовлення?", answer: "👥 Постійні клієнти" },
    { question: "Скільки перевезень ви виконуєте за тиждень?", answer: "5–10" },
    { question: "Що ви зазвичай перевозите?", answer: "📦 Посилки" },
  ]},
  { id: 4, name: "Анна С.", contact: "anna.s@ukr.net", role: "Замовник", device: "Desktop", city: "Харків", createdAt: "2026-03-11", answers: [
    { question: "Ким ви себе більше бачите?", answer: "📦 Замовник (хочу відправляти)" },
    { question: "Що ви зазвичай перевозите?", answer: "💻 Побутову техніку" },
    { question: "Як ви зараз знаходите водіїв?", answer: "👥 Через знайомих" },
    { question: "Як часто вам потрібні перевезення?", answer: "📅 Раз на місяць" },
    { question: "Яка головна проблема зараз?", answer: "🔎 Складно знайти водія" },
  ]},
  { id: 5, name: "Дмитро В.", contact: "+380503334455", role: "Водій", device: "Android", city: "Дніпро", createdAt: "2026-03-11", answers: [
    { question: "Ким ви себе більше бачите?", answer: "🚗 Водій (хочу заробляти)" },
    { question: "Чи працюєте ви зараз водієм?", answer: "✅ Так" },
    { question: "Який транспорт ви використовуєте?", answer: "🚛 Малий вантажний (до 3.5т)" },
    { question: "Як ви зараз знаходите замовлення?", answer: "📋 Біржі перевезень" },
    { question: "Скільки перевезень ви виконуєте за тиждень?", answer: "20+" },
    { question: "Яка комісія сервісу для вас прийнятна?", answer: "1–2%" },
  ]},
  { id: 6, name: "Тетяна М.", contact: "tetiana.m@gmail.com", role: "Замовник", device: "iOS", city: "Київ", createdAt: "2026-03-11", answers: [
    { question: "Ким ви себе більше бачите?", answer: "📦 Замовник (хочу відправляти)" },
    { question: "Що ви зазвичай перевозите?", answer: "🧱 Будівельні матеріали" },
    { question: "Як часто вам потрібні перевезення?", answer: "📅 Щотижня" },
    { question: "Яка головна проблема зараз?", answer: "⏳ Довге очікування" },
  ]},
  { id: 7, name: "Сергій Б.", contact: "+380935556677", role: "Водій", device: "Android", city: "Запоріжжя", createdAt: "2026-03-12", answers: [
    { question: "Ким ви себе більше бачите?", answer: "🚗 Водій (хочу заробляти)" },
    { question: "Чи працюєте ви зараз водієм?", answer: "❌ Ні" },
    { question: "Чи хотіли б ви працювати водієм?", answer: "👍 Так" },
    { question: "Який у вас транспорт?", answer: "🚐 Фургон" },
  ]},
  { id: 8, name: "Оксана Д.", contact: "oksana.d@gmail.com", role: "Цікаво", device: "iOS", city: "Львів", createdAt: "2026-03-12", answers: [
    { question: "Ким ви себе більше бачите?", answer: "🤔 Ще не знаю, просто цікаво" },
    { question: "Що ви зазвичай перевозите?", answer: "📦 Посилки" },
    { question: "Як часто вам потрібні перевезення?", answer: "📅 Раз на місяць" },
  ]},
  { id: 9, name: "Віталій Г.", contact: "+380667778899", role: "Водій", device: "Desktop", city: "Київ", createdAt: "2026-03-12", answers: [
    { question: "Ким ви себе більше бачите?", answer: "🚗 Водій (хочу заробляти)" },
    { question: "Чи працюєте ви зараз водієм?", answer: "✅ Так" },
    { question: "Який транспорт ви використовуєте?", answer: "🚐 Фургон (Van)" },
    { question: "Як ви зараз знаходите замовлення?", answer: "🌐 OLX / оголошення" },
    { question: "Яка комісія сервісу для вас прийнятна?", answer: "5–10%" },
  ]},
  { id: 10, name: "Юлія Р.", contact: "yulia.r@ukr.net", role: "Замовник", device: "Android", city: "Одеса", createdAt: "2026-03-12", answers: [
    { question: "Ким ви себе більше бачите?", answer: "📦 Замовник (хочу відправляти)" },
    { question: "Що ви зазвичай перевозите?", answer: "🛋️ Меблі" },
    { question: "Як часто вам потрібні перевезення?", answer: "📅 Частіше" },
    { question: "Чи користувалися б ви додатком?", answer: "👍 Так" },
  ]},
  { id: 11, name: "Андрій Ш.", contact: "+380731239876", role: "Обидва", device: "Android", city: "Харків", createdAt: "2026-03-12", answers: [
    { question: "Ким ви себе більше бачите?", answer: "🔄 Обидва варіанти" },
    { question: "Який транспорт ви використовуєте?", answer: "🚐 Фургон (Van)" },
    { question: "Скільки перевезень ви виконуєте за тиждень?", answer: "1–5" },
    { question: "Що ви зазвичай перевозите?", answer: "💻 Побутову техніку" },
  ]},
  { id: 12, name: "Наталія К.", contact: "natalia.k@gmail.com", role: "Замовник", device: "iOS", city: "Вінниця", createdAt: "2026-03-12", answers: [
    { question: "Ким ви себе більше бачите?", answer: "📦 Замовник (хочу відправляти)" },
    { question: "Що ви зазвичай перевозите?", answer: "📦 Посилки" },
    { question: "Як ви зараз знаходите водіїв?", answer: "💬 Telegram / групи" },
    { question: "Яка головна проблема зараз?", answer: "🔒 Немає гарантій" },
  ]},
  { id: 13, name: "Петро Ж.", contact: "+380509998877", role: "Водій", device: "Android", city: "Дніпро", createdAt: "2026-03-12", answers: [
    { question: "Ким ви себе більше бачите?", answer: "🚗 Водій (хочу заробляти)" },
    { question: "Чи працюєте ви зараз водієм?", answer: "✅ Так" },
    { question: "Який транспорт ви використовуєте?", answer: "🛻 Пікап" },
    { question: "Яка найбільша проблема у вашій роботі?", answer: "📉 Низькі ціни" },
    { question: "Яка комісія сервісу для вас прийнятна?", answer: "1–2%" },
  ]},
  { id: 14, name: "Катерина О.", contact: "kate.o@gmail.com", role: "Цікаво", device: "Desktop", city: "Київ", createdAt: "2026-03-12", answers: [
    { question: "Ким ви себе більше бачите?", answer: "🤔 Ще не знаю, просто цікаво" },
    { question: "Що ви зазвичай перевозите?", answer: "🛋️ Меблі" },
    { question: "Як часто вам потрібні перевезення?", answer: "📅 2–3 рази на місяць" },
  ]},
  { id: 15, name: "Роман Т.", contact: "+380681234500", role: "Водій", device: "Android", city: "Полтава", createdAt: "2026-03-12", answers: [
    { question: "Ким ви себе більше бачите?", answer: "🚗 Водій (хочу заробляти)" },
    { question: "Чи працюєте ви зараз водієм?", answer: "❌ Ні" },
    { question: "Чи хотіли б ви працювати водієм?", answer: "👍 Так" },
    { question: "Який у вас транспорт?", answer: "🛻 Пікап" },
  ]},
];

export const roleDistribution = [
  { name: "Водій", value: 6, fill: "hsl(48, 100%, 50%)" },
  { name: "Замовник", value: 5, fill: "hsl(200, 80%, 50%)" },
  { name: "Обидва", value: 2, fill: "hsl(140, 70%, 45%)" },
  { name: "Цікаво", value: 2, fill: "hsl(280, 60%, 55%)" },
];

export const deviceDistribution = [
  { name: "Android", value: 8, fill: "hsl(140, 70%, 45%)" },
  { name: "iOS", value: 4, fill: "hsl(200, 80%, 50%)" },
  { name: "Desktop", value: 3, fill: "hsl(48, 100%, 50%)" },
];

export const cityDistribution = [
  { name: "Київ", value: 4 },
  { name: "Львів", value: 2 },
  { name: "Одеса", value: 2 },
  { name: "Харків", value: 2 },
  { name: "Дніпро", value: 2 },
  { name: "Запоріжжя", value: 1 },
  { name: "Вінниця", value: 1 },
  { name: "Полтава", value: 1 },
];
