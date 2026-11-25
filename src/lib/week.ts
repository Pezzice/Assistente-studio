import { addDays, mondayOf, todayInRome, weekday } from "./dates";

/** Week to show: ?settimana=YYYY-MM-DD (any day of it), otherwise the current one; on Sunday, the next one. */
export function resolveWeek(param: string | undefined, now = new Date()) {
  const today = todayInRome(now);
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) return { today, weekStart: mondayOf(param) };
  return { today, weekStart: weekday(today) === 0 ? addDays(today, 1) : mondayOf(today) };
}
