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

## Searching for Nearby Orders

The `GET /orders` endpoint accepts `lat`, `lon` and `radius` (in
kilometers) query parameters. All orders with pickup coordinates inside
the specified radius are returned. Coordinates are required – the
service does not perform address geocoding for this filter.


