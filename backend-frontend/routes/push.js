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
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send push' });
  }
});

module.exports = router;
