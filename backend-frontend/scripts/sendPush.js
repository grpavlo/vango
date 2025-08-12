#!/usr/bin/env node

const baseUrl = process.env.ADMIN_BACKEND_URL || 'http://localhost:4000';
const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;
const message = process.argv.slice(2).join(' ');

if (!username || !password || !message) {
  console.error('Usage: ADMIN_USERNAME=... ADMIN_PASSWORD=... node scripts/sendPush.js "message"');
  process.exit(1);
}

(async () => {
  try {
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!loginRes.ok) {
      const text = await loginRes.text();
      console.error('Login failed:', text);
      process.exit(1);
    }
    const { token } = await loginRes.json();
    const pushRes = await fetch(`${baseUrl}/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ message })
    });
    const text = await pushRes.text();
    try {
      console.log(JSON.parse(text));
    } catch {
      console.log(text);
    }
  } catch (err) {
    console.error('Unexpected error:', err.message);
    process.exit(1);
  }
})();

