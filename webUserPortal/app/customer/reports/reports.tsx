"use client";

import { Fragment, useMemo, useState } from "react";
import { VIcon } from "../v-icon";

type DriverRow = { name: string; initials: string; orders: number; completed: number; distance: number; totalTime: number; cargoTime: number; revenue: number; rating: number };
type OrderRow = { id: number; driver: string; route: string; date: string; distance: number; totalTime: string; cargoTime: string; idle: string; status: string };

const drivers: DriverRow[] = [
  { name: "Сергій Рябенко", initials: "СР", orders: 42, completed: 39, distance: 4820, totalTime: 126.4, cargoTime: 72.6, revenue: 68450, rating: 4.9 },
  { name: "Олексій Мельник", initials: "ОМ", orders: 34, completed: 31, distance: 3995, totalTime: 107.2, cargoTime: 60.5, revenue: 54280, rating: 4.8 },
  { name: "Іван Коваль", initials: "ІК", orders: 29, completed: 27, distance: 3210, totalTime: 92.8, cargoTime: 53.1, revenue: 46740, rating: 4.9 },
  { name: "Андрій Бондар", initials: "АБ", orders: 23, completed: 19, distance: 2680, totalTime: 83.6, cargoTime: 47.2, revenue: 35860, rating: 4.7 },
];

const orders: OrderRow[] = [
  { id: 130, driver: "Сергій Рябенко", route: "Черкаси → Черкаси", date: "26.08.2026", distance: 8, totalTime: "2 год 18 хв", cargoTime: "1 год 12 хв", idle: "18 хв", status: "Виконано" },
  { id: 124, driver: "Олексій Мельник", route: "Черкаси → Кропивницький", date: "25.08.2026", distance: 127, totalTime: "4 год 46 хв", cargoTime: "3 год 08 хв", idle: "24 хв", status: "Виконано" },
  { id: 121, driver: "Іван Коваль", route: "Черкаси → Слобода", date: "24.08.2026", distance: 31, totalTime: "2 год 04 хв", cargoTime: "1 год 21 хв", idle: "11 хв", status: "Виконано" },
  { id: 118, driver: "Андрій Бондар", route: "Черкаси → Сміла", date: "23.08.2026", distance: 36, totalTime: "2 год 42 хв", cargoTime: "1 год 34 хв", idle: "29 хв", status: "Затримка" },
  { id: 115, driver: "Сергій Рябенко", route: "Черкаси → Київ", date: "22.08.2026", distance: 192, totalTime: "6 год 12 хв", cargoTime: "4 год 18 хв", idle: "22 хв", status: "Виконано" },
  { id: 112, driver: "Олексій Мельник", route: "Черкаси → Умань", date: "21.08.2026", distance: 185, totalTime: "5 год 24 хв", cargoTime: "3 год 46 хв", idle: "31 хв", status: "Виконано" },
  { id: 109, driver: "Іван Коваль", route: "Черкаси → Київ", date: "19.08.2026", distance: 190, totalTime: "6 год 03 хв", cargoTime: "4 год 11 хв", idle: "19 хв", status: "Виконано" },
  { id: 104, driver: "Андрій Бондар", route: "Черкаси → Золотоноша", date: "17.08.2026", distance: 38, totalTime: "2 год 31 хв", cargoTime: "1 год 28 хв", idle: "27 хв", status: "Виконано" },
];

const periodOptions = {
  week: { from: "2026-08-20", to: "2026-08-26", factor: .24 },
  month: { from: "2026-08-01", to: "2026-08-26", factor: 1 },
  quarter: { from: "2026-06-01", to: "2026-08-26", factor: 2.7 },
  custom: { from: "2026-08-10", to: "2026-08-26", factor: .75 },
};

function formatHours(value: number) {
  const hours = Math.floor(value);
  const minutes = Math.round((value - hours) * 60);
  return `${hours} год ${minutes} хв`;
}

