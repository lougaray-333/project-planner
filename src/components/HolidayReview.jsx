import { useEffect, useMemo, useState } from 'react';
import { usePlanStore } from '../context/PlanContext';
import { getHolidaysForCountry, getFantasyClosures } from '../data/holidays';
import { addDays, format } from 'date-fns';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function HolidayReview() {
  const { projectInputs, setConfirmedHolidays, nextStep, prevStep } = usePlanStore();
  const [checkedHolidays, setCheckedHolidays] = useState({});

  const startDate = useMemo(
    () => (projectInputs.startDate ? new Date(projectInputs.startDate + 'T00:00:00') : new Date()),
    [projectInputs.startDate]
  );

  const endDate = useMemo(() => {
    if (projectInputs.deadline) return new Date(projectInputs.deadline + 'T00:00:00');
    return addDays(startDate, 365);
  }, [startDate, projectInputs.deadline]);

  // Fantasy office closure (Christmas–New Year)
  const fantasyClosures = useMemo(
    () => getFantasyClosures(startDate, endDate),
    [startDate, endDate]
  );

  const usHolidays = useMemo(
    () => getHolidaysForCountry('US', startDate, endDate),
    [startDate, endDate]
  );

  const clientHolidays = useMemo(() => {
    if (!projectInputs.clientCountry || projectInputs.clientCountry === 'US' || projectInputs.clientCountry === 'OTHER') {
      return [];
    }
    return getHolidaysForCountry(projectInputs.clientCountry, startDate, endDate);
  }, [projectInputs.clientCountry, startDate, endDate]);

  const allHolidays = useMemo(
    () => [...fantasyClosures, ...usHolidays, ...clientHolidays],
    [fantasyClosures, usHolidays, clientHolidays]
  );

  // Pre-check all holidays on mount
  useEffect(() => {
    const initial = {};
    for (const h of allHolidays) {
      const key = `${h.country}-${format(h.date, 'yyyy-MM-dd')}`;
      initial[key] = true;
    }
    setCheckedHolidays(initial);
  }, [allHolidays]);

  const toggleHoliday = (key) => {
    setCheckedHolidays((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleConfirm = () => {
    const confirmed = [];
    for (const h of allHolidays) {
      const key = `${h.country}-${format(h.date, 'yyyy-MM-dd')}`;
      if (checkedHolidays[key]) {
        confirmed.push(h);
      }
    }
    setConfirmedHolidays(confirmed);
    nextStep();
  };

  const showClientColumn = clientHolidays.length > 0;

  const renderColumn = (holidays, title, accentColor) => (
    <div className="flex-1 min-w-0">
      <h3 className={`text-sm font-bold uppercase tracking-wider mb-3 ${accentColor || 'text-slate-300'}`}>
        {title}
      </h3>
      {holidays.length === 0 ? (
        <p className="text-slate-500 text-sm">No holidays in this period</p>
      ) : (
        <div className="space-y-1">
          {holidays.map((h) => {
            const key = `${h.country}-${format(h.date, 'yyyy-MM-dd')}`;
            return (
              <label
                key={key}
                className="flex items-center gap-3 bg-slate-800 rounded-lg px-4 py-2.5 cursor-pointer hover:bg-slate-750"
              >
                <input
                  type="checkbox"
                  checked={!!checkedHolidays[key]}
                  onChange={() => toggleHoliday(key)}
                  className="w-4 h-4 accent-amber-500"
                />
                <span className="flex-1 text-sm">{h.name}</span>
                <span className="text-xs text-slate-400 w-24 text-right">
                  {format(h.date, 'MMM d, yyyy')}
                </span>
                <span className="text-xs text-slate-500 w-10 text-right">
                  {DAY_NAMES[h.date.getDay()]}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Holiday Review</h2>
      <p className="text-slate-400 text-sm mb-6">
        Confirm which holidays and office closures to exclude from the schedule. Unchecked days will be treated as working days.
      </p>

      {/* Fantasy Closure — always shown first */}
      {fantasyClosures.length > 0 && (
        <div className="mb-6">
          {renderColumn(fantasyClosures, 'Fantasy Office Closure (Dec 24 – Jan 1)', 'text-amber-400')}
        </div>
      )}

      <div className="flex gap-8">
        {renderColumn(usHolidays, 'US Public Holidays')}
        {showClientColumn && renderColumn(clientHolidays, `${projectInputs.clientCountry} Public Holidays`)}
      </div>

      <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 py-4 mt-6 flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {Object.values(checkedHolidays).filter(Boolean).length} days will be excluded from schedule
        </p>
        <div className="flex gap-3">
          <button
            className="px-6 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
            onClick={prevStep}
          >
            Back
          </button>
          <button
            className="px-6 py-2.5 bg-amber-500 text-slate-900 rounded-lg font-bold hover:bg-amber-400"
            onClick={handleConfirm}
          >
            Confirm & Generate Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
