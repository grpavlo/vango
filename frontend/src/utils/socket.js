export function connectOrdersStream(token) {
  if (!token) return null;
  const ws = new WebSocket(`ws://localhost:4000/api/orders/stream?token=${encodeURIComponent(token)}`);
  return ws;
}
