import allActivities from '../data/activities.json';
import { getActivityDuration } from './activitySelector';
import {
  addBusinessDaysSkippingHolidays,
  skipToNextBusinessDay,
  buildHolidaySet,
} from './holidayUtils';

export function buildSchedule({
  selectedActivityIds,
  sizing,
  startDate,
  confirmedHolidays,
  clientCountry,
  screenCount,
  usabilityTestDep,
  deadline,
  manualOverrides = {},
}) {
  const holidaySet = buildHolidaySet(confirmedHolidays);
  const start = new Date(startDate + 'T00:00:00');
  const activityMap = new Map(allActivities.map((a) => [a.id, a]));
  const isInternational = clientCountry && clientCountry !== 'US';

  // Filter to selected activities
  const selected = selectedActivityIds
    .map((id) => activityMap.get(id))
    .filter(Boolean);

  // Build effective dependency map
  const depMap = new Map();
  for (const act of selected) {
    let deps = [...(act.dependencies || [])];
    if (act.id === 'E8' && usabilityTestDep) {
      deps = [usabilityTestDep];
    }
    deps = deps.filter((d) => selectedActivityIds.includes(d));
    depMap.set(act.id, deps);
  }

  // Separate by phase for strict ordering
  const insightActivities = selected.filter((a) => a.phase === 'insight');
  const visionActivities = selected.filter((a) => a.phase === 'vision');
  const executeActivities = selected.filter((a) => a.phase === 'execute');

  // Topological sort within a set of activities
  function topoSort(activities) {
    const ids = new Set(activities.map((a) => a.id));
    const inDegree = new Map();
    const adjList = new Map();
    for (const act of activities) {
      inDegree.set(act.id, 0);
      adjList.set(act.id, []);
    }
    for (const act of activities) {
      const deps = (depMap.get(act.id) || []).filter((d) => ids.has(d));
      inDegree.set(act.id, deps.length);
      for (const dep of deps) {
        if (adjList.has(dep)) adjList.get(dep).push(act.id);
      }
    }
    const queue = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }
    const sorted = [];
    while (queue.length > 0) {
      const id = queue.shift();
      sorted.push(id);
      for (const next of adjList.get(id) || []) {
        inDegree.set(next, inDegree.get(next) - 1);
        if (inDegree.get(next) === 0) queue.push(next);
      }
    }
    return sorted;
  }

  const scheduleMap = new Map();

  function scheduleActivity(id, phaseGateDate) {
    const act = activityMap.get(id);
    const deps = (depMap.get(id) || []).filter((d) => scheduleMap.has(d));

    let duration = getActivityDuration(act, sizing, screenCount, allActivities);

    // International override for Audience Research
    if (act.id === 'I12' && isInternational && act.internationalOverride) {
      const sizeKey = sizing === 'S' ? 'min' : sizing === 'M' ? 'mid' : 'max';
      duration = act.internationalOverride[sizeKey];
    }

    let earliestStart = new Date(start);

    // Phase gate constraint
    if (phaseGateDate) {
      const dayAfter = new Date(phaseGateDate);
      dayAfter.setDate(dayAfter.getDate() + 1);
      if (dayAfter > earliestStart) earliestStart = dayAfter;
    }

    // Dependency constraints
    for (const depId of deps) {
      const depSchedule = scheduleMap.get(depId);
      if (depSchedule) {
        const dayAfter = new Date(depSchedule.endDate);
        dayAfter.setDate(dayAfter.getDate() + 1);
        if (dayAfter > earliestStart) earliestStart = dayAfter;
      }
    }

    // Staggered pipeline: Visual Design starts 2-week offset from Wireframes start
    if (act.id === 'E2' && act.staggeredStart) {
      const wireframeSchedule = scheduleMap.get('E1');
      if (wireframeSchedule) {
        const staggerStart = addBusinessDaysSkippingHolidays(
          wireframeSchedule.startDate,
          11,
          holidaySet
        );
        if (staggerStart > earliestStart) earliestStart = staggerStart;
      }
    }

    // Parallel group alignment
    if (act.parallelGroup) {
      for (const [otherId, otherSched] of scheduleMap) {
        const otherAct = activityMap.get(otherId);
        if (otherAct?.parallelGroup === act.parallelGroup) {
          if (otherSched.startDate > earliestStart) {
            earliestStart = new Date(otherSched.startDate);
          }
        }
      }
    }

    // Apply manual override if present — but clamp so it can't go earlier than dependency floor
    if (manualOverrides[id]?.startDate) {
      const overrideDate = new Date(manualOverrides[id].startDate);
      if (overrideDate > earliestStart) {
        earliestStart = overrideDate;
      }
    }

    earliestStart = skipToNextBusinessDay(earliestStart, holidaySet);
    const endDate = addBusinessDaysSkippingHolidays(earliestStart, duration, holidaySet);

    scheduleMap.set(id, {
      ...act,
      startDate: earliestStart,
      endDate,
      durationDays: duration,
    });

    return endDate;
  }

  // PASS 1: Schedule Insight activities
  const insightSorted = topoSort(insightActivities);
  let insightGateEnd = null;
  for (const id of insightSorted) {
    const endDate = scheduleActivity(id, null);
    const act = activityMap.get(id);
    if (act.id === 'I17' || act.isPhaseGate) {
      insightGateEnd = endDate;
    }
  }

  // If no explicit gate, use the latest insight end date
  if (!insightGateEnd) {
    for (const id of insightSorted) {
      const s = scheduleMap.get(id);
      if (!insightGateEnd || s.endDate > insightGateEnd) insightGateEnd = s.endDate;
    }
  }

  // PASS 2: Schedule Vision activities (gated by Insights Synthesis)
  const visionSorted = topoSort(visionActivities);
  for (const id of visionSorted) {
    scheduleActivity(id, insightGateEnd);
  }

  // Compute the latest Vision end date as the Execute gate
  let visionGateEnd = null;
  for (const id of visionSorted) {
    const s = scheduleMap.get(id);
    if (!visionGateEnd || s.endDate > visionGateEnd) visionGateEnd = s.endDate;
  }

  // PASS 3: Schedule Execute activities (gated by ALL Vision completion)
  const executeSorted = topoSort(executeActivities);
  for (const id of executeSorted) {
    scheduleActivity(id, visionGateEnd);
  }

  // Re-align parallel groups
  for (const [id, sched] of scheduleMap) {
    const act = activityMap.get(id);
    if (!act?.parallelGroup) continue;
    let maxStart = sched.startDate;
    for (const [otherId, otherSched] of scheduleMap) {
      const otherAct = activityMap.get(otherId);
      if (otherAct?.parallelGroup === act.parallelGroup && otherSched.startDate > maxStart) {
        maxStart = new Date(otherSched.startDate);
      }
    }
    if (maxStart > sched.startDate) {
      const newStart = skipToNextBusinessDay(maxStart, holidaySet);
      const newEnd = addBusinessDaysSkippingHolidays(newStart, sched.durationDays, holidaySet);
      scheduleMap.set(id, { ...sched, startDate: newStart, endDate: newEnd });
    }
  }

  // Build final ordered schedule: insight → vision → execute
  const allSorted = [...insightSorted, ...visionSorted, ...executeSorted];
  const schedule = allSorted.map((id) => scheduleMap.get(id));

  // Deadline overrun
  let overrun = false;
  if (deadline) {
    const deadlineDate = new Date(deadline + 'T00:00:00');
    const lastEnd = schedule.reduce(
      (max, s) => (s.endDate > max ? s.endDate : max),
      schedule[0]?.startDate || start
    );
    overrun = lastEnd > deadlineDate;
  }

  return { schedule, overrun };
}
