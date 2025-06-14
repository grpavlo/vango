# Vango Logistics Backend

Backend API for a logistics service mobile app using Node.js, Express and PostgreSQL.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables by copying `.env.example` to `.env` and setting values.

3. Run database migrations and seed basic data:
```bash
npm run seed
```

4. Start the server:
```bash
npm run dev
```

## Mobile App (Expo)

A minimal React Native client is located in the `mobile` folder. To run it you need Expo CLI:

```bash
npm install -g expo-cli # if not installed
cd mobile
npm install
npm run start
```

The app allows users to log in and view available orders from the backend API.
