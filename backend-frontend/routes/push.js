const express = require('express');
const router = express.Router();

// Accepts push notification text from the admin frontend.
// Currently it just logs the message and responds with a confirmation
// so we can verify that the text is reaching the admin backend.
router.post('/push', (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  console.log('Received push text:', message);
  res.json({ message });
});

module.exports = router;

