const express = require('express');
const router = express.Router();

// Forwards push notifications to the main application server
router.post('/push', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }
  try {
    const response = await fetch('http://localhost:3000/api/admin/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': process.env.ADMIN_SECRET || 'secret',
      },
      body: JSON.stringify({ message }),
    });
    // The upstream may return non-JSON or an empty body. Read as text first
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      data = { error: text || 'Unknown error' };
    }
    if (!response.ok) {
      if (!text) {
        data = { error: response.statusText || `Request failed with status ${response.status}` };
      }
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (err) {
    console.error('Error forwarding push notification', err);
    res.status(500).json({ error: err.message || 'Failed to send push' });
  }
});

module.exports = router;