export default function Reports() {
  const [selectedDrivers, setSelectedDrivers] = useState(drivers.map((item) => item.name));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [period, setPeriod] = useState<keyof typeof periodOptions>("month");
  const [from, setFrom] = useState(periodOptions.month.from);
  const [to, setTo] = useState(periodOptions.month.to);
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);
  const [focusedDriver, setFocusedDriver] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  const changePeriod = (value: keyof typeof periodOptions) => {
    setPeriod(value);
    setFrom(periodOptions[value].from);
    setTo(periodOptions[value].to);
  };
  const resetDetail = () => {
    setFocusedDriver(null);
    setExpandedDriver(null);
    setExpandedOrder(null);
  };
  const toggleSelectedDriver = (name: string) => {
    setSelectedDrivers((current) => current.includes(name)
      ? current.length === 1 ? current : current.filter((item) => item !== name)
      : [...current, name]);
    resetDetail();
  };
  const selectDriver = (name: string) => {
    const nextDriver = expandedDriver === name ? null : name;
    setExpandedDriver(nextDriver);
    setFocusedDriver(nextDriver);
    setExpandedOrder(null);
  };

  const rows = useMemo(() => drivers.filter((item) => selectedDrivers.includes(item.name)), [selectedDrivers]);
  const customDays = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1);
  const factor = period === "custom" ? Math.max(.05, customDays / 26) : periodOptions[period].factor;
  const totals = rows.reduce((result, item) => ({ orders: result.orders + item.orders, completed: result.completed + item.completed, distance: result.distance + item.distance, time: result.time + item.totalTime, revenue: result.revenue + item.revenue }), { orders: 0, completed: 0, distance: 0, time: 0, revenue: 0 });
  const totalOrders = Math.max(1, Math.round(totals.orders * factor));
  const completed = Math.round(totals.completed * factor);
  const filteredOrders = orders.filter((item) => focusedDriver ? item.driver === focusedDriver : selectedDrivers.includes(item.driver));
  const pickerText = selectedDrivers.length === drivers.length ? "Усі водії" : selectedDrivers.length === 1 ? selectedDrivers[0] : `Обрано водіїв: ${selectedDrivers.length}`;
  const orderFilterText = focusedDriver ?? (selectedDrivers.length === drivers.length ? null : pickerText);
  const analyticsDrivers = focusedDriver ? drivers.filter((item) => item.name === focusedDriver) : rows;
  const analyticsRevenue = analyticsDrivers.reduce((sum, item) => sum + item.revenue, 0);
  const totalRevenue = drivers.reduce((sum, item) => sum + item.revenue, 0);
  const analyticsShare = analyticsRevenue / totalRevenue;
  const chartDays = [["Пн",12,18400],["Вт",16,23900],["Ср",14,21750],["Чт",19,28600],["Пт",23,34200],["Сб",18,27100],["Нд",14,20500]].map(([day, count, amount]) => ({ day:String(day), count:Math.max(1, Math.round(Number(count) * analyticsShare * factor)), amount:Math.max(500, Math.round(Number(amount) * analyticsShare * factor / 50) * 50) }));
  const maxChartCount = Math.max(...chartDays.map((item) => item.count));
  const chartOrderTotal = chartDays.reduce((sum, item) => sum + item.count, 0);
  const chartAmountTotal = chartDays.reduce((sum, item) => sum + item.amount, 0);
  const ratingOrders = Math.max(1, analyticsDrivers.reduce((sum, item) => sum + item.completed, 0));
  const baseRating = analyticsDrivers.reduce((sum, item) => sum + item.rating * item.completed, 0) / ratingOrders;
  const periodRatingShift = period === "week" ? .04 : period === "quarter" ? -.03 : period === "custom" ? (customDays <= 14 ? .03 : -.01) : 0;
  const averageRating = Math.min(5, Math.max(1, baseRating + periodRatingShift));
  const reviewCount = Math.max(1, Math.round(ratingOrders * factor * .8));
  const fiveStars = Math.round(50 + (averageRating - 4) * 24);
  const fourStars = Math.round(25 - (averageRating - 4) * 6);
  const lowerStars = 100 - fiveStars - fourStars;

  return <div className="reports-page">
    <div className="customer-page-intro"><div><h2>Звіти та аналітика</h2><p>Результати перевезень, ефективність водіїв і тривалість виконання</p></div></div>
    <section className="customer-card report-filters">
      <div className="report-filter-title"><span><VIcon name="chart"/></span><div><strong>Параметри звіту</strong><small>Дані перебудовуються після зміни фільтрів</small></div></div>
      <div className="report-filter-field"><span>Водії</span><div className="report-multiselect"><button type="button" onClick={() => setPickerOpen(!pickerOpen)} aria-expanded={pickerOpen}><b>{pickerText}</b><VIcon name="chevron" size={17}/></button>{pickerOpen && <div className="report-multiselect-menu"><label><input type="checkbox" checked={selectedDrivers.length === drivers.length} onChange={() => { setSelectedDrivers(drivers.map((item) => item.name)); resetDetail(); }}/><strong>Усі водії</strong></label>{drivers.map((item) => <label key={item.name}><input type="checkbox" checked={selectedDrivers.includes(item.name)} onChange={() => toggleSelectedDriver(item.name)}/><span className="mini-driver-avatar">{item.initials}</span>{item.name}</label>)}</div>}</div></div>
      <label>Період<select value={period} onChange={(event) => changePeriod(event.target.value as keyof typeof periodOptions)}><option value="week">Останні 7 днів</option><option value="month">Поточний місяць</option><option value="quarter">Поточний квартал</option><option value="custom">Власний період</option></select></label>
      <label>Дата з<input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPeriod("custom"); }}/></label>
      <label>Дата по<input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPeriod("custom"); }}/></label>
    </section>
    <section className="report-kpis" aria-label="Ключові показники"><article className="customer-card report-kpi green"><div><span>Виконані замовлення</span><strong>{completed}<small> із {totalOrders}</small></strong><p>Рівень виконання {Math.round(completed / totalOrders * 100)}%</p></div><i><VIcon name="check" size={24}/></i></article><article className="customer-card report-kpi blue"><div><span>Відстань дорогами</span><strong>{Math.round(totals.distance * factor).toLocaleString("uk-UA")}<small> км</small></strong><p>За обраний період</p></div><i><VIcon name="route" size={24}/></i></article><article className="customer-card report-kpi orange"><div><span>Середній час замовлення</span><strong>{formatHours(totals.time / Math.max(1, totals.orders))}</strong><p>Від створення до завершення</p></div><i><VIcon name="clock" size={24}/></i></article></section>
    <section className="customer-card report-table-card"><div className="report-section-head"><div><h3>Статистика за водіями</h3><p>Розкрийте водія, щоб відфільтрувати його замовлення нижче</p></div><span>{rows.length} водії</span></div><div className="report-table-scroll"><table className="report-table"><thead><tr><th>Водій</th><th>Замовлення</th><th>Виконано</th><th>Відстань</th><th>Загальний час</th><th>Час із вантажем</th><th>Сума замовлень</th><th>Оцінка</th><th/></tr></thead><tbody>{rows.map((item) => <Fragment key={item.name}><tr className={focusedDriver === item.name ? "selected" : ""}><td><button className="report-person report-person-button" onClick={() => selectDriver(item.name)} aria-expanded={expandedDriver === item.name}><span>{item.initials}</span><strong>{item.name}</strong></button></td><td>{Math.round(item.orders * factor)}</td><td><strong className="positive-value">{Math.round(item.completed * factor)}</strong></td><td>{Math.round(item.distance * factor).toLocaleString("uk-UA")} км</td><td>{formatHours(item.totalTime * factor)}</td><td>{formatHours(item.cargoTime * factor)}</td><td><strong>{Math.round(item.revenue * factor).toLocaleString("uk-UA")} грн</strong></td><td>★ {item.rating}</td><td><button className="expand-row" onClick={() => selectDriver(item.name)} aria-expanded={expandedDriver === item.name} aria-label={`Показати замовлення водія ${item.name}`}><VIcon name="chevron" size={18}/></button></td></tr>{expandedDriver === item.name && <tr className="report-detail-row"><td colSpan={9}><div className="driver-detail"><div><span>Середня відстань</span><strong>{Math.round(item.distance / item.orders)} км</strong></div><div><span>Середній час із вантажем</span><strong>{formatHours(item.cargoTime / item.completed)}</strong></div><div className="wide"><span>Найчастіші напрямки</span><strong>Черкаси · Київ · Кропивницький</strong></div><div className="driver-order-links"><span>Конкретні замовлення водія</span><div>{orders.filter((order) => order.driver === item.name).map((order) => <a key={order.id} href={`/customer/orders/${order.id}`}><strong>№ {order.id}</strong><small>{order.route}</small><VIcon name="chevron" size={16}/></a>)}</div></div></div></td></tr>}</Fragment>)}</tbody></table></div></section>
    <section className="customer-card report-table-card"><div className="report-section-head"><div><h3>Аналітика за замовленнями</h3><p>Фактична відстань і тривалість кожного етапу</p></div><span>{filteredOrders.length} замовлень</span></div>{orderFilterText && <div className="report-cross-filter"><span><VIcon name="user" size={17}/> Активний фільтр: <strong>{orderFilterText}</strong></span>{focusedDriver && <button onClick={resetDetail}>Показати замовлення вибраних водіїв</button>}</div>}<div className="report-table-scroll"><table className="report-table orders-report"><thead><tr><th>Замовлення</th><th>Дата</th><th>Водій</th><th>Маршрут</th><th>Відстань</th><th>Загальний час</th><th>Отримав → віддав</th><th>Стан</th><th/></tr></thead><tbody>{filteredOrders.map((item) => <Fragment key={item.id}><tr className={expandedOrder === item.id ? "selected" : ""}><td><a className="report-order-link" href={`/customer/orders/${item.id}`}>№ {item.id}<VIcon name="chevron" size={15}/></a></td><td>{item.date}</td><td>{item.driver}</td><td>{item.route}</td><td>{item.distance} км</td><td>{item.totalTime}</td><td><strong>{item.cargoTime}</strong></td><td><span className={`status-dot ${item.status === "Затримка" ? "late" : ""}`}>{item.status}</span></td><td><button className="expand-row" onClick={() => setExpandedOrder(expandedOrder === item.id ? null : item.id)} aria-label="Показати етапи замовлення"><VIcon name="chevron" size={18}/></button></td></tr>{expandedOrder === item.id && <tr className="report-detail-row"><td colSpan={9}><div className="order-timeline"><span className="done"><i/>Створено <b>09:10</b></span><span className="done"><i/>Водія підтверджено <b>09:24</b></span><span className="done"><i/>Вантаж отримано <b>10:08</b></span><span className="done"><i/>Вантаж передано <b>11:20</b></span><span><i/>Замовлення завершено <b>11:28</b></span></div></td></tr>}</Fragment>)}</tbody></table></div></section>
    <section className="report-bottom-grid"><article className="customer-card report-chart"><div className="report-section-head"><div><h3>Замовлення за днями</h3><p>Кількість і сума завершених замовлень</p></div><span>{chartOrderTotal} · {chartAmountTotal.toLocaleString("uk-UA")} грн</span></div><div className="bar-chart" aria-label="Кількість і сума завершених замовлень за днями">{chartDays.map((item) => <div key={item.day}><span style={{height:`${34 + item.count / maxChartCount * 112}px`}}><b>{item.count}</b></span><small>{item.day}</small><em>{item.amount.toLocaleString("uk-UA")} грн</em></div>)}</div></article><article className="customer-card quality-report"><div className="report-section-head"><div><h3>Оцінка від замовників</h3><p>Лише оцінки, залишені замовниками після виконання</p></div></div><div className="quality-score customer-score"><strong>{averageRating.toFixed(1).replace(".",",")}</strong><span>середня оцінка за {reviewCount} відгуками</span></div><dl><div><dt>5 зірок</dt><dd>{fiveStars}%</dd></div><div><dt>4 зірки</dt><dd>{fourStars}%</dd></div><div><dt>3 зірки та нижче</dt><dd>{lowerStars}%</dd></div></dl></article></section>
  </div>;
}
