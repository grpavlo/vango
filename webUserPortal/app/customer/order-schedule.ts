export function scheduleDefaults(now = new Date()) {
  const date = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { loadDate: date(now), unloadDate: date(tomorrow) };
}

export function buildOrderSchedule(raw: FormData, planned: boolean, freeDate: boolean, withinHour: boolean, now = new Date()) {
  const hour = 60 * 60 * 1000;
  if (!planned || freeDate) {
    const loadFrom = new Date(now.getTime() + (!planned && withinHour ? hour : 0));
    const loadTo = new Date(loadFrom.getTime() + hour);
    const freeDateUntil = planned && freeDate ? new Date(loadFrom.getTime() + 7 * 24 * hour) : null;
    const unloadFrom = freeDateUntil || new Date(loadTo);
    return { loadFrom, loadTo, unloadFrom, unloadTo: new Date(unloadFrom.getTime() + hour), freeDateUntil };
  }
  const parse = (dateKey: string, timeKey: string) => {
    const date = String(raw.get(dateKey) || "");
    const time = String(raw.get(timeKey) || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error("Вкажіть дати та час завантаження і розвантаження");
    const value = new Date(`${date}T${time}:00`);
    if (!Number.isFinite(value.getTime())) throw new Error("Вкажіть коректну дату та час");
    return value;
  };
  const loadFrom = parse("loadDate", "loadTimeFrom");
  const loadTo = parse("loadDate", "loadTimeTo");
  const unloadFrom = parse("unloadDate", "unloadTimeFrom");
  const unloadTo = parse("unloadDate", "unloadTimeTo");
  if (loadTo <= loadFrom || unloadTo <= unloadFrom) throw new Error("Час до має бути пізніше часу від");
  if (String(raw.get("unloadDate")) < String(raw.get("loadDate"))) throw new Error("Дата розвантаження не може бути раніше дати завантаження");
  return { loadFrom, loadTo, unloadFrom, unloadTo, freeDateUntil: null };
}
