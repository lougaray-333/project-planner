import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { usePlanStore } from '../context/PlanContext';
import { buildSchedule } from '../utils/scheduleBuilder';
import { format, differenceInCalendarDays, addDays, isWeekend } from 'date-fns';
import { toDateKey } from '../utils/holidayUtils';
import allActivities from '../data/activities.json';
import PlanSummary from './PlanSummary';
import SizingToggle from './SizingToggle';

const LABEL_WIDTH = 280;
const ROW_HEIGHT = 36;
const BAR_HEIGHT = 24;
const DAY_WIDTH = 28;
const HEADER_HEIGHT = 72;
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const PHASE_LABELS = { insight: 'Insight', vision: 'Vision', execute: 'Execute' };
const PHASE_HEADER_COLORS = {
  insight: '#f59e0b',
  vision: '#2dd4bf',
  execute: '#a78bfa',
};

// Discipline/owner color coding for bars
const DISCIPLINE_COLORS = {
  UX: '#60a5fa',
  'Visual Design': '#f472b6',
  'Product Management': '#fbbf24',
  Strategy: '#34d399',
  'Content Strategy': '#c084fc',
  Analytics: '#22d3ee',
  Technology: '#fb923c',
  'UX/Dev': '#818cf8',
  'Analytics/UX': '#2dd4bf',
};

function getDisciplineColor(owner) {
  return DISCIPLINE_COLORS[owner] || '#94a3b8';
}

