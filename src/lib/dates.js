export const WEEKDAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function toKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function createDateKey(year, month, day) {
  return toKey(new Date(year, month, day));
}

export function fromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function todayKey() {
  return toKey(new Date());
}

export function addDays(key, amount) {
  const date = fromKey(key);
  date.setDate(date.getDate() + amount);
  return toKey(date);
}

// 1 = Monday … 7 = Sunday
export function weekday(keyOrDate) {
  const date = typeof keyOrDate === "string" ? fromKey(keyOrDate) : keyOrDate;
  const jsDay = date.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function startOfWeek(key) {
  return addDays(key, 1 - weekday(key));
}

export function weekKeys(key) {
  const monday = startOfWeek(key);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function daysBetween(fromKeyValue, toKeyValue) {
  return Math.round((fromKey(toKeyValue) - fromKey(fromKeyValue)) / 86400000);
}

export function formatDayLong(key) {
  return fromKey(key).toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatDayShort(key) {
  return fromKey(key).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function formatMonth(date) {
  const name = date.toLocaleString("ru-RU", { month: "long" });
  return `${name[0].toUpperCase()}${name.slice(1)} ${date.getFullYear()}`;
}

export function relativeDayLabel(key) {
  const diff = daysBetween(todayKey(), key);
  if (diff === 0) return "Сегодня";
  if (diff === -1) return "Вчера";
  if (diff === 1) return "Завтра";
  return formatDayShort(key);
}

export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatMinutes(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} мин`;
  return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
}
