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

## Searching for Nearby Orders

The `GET /orders` endpoint now supports geographic search by radius.
Provide `lat`, `lon` and `radius` (in kilometers) query parameters to
retrieve orders whose pickup point is within the specified distance.
If coordinates are omitted but a `city` is supplied, the service will
geocode the city name using OpenStreetMap.