export default function GanttChart() {
  const {
    selectedActivities,
    sizing,
    projectInputs,
    confirmedHolidays,
    usabilityTestDep,
    setSchedule,
    prevStep,
    manualOverrides,
    setManualOverride,
    clearAllOverrides,
  } = usePlanStore();

  const [tooltip, setTooltip] = useState(null);
  const [toast, setToast] = useState('');
  const [showComparePlaceholder, setShowComparePlaceholder] = useState(false);
  const [dragState, setDragState] = useState(null);
  const dragRef = useRef(null); // mutable ref for drag state during mousemove
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const rafRef = useRef(null);

  const hasOverrides = Object.keys(manualOverrides).length > 0;

  // Build schedule whenever inputs change (including manual overrides)
  const { schedule, overrun } = useMemo(() => {
    return buildSchedule({
      selectedActivityIds: selectedActivities,
      sizing,
      startDate: projectInputs.startDate,
      confirmedHolidays,
      clientCountry: projectInputs.clientCountry,
      screenCount: projectInputs.screenCount,
      usabilityTestDep,
      deadline: projectInputs.deadline,
      manualOverrides,
    });
  }, [selectedActivities, sizing, projectInputs, confirmedHolidays, usabilityTestDep, manualOverrides]);

  // Store the pre-drag schedule for ghost bars
  const preDragScheduleRef = useRef(null);
  useEffect(() => {
    if (!dragState) {
      preDragScheduleRef.current = schedule;
    }
  }, [schedule, dragState]);

  useEffect(() => {
    if (schedule) setSchedule(schedule);
  }, [schedule, setSchedule]);

  // Always group by phase, sorted by start date within phase
  const rows = useMemo(() => {
    if (!schedule || schedule.length === 0) return [];
    const phases = ['insight', 'vision', 'execute'];
    const result = [];
    for (const phase of phases) {
      const phaseItems = schedule.filter((s) => s.phase === phase);
      if (phaseItems.length > 0) {
        result.push({ type: 'header', phase, label: PHASE_LABELS[phase] });
        phaseItems
          .sort((a, b) => a.startDate - b.startDate)
          .forEach((item) => result.push({ type: 'activity', ...item }));
      }
    }
    return result;
  }, [schedule]);

  // Date range for chart
  const { chartStart, chartEnd, totalDays } = useMemo(() => {
    if (!schedule || schedule.length === 0) return { chartStart: new Date(), chartEnd: new Date(), totalDays: 0 };
    let min = schedule[0].startDate;
    let max = schedule[0].endDate;
    for (const s of schedule) {
      if (s.startDate < min) min = s.startDate;
      if (s.endDate > max) max = s.endDate;
    }
    const cs = addDays(min, -3);
    const ce = addDays(max, 7);
    return { chartStart: cs, chartEnd: ce, totalDays: differenceInCalendarDays(ce, cs) + 1 };
  }, [schedule]);

  const holidayDateKeys = useMemo(
    () => new Set(confirmedHolidays.map((h) => toDateKey(h.date))),
    [confirmedHolidays]
  );

  const dateToX = (date) => differenceInCalendarDays(date, chartStart) * DAY_WIDTH;

  const totalWidth = totalDays * DAY_WIDTH;
  const totalHeight = HEADER_HEIGHT + rows.length * ROW_HEIGHT + 20;

  // Compute week spans for the header
  const weekSpans = useMemo(() => {
    if (totalDays === 0) return [];
    const spans = [];
    let weekNum = 1;
    let weekStart = 0;
    for (let di = 0; di < totalDays; di++) {
      const day = addDays(chartStart, di);
      // Start a new week on Monday (except for the very first partial week)
      if (day.getDay() === 1 && di > 0) {
        spans.push({ weekNum, startIdx: weekStart, endIdx: di - 1 });
        weekNum++;
        weekStart = di;
      }
    }
    // Push the last (possibly partial) week
    spans.push({ weekNum, startIdx: weekStart, endIdx: totalDays - 1 });
    return spans;
  }, [chartStart, totalDays]);

  // BFS to find downstream dependents of an activity
  const activityMap = useMemo(() => new Map(allActivities.map((a) => [a.id, a])), []);

  const getDownstreamIds = useCallback((activityId) => {
    const downstream = new Set();
    const queue = [activityId];
    while (queue.length > 0) {
      const current = queue.shift();
      for (const act of allActivities) {
        if (act.dependencies?.includes(current) && selectedActivities.includes(act.id) && !downstream.has(act.id)) {
          downstream.add(act.id);
          queue.push(act.id);
        }
      }
    }
    return downstream;
  }, [selectedActivities]);

  // Drag handlers
  const handleBarMouseDown = useCallback((e, row) => {
    e.preventDefault();
    const affectedIds = getDownstreamIds(row.id);
    const state = {
      activityId: row.id,
      initialMouseX: e.clientX,
      initialStartDate: new Date(row.startDate),
      affectedIds,
      originalStartDate: new Date(row.startDate),
    };
    dragRef.current = state;
    setDragState(state);
    setTooltip(null);

    const handleMouseMove = (moveEvent) => {
      if (!dragRef.current) return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const dx = moveEvent.clientX - dragRef.current.initialMouseX;
        const deltaDays = Math.round(dx / DAY_WIDTH);
        if (deltaDays === 0 && !manualOverrides[dragRef.current.activityId]) return;
        const newStart = addDays(dragRef.current.initialStartDate, deltaDays);
        setManualOverride(dragRef.current.activityId, newStart.toISOString());
      });
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      setDragState(null);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [getDownstreamIds, setManualOverride, manualOverrides]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  // Build discipline legend from visible activities
  const legendItems = useMemo(() => {
    if (!schedule) return [];
    const seen = new Set();
    const items = [];
    for (const s of schedule) {
      if (!seen.has(s.owner)) {
        seen.add(s.owner);
        items.push({ owner: s.owner, color: getDisciplineColor(s.owner) });
      }
    }
    return items;
  }, [schedule]);

  if (!schedule || schedule.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p>No schedule to display. Go back and select activities.</p>
        <button className="mt-4 px-6 py-2 bg-slate-700 rounded-lg" onClick={prevStep}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div>
      <PlanSummary schedule={schedule} overrun={overrun} />

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <SizingToggle />
        </div>
        <div className="flex gap-2">
          {hasOverrides && (
            <button
              className="px-3 py-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-sm hover:bg-amber-500/30"
              onClick={clearAllOverrides}
            >
              Reset Manual Adjustments
            </button>
          )}
          <button
            className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600"
            onClick={() => setShowComparePlaceholder(true)}
          >
            Compare Plans
          </button>
          <button
            className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600"
            onClick={() => showToast('Coming soon')}
          >
            Export PDF
          </button>
          <button
            className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600"
            onClick={() => showToast('Coming soon')}
          >
            Export PNG
          </button>
          <button
            className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600"
            onClick={() => showToast('Coming soon')}
          >
            Share Link
          </button>
        </div>
      </div>

      {/* Discipline color legend */}
      <div className="flex flex-wrap items-center gap-4 mb-3 text-xs text-slate-400">
        {legendItems.map((item) => (
          <div key={item.owner} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
            <span>{item.owner}</span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div ref={containerRef} className="overflow-x-auto bg-slate-800 rounded-xl border border-slate-700 relative">
        <svg
          ref={svgRef}
          width={LABEL_WIDTH + totalWidth}
          height={totalHeight}
          className="select-none"
        >
          {/* Background stripes */}
          {rows.map((row, i) => {
            const y = HEADER_HEIGHT + i * ROW_HEIGHT;
            return (
              <rect
                key={`row-${i}`}
                x={0}
                y={y}
                width={LABEL_WIDTH + totalWidth}
                height={ROW_HEIGHT}
                fill={i % 2 === 0 ? '#1e293b' : '#0f172a'}
              />
            );
          })}

          {/* Weekend shading (covers header + body) */}
          {Array.from({ length: totalDays }).map((_, di) => {
            const day = addDays(chartStart, di);
            if (!isWeekend(day)) return null;
            return (
              <g key={`we-${di}`}>
                <rect
                  x={LABEL_WIDTH + di * DAY_WIDTH}
                  y={0}
                  width={DAY_WIDTH}
                  height={HEADER_HEIGHT}
                  fill="rgba(100, 116, 139, 0.06)"
                />
                <rect
                  x={LABEL_WIDTH + di * DAY_WIDTH}
                  y={HEADER_HEIGHT}
                  width={DAY_WIDTH}
                  height={rows.length * ROW_HEIGHT}
                  fill="rgba(100, 116, 139, 0.08)"
                />
              </g>
            );
          })}

          {/* Holiday dashed lines */}
          {Array.from({ length: totalDays }).map((_, di) => {
            const day = addDays(chartStart, di);
            const key = toDateKey(day);
            if (!holidayDateKeys.has(key)) return null;
            return (
              <line
                key={`hol-${di}`}
                x1={LABEL_WIDTH + di * DAY_WIDTH + DAY_WIDTH / 2}
                y1={HEADER_HEIGHT}
                x2={LABEL_WIDTH + di * DAY_WIDTH + DAY_WIDTH / 2}
                y2={HEADER_HEIGHT + rows.length * ROW_HEIGHT}
                stroke="#f59e0b"
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={0.3}
              />
            );
          })}

          {/* Row 1: Week number labels (y=0–22) */}
          {weekSpans.map((span) => {
            const x = LABEL_WIDTH + span.startIdx * DAY_WIDTH;
            const w = (span.endIdx - span.startIdx + 1) * DAY_WIDTH;
            return (
              <g key={`wk-${span.weekNum}`}>
                <rect x={x} y={0} width={w} height={22} fill="#1e293b" stroke="#334155" strokeWidth={0.5} />
                <text
                  x={x + w / 2}
                  y={15}
                  fill="#94a3b8"
                  fontSize={10}
                  fontWeight="600"
                  textAnchor="middle"
                >
                  Week {span.weekNum}
                </text>
              </g>
            );
          })}

          {/* Row 2: Day letter labels (y=24–46) */}
          {Array.from({ length: totalDays }).map((_, di) => {
            const day = addDays(chartStart, di);
            const weekend = isWeekend(day);
            return (
              <text
                key={`dl-${di}`}
                x={LABEL_WIDTH + di * DAY_WIDTH + DAY_WIDTH / 2}
                y={38}
                fill={weekend ? '#475569' : '#94a3b8'}
                fontSize={10}
                fontWeight="500"
                textAnchor="middle"
              >
                {DAY_LETTERS[day.getDay()]}
              </text>
            );
          })}

          {/* Row 3: Date labels M/d (y=48–70) */}
          {Array.from({ length: totalDays }).map((_, di) => {
            const day = addDays(chartStart, di);
            const weekend = isWeekend(day);
            return (
              <text
                key={`dt-${di}`}
                x={LABEL_WIDTH + di * DAY_WIDTH + DAY_WIDTH / 2}
                y={62}
                fill={weekend ? '#475569' : '#64748b'}
                fontSize={8}
                textAnchor="middle"
              >
                {format(day, 'M/d')}
              </text>
            );
          })}

          {/* Header bottom border */}
          <line x1={LABEL_WIDTH} y1={HEADER_HEIGHT} x2={LABEL_WIDTH + totalWidth} y2={HEADER_HEIGHT} stroke="#334155" strokeWidth={1} />

          {/* Today marker */}
          {(() => {
            const today = new Date();
            if (today >= chartStart && today <= chartEnd) {
              const x = LABEL_WIDTH + dateToX(today);
              return (
                <line
                  x1={x} y1={HEADER_HEIGHT}
                  x2={x} y2={HEADER_HEIGHT + rows.length * ROW_HEIGHT}
                  stroke="#3b82f6" strokeWidth={2}
                />
              );
            }
            return null;
          })()}

          {/* Deadline marker */}
          {projectInputs.deadline &&
            (() => {
              const dl = new Date(projectInputs.deadline + 'T00:00:00');
              if (dl >= chartStart && dl <= chartEnd) {
                const x = LABEL_WIDTH + dateToX(dl);
                return (
                  <line
                    x1={x} y1={HEADER_HEIGHT}
                    x2={x} y2={HEADER_HEIGHT + rows.length * ROW_HEIGHT}
                    stroke="#ef4444" strokeWidth={2} strokeDasharray="6 4"
                  />
                );
              }
              return null;
            })()}

          {/* Labels and bars */}
          {rows.map((row, i) => {
            const y = HEADER_HEIGHT + i * ROW_HEIGHT;

            if (row.type === 'header') {
              return (
                <g key={`hdr-${i}`}>
                  <rect x={0} y={y} width={LABEL_WIDTH} height={ROW_HEIGHT} fill="#1a2332" />
                  <text
                    x={12}
                    y={y + ROW_HEIGHT / 2 + 4}
                    fill={PHASE_HEADER_COLORS[row.phase] || '#e2e8f0'}
                    fontSize={11}
                    fontWeight="700"
                  >
                    {row.label.toUpperCase()}
                  </text>
                </g>
              );
            }

            const barX = LABEL_WIDTH + dateToX(row.startDate);
            const barW = Math.max(
              (differenceInCalendarDays(row.endDate, row.startDate) + 1) * DAY_WIDTH - 2,
              DAY_WIDTH - 2
            );
            const barY = y + (ROW_HEIGHT - BAR_HEIGHT) / 2;
            const color = getDisciplineColor(row.owner);
            const isDragging = dragState?.activityId === row.id;
            const isAffected = dragState?.affectedIds?.has(row.id);

            // Ghost bar: show original position during drag
            const preDragItem = isDragging && preDragScheduleRef.current
              ? preDragScheduleRef.current.find((s) => s.id === row.id)
              : null;
            const ghostX = preDragItem ? LABEL_WIDTH + dateToX(preDragItem.startDate) : null;
            const ghostW = preDragItem
              ? Math.max((differenceInCalendarDays(preDragItem.endDate, preDragItem.startDate) + 1) * DAY_WIDTH - 2, DAY_WIDTH - 2)
              : null;

            return (
              <g
                key={`bar-${i}`}
                onMouseEnter={(e) => {
                  if (dragState) return;
                  const rect = containerRef.current.getBoundingClientRect();
                  setTooltip({
                    x: e.clientX - rect.left + 10,
                    y: e.clientY - rect.top - 10,
                    activity: row,
                  });
                }}
                onMouseMove={(e) => {
                  if (dragState) return;
                  const rect = containerRef.current.getBoundingClientRect();
                  setTooltip((prev) =>
                    prev ? { ...prev, x: e.clientX - rect.left + 10, y: e.clientY - rect.top - 10 } : null
                  );
                }}
                onMouseLeave={() => { if (!dragState) setTooltip(null); }}
              >
                {/* Label */}
                <text x={16} y={y + ROW_HEIGHT / 2 + 4} fill="#e2e8f0" fontSize={12}>
                  {row.name?.length > 32 ? row.name.slice(0, 30) + '...' : row.name}
                </text>

                {/* Ghost bar at original position during drag */}
                {isDragging && ghostX !== null && (
                  <rect
                    x={ghostX} y={barY}
                    width={ghostW} height={BAR_HEIGHT}
                    rx={4}
                    fill={color} opacity={0.2}
                    strokeDasharray="4 3"
                    stroke={color}
                    strokeWidth={1}
                  />
                )}

                {/* Bar — color-coded by discipline */}
                <rect
                  x={barX} y={barY}
                  width={barW} height={BAR_HEIGHT}
                  rx={4}
                  fill={color} opacity={isDragging ? 0.95 : 0.85}
                  className={isDragging ? 'cursor-grabbing' : 'cursor-grab'}
                  onMouseDown={(e) => handleBarMouseDown(e, row)}
                  stroke={isAffected ? '#f59e0b' : 'none'}
                  strokeWidth={isAffected ? 2 : 0}
                  strokeDasharray={isAffected ? '4 2' : 'none'}
                />

                {/* Duration label on bar */}
                {barW > 40 && (
                  <text
                    x={barX + barW / 2}
                    y={barY + BAR_HEIGHT / 2 + 4}
                    fill="#0f172a"
                    fontSize={10}
                    fontWeight="600"
                    textAnchor="middle"
                    style={{ pointerEvents: 'none' }}
                  >
                    {row.durationDays}d
                  </text>
                )}
              </g>
            );
          })}

          {/* Dependency arrows */}
          {rows
            .filter((r) => r.type === 'activity')
            .map((row) => {
              const deps = row.dependencies || [];
              return deps
                .filter((depId) => rows.some((r) => r.id === depId))
                .map((depId) => {
                  const depRow = rows.find((r) => r.id === depId);
                  if (!depRow) return null;
                  const depIdx = rows.indexOf(depRow);
                  const rowIdx = rows.indexOf(row);

                  const x1 = LABEL_WIDTH + dateToX(depRow.endDate) + DAY_WIDTH;
                  const y1 = HEADER_HEIGHT + depIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const x2 = LABEL_WIDTH + dateToX(row.startDate);
                  const y2 = HEADER_HEIGHT + rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

                  return (
                    <path
                      key={`dep-${depId}-${row.id}`}
                      d={`M ${x1} ${y1} C ${x1 + 20} ${y1}, ${x2 - 20} ${y2}, ${x2} ${y2}`}
                      fill="none"
                      stroke="#475569"
                      strokeWidth={1}
                      markerEnd="url(#arrowhead)"
                    />
                  );
                });
            })}

          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <path d="M 0 0 L 8 3 L 0 6 Z" fill="#475569" />
            </marker>
          </defs>
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-sm z-50 pointer-events-none shadow-xl max-w-xs"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <div className="font-bold text-white mb-1">{tooltip.activity.name}</div>
            <div className="text-slate-400 text-xs space-y-0.5">
              <div className="flex items-center gap-2">
                <span>Owner:</span>
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block w-2 h-2 rounded-sm"
                    style={{ backgroundColor: getDisciplineColor(tooltip.activity.owner) }}
                  />
                  {tooltip.activity.owner}
                </span>
              </div>
              {tooltip.activity.contributors?.length > 0 && (
                <div>Contributors: {tooltip.activity.contributors.join(', ')}</div>
              )}
              <div>
                {format(tooltip.activity.startDate, 'MMM d')} —{' '}
                {format(tooltip.activity.endDate, 'MMM d, yyyy')}
              </div>
              <div>{tooltip.activity.durationDays} business days</div>
              {tooltip.activity.deliverables?.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-700">
                  <div className="text-slate-300 font-medium mb-0.5">Deliverables:</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {tooltip.activity.deliverables.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          className="px-6 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
          onClick={prevStep}
        >
          Back
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-700 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* Compare Plans placeholder */}
      {showComparePlaceholder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-8 max-w-md text-center">
            <h3 className="text-xl font-bold mb-2">Compare Plans</h3>
            <p className="text-slate-400 mb-4">
              Side-by-side S/M/L plan comparison coming in v2.
            </p>
            <button
              className="px-6 py-2 bg-amber-500 text-slate-900 rounded-lg font-bold"
              onClick={() => setShowComparePlaceholder(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
