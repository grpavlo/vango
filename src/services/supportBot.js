const DEFAULT_SUPPORT_MODEL = process.env.SUPPORT_BOT_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
const SUPPORT_BOT_TIMEOUT_MS = Number(process.env.SUPPORT_BOT_TIMEOUT_MS || 10000);

const KNOWLEDGE_BASE = [
  {
    id: 'what-is-vango',
    keywords: ['vango', 'що таке', 'про застосунок', 'додаток', 'застосунок'],
    answer:
      'VanGo - це застосунок для швидкого пошуку вантажних перевезень. Клієнти створюють замовлення, а водії знаходять відповідні заявки, домовляються про умови та виконують перевезення.',
  },
  {
    id: 'phone-format',
    keywords: ['номер', 'телефон', 'формат', '+380', '380', 'ввести номер', 'неправильний номер'],
    answer:
      'Вводьте український номер без зайвих символів. Найкраще використовувати формат +380XXXXXXXXX або 0XXXXXXXXX. Якщо код не надходить, спершу перевірте, чи немає помилки в цифрах.',
  },
  {
    id: 'sms-not-received',
    keywords: ['sms', 'смс', 'код', 'не прийшло', 'не приходить', 'не отримав', 'увійти', 'вхід'],
    answer:
      'Якщо SMS з кодом не прийшло, перевірте введений номер, зачекайте до хвилини та спробуйте надіслати код ще раз. Також перевірте інтернет, сигнал мобільної мережі та чи не потрапило SMS у спам або заблоковані повідомлення.',
  },
  {
    id: 'notifications',
    keywords: ['сповіщення', 'дзвіночок', 'повідомлення', 'notification', 'немає повідомлень', 'не приходять'],
    answer:
      'Перевірте, чи дозволені сповіщення для VanGo в налаштуваннях телефону. Також переконайтесь, що є інтернет, ви увійшли в акаунт, а нові події справді зʼявились. Історію можна переглянути через дзвіночок у верхній частині екрана.',
  },
  {
    id: 'create-order',
    keywords: ['створити', 'замовлення', 'заявку', 'вантаж', 'клієнт', 'не створюється'],
    answer:
      'Щоб створити замовлення, відкрийте вкладку створення, вкажіть точки завантаження та розвантаження, дату, параметри вантажу, оплату й опис. Якщо замовлення не створюється, перевірте обовʼязкові поля, інтернет і дочекайтесь завершення завантаження фото.',
  },
  {
    id: 'driver-orders',
    keywords: ['водій', 'знайти', 'замовлення', 'карта', 'відгукнутися', 'не бачу замовлення', 'немає заявок'],
    answer:
      'Водій може переглядати доступні замовлення на мапі або у списку. Якщо заявок не видно, перевірте роль, фільтри, інтернет і вибрану область пошуку. Іноді активних замовлень у районі просто немає.',
  },
  {
    id: 'roles',
    keywords: ['роль', 'клієнт', 'водій', 'перемкнути', 'налаштування', 'змінити роль'],
    answer:
      'Роль користувача можна змінити в налаштуваннях. Клієнт створює заявки на перевезення, водій шукає та виконує замовлення, а режим обох ролей дозволяє користуватися двома сценаріями.',
  },
  {
    id: 'payments',
    keywords: ['оплата', 'ціна', 'вартість', 'фінальна', 'гроші', 'баланс'],
    answer:
      'Вартість перевезення задається в замовленні. Якщо під час домовленості змінюється фінальна ціна, її можна підтвердити в деталях замовлення.',
  },
  {
    id: 'app-error',
    keywords: ['помилка', 'не працює', 'зависло', 'не відкривається', 'інтернет', 'сервер', 'оновити'],
    answer:
      'Якщо застосунок показує помилку, оновіть екран, перевірте інтернет і повторіть дію. Якщо проблема не зникає, перезапустіть застосунок. Для входу, SMS та сповіщень також варто перевірити дозволи VanGo в налаштуваннях телефону.',
  },
  {
    id: 'profile',
    keywords: ['профіль', 'фото', 'імʼя', 'дані', 'налаштування', 'редагувати'],
    answer:
      'Дані профілю можна змінити в налаштуваннях. Перевірте, щоб імʼя, телефон і потрібні фото були заповнені коректно, бо частина функцій може залежати від завершеного профілю.',
  },
];

function normalizeQuestion(question) {
  return String(question || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findLocalAnswer(question) {
  const normalized = normalizeQuestion(question);
  if (!normalized) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const item of KNOWLEDGE_BASE) {
    const score = item.keywords.reduce((sum, keyword) => {
      return normalized.includes(keyword.toLowerCase()) ? sum + 1 : sum;
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestScore > 0 ? bestMatch.answer : null;
}

function getFallbackAnswer() {
  return 'Я поки не маю точної відповіді на це питання. Спробуйте сформулювати його трохи інакше або поставте питання про номер телефону, SMS, сповіщення, створення замовлення, ролі, оплату чи роботу водія.';
}

function buildInstructions(role) {
  const roleText = role ? `Поточна роль користувача: ${role}.` : 'Роль користувача невідома.';
  const knowledgeText = KNOWLEDGE_BASE.map((item) => `- ${item.answer}`).join('\n');

  return [
    'Ти короткий україномовний помічник застосунку VanGo.',
    roleText,
    'Відповідай тільки про роботу застосунку, вантажні перевезення, замовлення, ролі, сповіщення, оплату, профіль, SMS та вхід.',
    'Якщо не знаєш точної відповіді, чесно скажи, що питання треба уточнити.',
    'Не проси користувача надсилати паролі, коди входу чи платіжні дані.',
    'База знань:',
    knowledgeText,
  ].join('\n');
}

function extractAiText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const chunks = [];
  for (const outputItem of data?.output || []) {
    for (const contentItem of outputItem?.content || []) {
      if (typeof contentItem?.text === 'string') {
        chunks.push(contentItem.text);
      }
    }
  }

  return chunks.join('\n').trim();
}

async function askConfiguredAi({ question, role }) {
  const apiKey = process.env.SUPPORT_BOT_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey || typeof fetch !== 'function') {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUPPORT_BOT_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_SUPPORT_MODEL,
        instructions: buildInstructions(role),
        input: question,
        max_output_tokens: 220,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return extractAiText(data) || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function answerSupportQuestion({ question, role }) {
  const trimmedQuestion = String(question || '').trim();
  const aiAnswer = await askConfiguredAi({ question: trimmedQuestion, role });
  if (aiAnswer) {
    return { answer: aiAnswer, source: 'ai' };
  }

  return {
    answer: findLocalAnswer(trimmedQuestion) || getFallbackAnswer(),
    source: 'local',
  };
}

module.exports = {
  answerSupportQuestion,
};
