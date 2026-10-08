"use client";

import { Fragment, useEffect, useState } from "react";
import { VIcon } from "../v-icon";
import { portalPath } from "../../portal-path";

type Person = { id: number; name: string; phone?: string; email?: string };
type OrderRow = {
  id: number; orderNumber: number | null; status: string; createdAt: string;
  acceptedAt: string | null; receivedAt: string | null; deliveredAt: string | null; completedAt: string | null;
  pickupCity: string; pickupLocation: string; pickupAddress: string;
  dropoffCity: string; dropoffLocation: string; dropoffAddress: string; cargoType: string;
  price: number; finalPrice: number | null; revenue: number; roadDistanceKm: number | null;
  totalDurationMinutes: number | null; cargoDurationMinutes: number | null;
  customerRating: number | null; customerRatingComment: string | null; customerRatingCreatedAt: string | null;
  photos: string[]; driver: Person | null; driverAssignment: "assigned" | "candidate" | "reserved" | null;
};
type DriverRow = {
  driverId: number | null; driver: Person | null; orderCount: number; completedCount: number;
  activeCount: number; cancelledCount: number; totalRevenue: number; totalDistanceKm: number;
  totalDurationMinutes: number; totalCargoDurationMinutes: number; customerRatingAverage: number | null;
  avgDistanceKm: number | null; avgTotalDurationMinutes: number | null; avgCargoDurationMinutes: number | null;
};
type Report = {
  dailyRows: { key: string; count: number; revenue: number }[];
  drivers: Person[]; orderRows: OrderRow[]; driverRows: DriverRow[];
  totals: { averageDurationMinutes: number | null; completedRevenue: number; orderCount: number; completedCount: number; activeCount: number; cancelledCount: number; totalRevenue: number; totalDistanceKm: number };
  pagination: { page: number; pageSize: number; total: number; pages: number };
  customerRatings: { count: number; average: number | null; buckets: { five: number; four: number; threeOrLess: number } };
};
const statuses: Record<string, string> = { CREATED: "Створено", PENDING: "Очікує", ACCEPTED: "Прийнято", IN_PROGRESS: "Виконується", DELIVERED: "Доставлено", COMPLETED: "Завершено", CANCELLED: "Скасовано", REJECTED: "Відхилено" };
const format = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("uk-UA");
const date = (value: string | null) => value ? new Date(value).toLocaleString("uk-UA", { timeZone: "UTC" }) : "—";
const duration = (value: number | null) => value == null ? "—" : `${Math.floor(value / 60)} год ${value % 60} хв`;
function defaultRange(days = 30) {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { from: new Date(end.getTime() - (days - 1) * 86400000).toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

function monthRange(previous = false) {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (previous ? 1 : 0), 1));
  const to = previous ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)) : now;
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function Reports({ token = "" }: { token?: string }) {
  const [range, setRange] = useState(() => monthRange());
  const [period, setPeriod] = useState("currentMonth");
  const [driverId, setDriverId] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ key: string; data: Report | null; error: string } | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [refresh, setRefresh] = useState(0);
  const requestKey = JSON.stringify([token, range.from, range.to, driverId, page, refresh]);
  const loading = result?.key !== requestKey;
  const report = !loading ? result?.data : null;
  const error = !loading ? result?.error : "";

  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    let denied = false;
    async function load() {
      if (busy || denied) return;
      busy = true;
      try {
        const query = new URLSearchParams({ dateFrom: range.from, dateTo: range.to, page: String(page), pageSize: "50" });
        if (driverId) query.set("driverId", driverId);
        const response = await fetch(`/api/dispatcher/analytics/order-report?${query}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: "no-store" });
        if (!response.ok) {
          denied = response.status === 401 || response.status === 403;
          throw new Error(await response.text() || "Не вдалося завантажити звіт");
        }
        const data: Report = await response.json();
        if (!controller.signal.aborted) { setResult({ key: requestKey, data, error: "" }); }
      } catch (err) {
        if (!controller.signal.aborted) { setResult({ key: requestKey, data: null, error: err instanceof Error ? err.message : "Помилка звіту" }); }
      } finally {
        busy = false;
      }
    }
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 10000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [token, range.from, range.to, driverId, page, refresh, requestKey]);

  return <div className="reports-page portal-panel">
    <div className="portal-panel-head"><div><h2>Звіти диспетчера</h2><p>Лише ваші замовлення. Дати й час — UTC.</p></div><button className="customer-primary" onClick={() => setRefresh((v) => v + 1)}>Оновити</button></div>
    <section className="portal-report-filter-card">
      <div className="portal-report-filter-title"><span aria-hidden="true"><VIcon name="chart" /></span><div><h3>Параметри звіту</h3><p>Дані перебудовуються після зміни фільтрів</p></div></div>
      <label><span>Водії</span><select value={driverId} onChange={(event) => { setDriverId(event.target.value); setPage(1); }}><option value="">Усі водії</option>{(report?.drivers || []).map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}{driverId && !report?.drivers.some((driver) => String(driver.id) === driverId) && <option value={driverId}>Обраний водій</option>}</select></label>
      <label><span>Період</span><select value={period} onChange={(event) => { const value = event.target.value; setPeriod(value); if (value !== "custom") setRange(value === "currentMonth" ? monthRange() : value === "previousMonth" ? monthRange(true) : defaultRange(Number(value))); setPage(1); }}><option value="currentMonth">Поточний місяць</option><option value="previousMonth">Попередній місяць</option><option value="7">Останні 7 днів</option><option value="30">Останні 30 днів</option><option value="90">Останні 90 днів</option><option value="custom">Власний період</option></select></label>
      <label><span>Дата з</span><input type="date" value={range.from} onChange={(event) => { setPeriod("custom"); setRange({ ...range, from: event.target.value }); setPage(1); }}/></label>
      <label><span>Дата по</span><input type="date" value={range.to} onChange={(event) => { setPeriod("custom"); setRange({ ...range, to: event.target.value }); setPage(1); }}/></label>
    </section>
    {loading ? <div className="customer-card customer-live-state">Завантаження звіту...</div> : error ? <div role="alert" className="customer-card customer-live-state error">{error}</div> : report && <>
      <section className="portal-report-summary-grid">
        <article><span className="green" aria-hidden="true"><VIcon name="check" /></span><div><small>Виконані замовлення</small><strong>{report.totals.completedCount} <em>із {report.totals.orderCount}</em></strong><p>Рівень виконання {report.totals.orderCount ? Math.round(report.totals.completedCount / report.totals.orderCount * 100) : 0}%</p></div></article>
        <article><span className="blue" aria-hidden="true"><VIcon name="route" /></span><div><small>Відстань дорогами</small><strong>{format(report.totals.totalDistanceKm)} км</strong><p>За обраний період</p></div></article>
        <article><span className="orange" aria-hidden="true"><VIcon name="clock" /></span><div><small>Середній час замовлення</small><strong>{format(report.totals.averageDurationMinutes)} хв</strong><p>Від створення до завершення</p></div></article>
      </section>
      <div className="portal-report-grid">
        <section className="portal-report-card wide"><header><div><h3>Замовлення за днями</h3><p>Кількість і сума завершених замовлень</p></div><strong>{report.totals.completedCount} · {format(report.totals.completedRevenue)} грн</strong></header>{report.dailyRows?.length ? <div className="portal-day-chart">{report.dailyRows.map((row) => <div className="portal-day-bar" key={row.key}><strong>{row.count}</strong><span style={{ height: `${Math.max(8, row.count / Math.max(...report.dailyRows.map((item) => item.count)) * 150)}px`, background: "#36bc83", borderRadius: 6 }} /><small>{row.key}</small><em>{format(row.revenue)} грн</em></div>)}</div> : <div className="customer-live-state">За обраний період немає завершених замовлень.</div>}</section>
        <section className="portal-report-card"><header><div><h3>Оцінка від замовників</h3><p>Лише оцінки після виконання ваших замовлень</p></div></header><div className="portal-rating-summary"><div className="portal-rating-circle" style={{ background: report.customerRatings.count ? `conic-gradient(#ffbe21 0 ${report.customerRatings.buckets.five / report.customerRatings.count * 100}%, #ffdf83 0 ${(report.customerRatings.buckets.five + report.customerRatings.buckets.four) / report.customerRatings.count * 100}%, #e4a05a 0)` : "#52635b" }}><strong>{format(report.customerRatings.average)}</strong></div><p>середня оцінка за<br/><strong>{report.customerRatings.count} відгуками</strong></p></div><div className="portal-rating-bars">{[["5 зірок", report.customerRatings.buckets.five], ["4 зірки", report.customerRatings.buckets.four], ["3 зірки та нижче", report.customerRatings.buckets.threeOrLess]].map(([label, count]) => <p key={label}><span>{label}</span><strong>{report.customerRatings.count ? Math.round(Number(count) / report.customerRatings.count * 100) : 0}%</strong></p>)}</div></section>
      </div>
      <section className="portal-driver-report"><header><div><h3>Статистика за водіями</h3><p>Оберіть водія, щоб побачити його замовлення нижче</p></div><strong>{report.driverRows.filter((row) => row.driverId).length} водіїв</strong></header><div className="portal-table-wrap"><table className="portal-table portal-driver-table"><thead><tr><th>Водій</th><th>Замовлення</th><th>Виконано</th><th>Відстань</th><th>Загальний час</th><th>Час із вантажем</th><th>Сума замовлень</th><th>Оцінка</th></tr></thead><tbody>{report.driverRows.map((row) => <tr key={row.driverId ?? "unassigned"}><td>{row.driverId ? <button onClick={() => { setDriverId(String(row.driverId)); setPage(1); }}>{row.driver?.name}</button> : "Без водія"}</td><td>{row.orderCount}</td><td>{row.completedCount}</td><td>{format(row.totalDistanceKm)} км</td><td>{duration(row.totalDurationMinutes)}</td><td>{duration(row.totalCargoDurationMinutes)}</td><td>{format(row.totalRevenue)} грн</td><td>{format(row.customerRatingAverage)}</td></tr>)}{!report.driverRows.length && <tr><td colSpan={8}>Немає даних за період</td></tr>}</tbody></table></div></section>
      <section className="portal-order-analytics"><header><div><h3>Аналітика за замовленнями</h3><p>Фактична відстань і тривалість кожного етапу</p></div><strong>{report.pagination.total} замовлень</strong></header><div className="portal-table-wrap"><table className="portal-table orders-report"><thead><tr><th>№</th><th>Маршрут / вантаж</th><th>Водій</th><th>Статус</th><th>Відстань</th><th>Загальний час</th><th>Час із вантажем</th><th>Сума</th><th>Створено</th><th>Деталі</th></tr></thead><tbody>{report.orderRows.map((row) => <Fragment key={row.id}><tr><td><a href={portalPath(`/customer/orders/${row.id}`)}>{row.orderNumber || row.id}</a></td><td>{row.pickupCity || row.pickupLocation} → {row.dropoffCity || row.dropoffLocation}<small>{row.cargoType}</small></td><td>{row.driver?.name || "Без водія"}<small>{row.driverAssignment === "candidate" ? "Кандидат" : row.driverAssignment === "reserved" ? "Резерв" : row.driverAssignment === "assigned" ? "Призначений" : ""}</small></td><td>{statuses[row.status] || row.status}</td><td>{format(row.roadDistanceKm)}</td><td>{duration(row.totalDurationMinutes)}</td><td>{duration(row.cargoDurationMinutes)}</td><td>{format(row.revenue)}</td><td>{date(row.createdAt)}</td><td><button aria-expanded={expanded === row.id} onClick={() => setExpanded(expanded === row.id ? null : row.id)}>Деталі</button></td></tr>{expanded === row.id && <tr className="report-detail-row"><td colSpan={10}><div className="driver-detail"><div><span>Завантаження</span><strong>{row.pickupAddress || "—"}</strong></div><div><span>Вивантаження</span><strong>{row.dropoffAddress || "—"}</strong></div><div><span>Прийнято</span><strong>{date(row.acceptedAt)}</strong></div><div><span>Отримано</span><strong>{date(row.receivedAt)}</strong></div><div><span>Доставлено</span><strong>{date(row.deliveredAt)}</strong></div><div><span>Завершено</span><strong>{date(row.completedAt)}</strong></div><div><span>Початкова / фінальна сума</span><strong>{format(row.price)} / {format(row.finalPrice)}</strong></div><div><span>Контакт водія</span><strong>{row.driver?.phone || row.driver?.email || "—"}</strong></div><div><span>Оцінка замовника</span><strong>{format(row.customerRating)}</strong><p>{row.customerRatingComment}</p><small>{date(row.customerRatingCreatedAt)}</small></div><div className="wide"><span>Фото</span>{row.photos.length ? row.photos.map((photo, i) => <a key={`${photo}-${i}`} href={photo} target="_blank" rel="noopener noreferrer"><img src={photo} alt={`Фото замовлення ${i + 1}`} loading="lazy" style={{ width: 120, height: 90, objectFit: "cover", margin: 4 }}/></a>) : <p>Фото не додано</p>}</div></div></td></tr>}</Fragment>)}{!report.orderRows.length && <tr><td colSpan={10}>Немає замовлень на цій сторінці</td></tr>}</tbody></table></div><div className="report-section-head"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Назад</button><span>Сторінка {page} з {Math.max(1, report.pagination.pages)}</span><button disabled={page >= report.pagination.pages} onClick={() => setPage(page + 1)}>Далі</button></div></section>

    </>}
  </div>;
}
