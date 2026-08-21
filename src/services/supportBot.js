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
    id: 'login-problem',
    keywords: [
      'не вдається увійти',
      'не можу увійти',
      'не входить',
      'проблема входу',
      'помилка входу',
      'увійти не виходить',
      'не авторизує',
      'не пускає',
      'логін',
      'як зайти',
      'як увійти',
      'як авторизуватися',
      'вхід у застосунок',
      'зайти в застосунок',
      'увійти в застосунок',
    ],
    answer:
      'Щоб увійти у VanGo, введіть номер телефону у форматі +380XXXXXXXXX або 0XXXXXXXXX, натисніть "Отримати код" і введіть останній SMS-код. Якщо SMS не приходить, перевірте номер, інтернет і мобільний звʼязок, зачекайте хвилину та спробуйте надіслати код ще раз.',
  },
  {
    id: 'notifications',
    keywords: ['сповіщення', 'дзвіночок', 'повідомлення', 'notification', 'немає повідомлень', 'не приходять'],
    answer:
      'Перевірте, чи дозволені сповіщення для VanGo в налаштуваннях телефону. Також переконайтесь, що є інтернет, ви увійшли в акаунт, а нові події справді зʼявились. Історію можна переглянути через дзвіночок у верхній частині екрана.',
  },
  {
    id: 'support-contact',
    keywords: [
      'як звернутися до техпідтримки',
      'звернутися до техпідтримки',
      'техпідтримка',
      'технічна підтримка',
      'підтримка застосунку',
      'звʼязок з підтримкою',
      'зв\'язок з підтримкою',
      'контакти підтримки',
      'написати розробникам',
      'передати розробникам',
    ],
    answer:
      'Щоб звернутися до техпідтримки VanGo, відкрийте екран підтримки та натисніть "Передати у техпідтримку". Опишіть питання або проблему, за потреби додайте фото чи скріншот і надішліть звернення. Розробники отримають його у порталі та Telegram, а відповідь прийде вам у застосунок.',
  },
  {
    id: 'create-order',
    keywords: ['як створити замовлення', 'створити замовлення', 'створення замовлень', 'оформити замовлення', 'додати замовлення', 'розмістити заявку', 'створити заявку', 'замовник'],
    answer:
      'Щоб створити замовлення, перейдіть у роль "Замовник" і відкрийте вкладку "Створити". Заповніть точки завантаження та розвантаження, дату, параметри вантажу, оплату й опис. Якщо додаєте фото, дочекайтесь завершення завантаження, після чого натисніть кнопку створення замовлення.',
  },
  {
    id: 'cannot-create-order',
    keywords: ['не створюється замовлення', 'не вдається створити замовлення', 'не можу створити замовлення', 'помилка створення замовлення', 'замовлення не створюється'],
    answer:
      'Якщо замовлення не створюється, перевірте обовʼязкові поля: адреси, дату, параметри вантажу, оплату та опис. Якщо додаєте фото, дочекайтесь завершення завантаження. Після цього перевірте інтернет і спробуйте створити замовлення ще раз.',
  },
  {
    id: 'search-orders',
    keywords: ['як шукати замовлення', 'шукати замовлення', 'пошук замовлень', 'знайти замовлення', 'де знайти замовлення', 'відгукнутися на замовлення'],
    answer:
      'Щоб шукати замовлення, перейдіть у роль "Водій" і відкрийте вкладку "Мапа". Там показуються доступні заявки поруч із вами або в обраному районі. За потреби змініть фільтри пошуку, відкрийте потрібне замовлення та натисніть "Відгукнутися", щоб запропонувати свої умови.',
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

function getKnowledgeItem(id) {
  return KNOWLEDGE_BASE.find((item) => item.id === id) || null;
}

function isOrderSearchQuestion(normalized) {
  const hasOrder = normalized.includes('замовлен') || normalized.includes('заявк');
  const hasSearch =
    normalized.includes('шук') ||
    normalized.includes('пошук') ||
    normalized.includes('опшук') ||
    normalized.includes('знайти') ||
    normalized.includes('знаход');

  return hasOrder && hasSearch;
}

function isOrderCreateQuestion(normalized) {
  const hasOrder = normalized.includes('замовлен') || normalized.includes('заявк');
  const hasCreate =
    normalized.includes('створ') ||
    normalized.includes('оформ') ||
    normalized.includes('додат') ||
    normalized.includes('добав') ||
    normalized.includes('розміст') ||
    normalized.includes('опублікув');

  return hasOrder && hasCreate;
}

function isOrderCreateProblemQuestion(normalized) {
  const hasOrder = normalized.includes('замовлен') || normalized.includes('заявк');
  const hasProblem =
    normalized.includes('не створ') ||
    normalized.includes('не можу створ') ||
    normalized.includes('не вдає') ||
    normalized.includes('помил') ||
    normalized.includes('не дода');

  return hasOrder && hasProblem;
}

function findLocalAnswer(question) {
  const normalized = normalizeQuestion(question);
  if (!normalized) return null;

  if (isOrderSearchQuestion(normalized)) {
    return getKnowledgeItem('search-orders')?.answer || null;
  }

  if (isOrderCreateProblemQuestion(normalized)) {
    return getKnowledgeItem('cannot-create-order')?.answer || null;
  }

  if (isOrderCreateQuestion(normalized)) {
    return getKnowledgeItem('create-order')?.answer || null;
  }

  let bestMatch = null;
  let bestScore = 0;

  for (const item of KNOWLEDGE_BASE) {
    const score = item.keywords.reduce((sum, keyword) => {
      const normalizedKeyword = normalizeQuestion(keyword);
      if (!normalizedKeyword) return sum;
      if (normalized === normalizedKeyword) return sum + 1000;
      if (!normalized.includes(normalizedKeyword)) return sum;

      const wordCount = normalizedKeyword.split(' ').length;
      return sum + Math.max(2, wordCount * 3);
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestScore > 0 ? bestMatch.answer : null;
}

function getFallbackAnswer(publicMode = false) {
  if (publicMode) {
    return 'Я можу допомогти з входом у VanGo: формат номера телефону, SMS-код, повторне надсилання коду або помилка авторизації. Спробуйте написати, наприклад: "не прийшов SMS-код", "як увійти" або "не вдається увійти".';
  }

  return 'Я поки не маю точної відповіді на це питання. Спробуйте сформулювати його трохи інакше або поставте питання про номер телефону, SMS, сповіщення, створення замовлення, ролі, оплату чи роботу водія.';
}

function buildInstructions(role) {
  const roleText = role ? `Поточна роль користувача: ${role}.` : 'Роль користувача невідома.';
  const knowledgeText = KNOWLEDGE_BASE.map((item) => `- ${item.answer}`).join('\n');

  return [
    'Ти короткий україномовний помічник застосунку VanGo.',
    roleText,
    'Відповідай тільки про роботу застосунку, вантажні перевезення, замовлення, ролі, сповіщення, оплату, профіль, SMS та вхід.',
    'Якщо користувач питає, як звʼязатися з підтримкою або розробниками, вказуй реальний спосіб: екран підтримки, кнопка "Передати у техпідтримку", опис проблеми, фото за потреби, відповідь прийде у застосунок.',
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

async function answerSupportQuestion({ question, role, allowAi = true, publicMode = false }) {
  const trimmedQuestion = String(question || '').trim();
  const localAnswer = findLocalAnswer(trimmedQuestion);
  if (localAnswer) {
    return { answer: localAnswer, source: 'local' };
  }

  if (allowAi) {
    const aiAnswer = await askConfiguredAi({ question: trimmedQuestion, role });
    if (aiAnswer) {
      return { answer: aiAnswer, source: 'ai' };
    }
  }

  return {
    answer: getFallbackAnswer(publicMode),
    source: 'local',
  };
}

module.exports = {
  answerSupportQuestion,
};
