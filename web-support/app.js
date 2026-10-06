'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  let token = '';
  let verifiedPhone = '';
  let codePhone = '';
  let lastQuestion = '';
  const history = [];

  function status(id, text = '', error = false) {
    $(id).textContent = text;
    $(id).className = error ? 'error' : 'success';
  }

  async function api(path, body, useAuth = false) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const headers = {};
      if (useAuth) headers.Authorization = `Bearer ${token}`;
      if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
      const response = await fetch(`/api${path}`, {
        method: body ? 'POST' : 'GET', headers,
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = null; }
      if (!response.ok) {
        if (useAuth && response.status === 401) {
          signOut();
          throw new Error('Сесія завершилася. Підтвердьте номер телефону ще раз.');
        }
        throw new Error(data?.error || (text && !text.includes('<') ? text : 'Не вдалося виконати запит. Спробуйте пізніше.'));
      }
      if (!data) throw new Error('Сервер надіслав некоректну відповідь. Спробуйте пізніше.');
      return data;
    } catch (error) {
      if (error.name === 'AbortError' || error instanceof TypeError) {
        throw new Error('Немає відповіді сервера. Перевірте інтернет і спробуйте ще раз.');
      }
      throw error;
    } finally { clearTimeout(timeout); }
  }

  function message(role, text) {
    const node = document.createElement('p');
    node.className = `message ${role}`;
    node.textContent = text;
    $('chat').append(node);
    $('chat').scrollTop = $('chat').scrollHeight;
  }

  async function loadFaq() {
    $('faq-retry').hidden = true;
    $('faq-list').textContent = 'Завантажуємо відповіді…';
    try {
      const items = await api('/support/faq');
      $('faq-list').replaceChildren();
      for (const item of items) {
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        const answer = document.createElement('p');
        summary.textContent = item.question;
        answer.textContent = item.answer;
        details.append(summary, answer);
        $('faq-list').append(details);
      }
    } catch (error) {
      $('faq-list').textContent = error.message;
      $('faq-retry').hidden = false;
    }
  }

  $('chat-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = $('chat-input');
    const question = input.value.trim();
    if (question.length < 2) return status('chat-status', 'Напишіть питання трохи детальніше.', true);
    const button = event.submitter;
    button.disabled = true;
    input.disabled = true;
    lastQuestion = question;
    message('user', question);
    status('chat-status', 'Робот готує відповідь…');
    try {
      const data = await api(token ? '/support/ask' : '/support/public-ask', { question, history: history.slice(-8) }, Boolean(token));
      message('assistant', data.answer);
      history.push({ role: 'user', text: question }, { role: 'assistant', text: data.answer });
      history.splice(0, Math.max(0, history.length - 8));
      input.value = '';
      status('chat-status');
    } catch (error) { status('chat-status', error.message, true); }
    finally { button.disabled = false; input.disabled = false; input.focus(); }
  });

  $('transfer').addEventListener('click', () => {
    if (!$('question').value.trim()) $('question').value = lastQuestion;
    $('request').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('question').focus({ preventScroll: true });
  });

  $('phone-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    let digits = $('phone').value.replace(/\D/g, '');
    if (/^0\d{9}$/.test(digits)) digits = `38${digits}`;
    if (!/^380\d{9}$/.test(digits)) return status('auth-status', 'Вкажіть український номер: +380XXXXXXXXX або 0XXXXXXXXX.', true);
    const phone = `+${digits}`;
    const button = event.submitter;
    button.disabled = true;
    status('auth-status', 'Надсилаємо SMS…');
    try {
      await api('/auth/send-code', { phone });
      codePhone = phone;
      $('code').value = '';
      $('code-form').hidden = false;
      $('code').focus();
      status('auth-status', `Код надіслано на ${phone}. Повторне надсилання доступне через хвилину.`);
      setTimeout(() => { button.disabled = false; }, 60000);
    } catch (error) { status('auth-status', error.message, true); button.disabled = false; }
  });

  $('code-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const phone = codePhone;
    const button = event.submitter;
    button.disabled = true;
    status('auth-status', 'Підтверджуємо номер…');
    try {
      const data = await api('/auth/verify-code', { phone, code: $('code').value.trim() });
      if (!data.token) throw new Error('Не вдалося підтвердити вхід. Спробуйте ще раз.');
      token = data.token;
      verifiedPhone = phone;
      $('code').value = '';
      $('account-phone').textContent = verifiedPhone;
      $('auth').hidden = true;
      $('account').hidden = false;
      $('send-request').disabled = false;
      $('history').hidden = false;
      status('auth-status', 'Номер підтверджено. Можна надіслати звернення.');
      await loadRequests();
    } catch (error) { status('auth-status', error.message, true); }
    finally { button.disabled = false; }
  });

  function signOut() {
    token = '';
    verifiedPhone = '';
    codePhone = '';
    $('code').value = '';
    $('auth').hidden = false;
    $('code-form').hidden = true;
    $('account').hidden = true;
    $('account-phone').textContent = '';
    $('send-request').disabled = true;
    $('history').hidden = true;
    $('requests').replaceChildren();
    status('auth-status');
    status('request-status');
  }

  async function loadRequests() {
    const activeToken = token;
    $('refresh').disabled = true;
    try {
      const items = await api('/support/questions', undefined, true);
      if (token !== activeToken) return;
      $('requests').replaceChildren();
      if (!items.length) $('requests').textContent = 'Ви ще не надсилали звернень.';
      for (const item of items) {
        const article = document.createElement('article');
        article.className = 'ticket';
        const title = document.createElement('strong');
        title.textContent = `#${item.id} · ${item.status === 'ANSWERED' ? 'Є відповідь' : 'Очікує відповіді'}`;
        const question = document.createElement('p');
        question.textContent = item.question;
        const date = document.createElement('small');
        date.textContent = new Date(item.createdAt).toLocaleString('uk-UA');
        article.append(title, date, question);
        if (item.answer) {
          const answer = document.createElement('p');
          answer.textContent = `Підтримка: ${item.answer}`;
          article.append(answer);
        }
        $('requests').append(article);
      }
    } catch (error) {
      if (token === activeToken) $('requests').textContent = error.message;
    } finally { $('refresh').disabled = false; }
  }

  $('request-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!token) return status('request-status', 'Спочатку підтвердьте номер телефону.', true);
    const question = $('question').value.trim();
    if (question.length < 5) return status('request-status', 'Опишіть питання трохи детальніше.', true);
    const photos = Array.from($('photos').files);
    if (photos.length > 5) return status('request-status', 'Можна додати не більше 5 фото.', true);
    const body = new FormData();
    body.append('question', question);
    for (const photo of photos) body.append('photos', photo);
    $('send-request').disabled = true;
    $('logout').disabled = true;
    status('request-status', 'Надсилаємо звернення…');
    try {
      const data = await api('/support/questions', body, true);
      $('request-form').reset();
      status('request-status', `Звернення #${data.id} надіслано. Відповідь з’явиться у «Моїх зверненнях» і в застосунку VanGo.`);
      await loadRequests();
    } catch (error) { status('request-status', error.message, true); }
    finally { $('send-request').disabled = !token; $('logout').disabled = false; }
  });

  $('logout').addEventListener('click', signOut);
  $('refresh').addEventListener('click', loadRequests);
  $('faq-retry').addEventListener('click', loadFaq);
  loadFaq();
})();
