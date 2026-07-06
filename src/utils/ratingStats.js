const { Op, col, fn } = require("sequelize");
const Rating = require("../models/rating");
const Order = require("../models/order");
const { OrderStatus } = require("../models/order");

function normalizeRating(value, fallback = 5) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? Math.round(num * 10) / 10 : fallback;
}

async function getRoleRatings(userIds, role) {
  const ids = [
    ...new Set((userIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0)),
  ];
  if (ids.length === 0) return {};

  const rows = await Rating.findAll({
    attributes: ["toUserId", "rating"],
    where: { toUserId: { [Op.in]: ids } },
    include: [
      {
        model: Order,
        as: "order",
        attributes: ["driverId", "customerId"],
        required: true,
      },
    ],
    raw: true,
  });

  const sums = {};
  ids.forEach((id) => {
    sums[id] = { total: 0, count: 0 };
  });

  rows.forEach((row) => {
    const id = Number(row.toUserId);
    const value = Number(row.rating);
    const order = row["order.driverId"] != null || row["order.customerId"] != null
      ? {
          driverId: Number(row["order.driverId"]),
          customerId: Number(row["order.customerId"]),
        }
      : null;
    const roleMatches =
      role === "DRIVER"
        ? order?.driverId === id
        : order?.customerId === id;
    if (roleMatches && Number.isInteger(id) && Number.isFinite(value) && sums[id]) {
      sums[id].total += value;
      sums[id].count += 1;
    }
  });

  const result = {};
  ids.forEach((id) => {
    result[id] =
      sums[id].count > 0
        ? normalizeRating(sums[id].total / sums[id].count)
        : 5;
  });
  return result;
}

async function getRoleRating(userId, role) {
  const ratings = await getRoleRatings([userId], role);
  return ratings[Number(userId)] ?? 5;
}

async function getCompletedOrderCounts(userIds, role) {
  const ids = [
    ...new Set((userIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0)),
  ];
  if (ids.length === 0) return {};

  const userField = role === "DRIVER" ? "driverId" : "customerId";
  const rows = await Order.findAll({
    attributes: [
      [col(userField), "userId"],
      [fn("COUNT", col("id")), "count"],
    ],
    where: {
      status: OrderStatus.COMPLETED,
      [userField]: { [Op.in]: ids },
    },
    group: [userField],
    raw: true,
  });

  const result = {};
  ids.forEach((id) => {
    result[id] = 0;
  });
  rows.forEach((row) => {
    const id = Number(row.userId);
    const count = Number(row.count);
    if (Number.isInteger(id) && result[id] != null && Number.isFinite(count)) {
      result[id] = count;
    }
  });
  return result;
}

async function getCompletedOrderCount(userId, role) {
  const counts = await getCompletedOrderCounts([userId], role);
  return counts[Number(userId)] ?? 0;
}

module.exports = {
  getCompletedOrderCount,
  getCompletedOrderCounts,
  getRoleRating,
  getRoleRatings,
  normalizeRating,
};
