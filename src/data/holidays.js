import Holidays from 'date-holidays';

export const COUNTRY_OPTIONS = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
];

// Fantasy office closure: Dec 24 through Jan 1 each year
function getFantasyClosureDays(startDate, endDate) {
  const closures = [];
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  for (let year = startYear; year <= endYear; year++) {
    // Dec 24–31 of this year
    for (let day = 24; day <= 31; day++) {
      const d = new Date(year, 11, day); // month is 0-indexed
      if (d >= startDate && d <= endDate) {
        closures.push({
          date: d,
          name: `Fantasy Holiday Closure (Dec ${day})`,
          country: 'FANTASY',
        });
      }
    }
    // Jan 1 of next year
    const newYear = new Date(year + 1, 0, 1);
    if (newYear >= startDate && newYear <= endDate) {
      // Only add if not already covered by country holidays
      closures.push({
        date: newYear,
        name: 'Fantasy Holiday Closure (Jan 1)',
        country: 'FANTASY',
      });
    }
  }

  return closures;
}

export function getHolidaysForCountry(countryCode, startDate, endDate) {
  const hd = new Holidays(countryCode);
  const holidays = [];
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  for (let year = startYear; year <= endYear; year++) {
    const yearHolidays = hd.getHolidays(year);
    for (const h of yearHolidays) {
      if (h.type === 'public') {
        const date = new Date(h.date);
        if (date >= startDate && date <= endDate) {
          holidays.push({
            date: date,
            name: h.name,
            country: countryCode,
          });
        }
      }
    }
  }

  return holidays.sort((a, b) => a.date - b.date);
}

export function getFantasyClosures(startDate, endDate) {
  return getFantasyClosureDays(startDate, endDate);
}
