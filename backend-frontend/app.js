require('dotenv').config();

const express = require('express');
const cors = require('cors');
const authRouter = require('./routes/auth');
const pushRouter = require('./routes/push');

const app = express();
app.use(cors());
app.use(express.json());
app.use(authRouter);
app.use(pushRouter);

const PORT = process.env.PORT || 4000;

async function fetchAdminSecret() {
  try {
    const res = await fetch(
      `${process.env.APP_SERVER_URL || 'http://localhost:3000'}/api/admin/secret`
    );
    if (res.ok) {
      const { secret } = await res.json();
      if (secret) {
        process.env.ADMIN_SECRET = secret;
        console.log('Loaded admin secret');
      }
    } else {
      console.error('Failed to fetch admin secret:', res.status);
    }
  } catch (err) {
    console.error('Failed to fetch admin secret', err);
  }
}

fetchAdminSecret().finally(() => {
  app.listen(PORT, () => console.log(`Admin backend running on port ${PORT}`));
});
