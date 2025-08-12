const express = require('express');
const cors = require('cors');
const authRouter = require('./routes/auth');

const app = express();
app.use(cors());
app.use(express.json());
app.use(authRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Admin backend running on port ${PORT}`));
