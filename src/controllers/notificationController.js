const Notification = require('../models/notification');

function serializeNotification(item) {
  return {
    id: String(item.id),
    title: item.title,
    body: item.body || '',
    data: item.data || {},
    read: Boolean(item.read),
    receivedAt: item.receivedAt || item.createdAt,
    createdAt: item.createdAt,
  };
}

async function listNotifications(req, res) {
  try {
    const items = await Notification.findAll({
      where: { userId: req.user.id },
      order: [['receivedAt', 'DESC'], ['id', 'DESC']],
      limit: 80,
    });
    res.json(items.map(serializeNotification));
  } catch (err) {
    res.status(500).json({ error: 'Не вдалося завантажити сповіщення' });
  }
}

async function markNotificationRead(req, res) {
  try {
    const item = await Notification.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!item) return res.status(404).json({ error: 'Сповіщення не знайдено' });
    item.read = true;
    await item.save();
    res.json(serializeNotification(item));
  } catch (err) {
    res.status(500).json({ error: 'Не вдалося оновити сповіщення' });
  }
}

async function markAllNotificationsRead(req, res) {
  try {
    await Notification.update({ read: true }, { where: { userId: req.user.id, read: false } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Не вдалося оновити сповіщення' });
  }
}

module.exports = {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
