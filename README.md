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

### Push Notifications

Remote push notifications require an Expo development build. Running
the app in Expo Go will not receive notifications.

Ensure the EAS project ID is defined in `mobile-app/app.json` under
`extra.eas.projectId` so the client can register for a push token.
Create a development build using EAS (for example
`eas build --profile development`) and install it on your device.

Set the `EXPO_ACCESS_TOKEN` environment variable on the server so the
backend can send notifications through Expo.

## Searching for Nearby Orders

The `GET /orders` endpoint accepts `lat`, `lon` and `radius` (in
kilometers) query parameters. All orders with pickup coordinates inside
the specified radius are returned. Coordinates are required – the
service does not perform address geocoding for this filter.


