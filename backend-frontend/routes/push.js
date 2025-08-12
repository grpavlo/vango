const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Forwards push notifications from the admin UI to the main application server.
router.post('/push', async (req, res) => {
  // Verify admin JWT
  const auth = req.headers.authorization || '';
  const token = auth.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const role = String(decoded.role || '').toUpperCase();
    if (role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }


  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const upstream = await fetch(
      `${process.env.APP_SERVER_URL || 'http://localhost:3000'}/api/admin/push`,

      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': process.env.ADMIN_SECRET || 'secret',
        },
        body: JSON.stringify({ message }),
      }
    );

    const text = await upstream.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text };
    }

    if (!upstream.ok) {
      return res
        .status(upstream.status)
        .json(data.error ? { error: data.error } : { error: upstream.statusText });
    }

    res.json(data);
  } catch (err) {
    console.error('Error forwarding push notification', err);
    const message = err.cause?.message || err.message || 'Failed to send push';
    res.status(500).json({ error: message });
  }
});

module.exports = router;

