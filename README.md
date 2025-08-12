# Vango Logistics Backend

Backend API for a logistics service mobile app using Node.js, Express and PostgreSQL.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables by copying `.env.example` to `.env` and setting values. In addition to `JWT_SECRET`, define `ADMIN_SECRET` shared by the admin backend and main server to authorize push requests between servers.

3. Run database migrations and seed basic data:
```bash
npm run seed
```

4. Start the server:
```bash
npm run dev
```

## Sending Admin Push Notifications

The `backend-frontend` service includes a helper script that logs in and
forwards a push message to the main API. Set the admin credentials in the
environment and provide the message to send:

```bash
cd backend-frontend
ADMIN_USERNAME=<user> ADMIN_PASSWORD=<pass> npm run push -- "Test message"
```

The script obtains a JWT via `/login` and calls `/push` with the proper
authorization headers so the notification is delivered successfully.

## Searching for Nearby Orders

The `GET /orders` endpoint accepts `lat`, `lon` and `radius` (in
kilometers) query parameters. All orders with pickup coordinates inside
the specified radius are returned. Coordinates are required – the
service does not perform address geocoding for this filter.


