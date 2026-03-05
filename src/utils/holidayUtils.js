import { isWeekend } from 'date-fns';

export function isBusinessDay(date, holidaySet) {
  if (isWeekend(date)) return false;
  const key = toDateKey(date);
  return !holidaySet.has(key);
}

export function skipToNextBusinessDay(date, holidaySet) {
  let d = new Date(date);
  while (!isBusinessDay(d, holidaySet)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

export function addBusinessDaysSkippingHolidays(start, days, holidaySet) {
  let d = new Date(start);
  d = skipToNextBusinessDay(d, holidaySet);
  let remaining = days - 1; // start date counts as day 1
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d, holidaySet)) {
      remaining--;
    }
  }
  return d;
}

export function toDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function buildHolidaySet(holidays) {
  const set = new Set();
  for (const h of holidays) {
    set.add(toDateKey(h.date));
  }
  return set;
}

export function countBusinessDays(startDate, endDate, holidaySet) {
  let count = 0;
  let d = new Date(startDate);
  while (d <= endDate) {
    if (isBusinessDay(d, holidaySet)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}
