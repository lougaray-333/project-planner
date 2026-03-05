import activities from '../data/activities.json';

// Core activities always included per phase
export const CORE_ACTIVITIES = {
  insight: ['I1', 'I2', 'I3', 'I17'],
  vision: ['V1', 'V3', 'V4', 'V12'],
  execute: ['E1', 'E2', 'E4'],
};

// Industry-based conditional activities
export const INDUSTRY_RULES = {
  Healthcare: ['I7', 'E18', 'I6'],
  'Financial Services': ['I7', 'E18', 'I4', 'I6'],
  Retail: ['I4', 'I13', 'E9', 'E10'],
  Media: ['I5', 'I13', 'E9', 'E14', 'E15'],
  Tech: ['I6', 'I4', 'V7', 'E18'],
  CPG: ['I12', 'I14', 'E7'],
  Travel: ['I4', 'I10', 'E11'],
};

// Keyword-based conditional activities
export const KEYWORD_RULES = [
  { keywords: ['accessibility', 'wcag', 'ada', 'a11y'], activities: ['I7', 'E18'] },
  { keywords: ['content', 'copy', 'editorial', 'writing'], activities: ['I5', 'V5', 'E14', 'E15', 'E16'] },
  { keywords: ['seo', 'search', 'organic'], activities: ['I13', 'E10'] },
  { keywords: ['brand', 'rebrand', 'identity'], activities: ['I14', 'V3', 'E7', 'E19'] },
  { keywords: ['research', 'user testing', 'usability'], activities: ['I2', 'I9', 'E8'] },
  { keywords: ['analytics', 'data', 'measurement', 'kpi'], activities: ['I4', 'V10', 'E22'] },
  { keywords: ['motion', 'animation', 'interactive'], activities: ['E5', 'E6'] },
  { keywords: ['3d', 'three-dimensional', 'immersive'], activities: ['E5', 'E6'] },
  { keywords: ['app', 'mobile', 'native'], activities: ['I8', 'V2', 'E11'] },
  { keywords: ['migration', 'replatform', 'redesign'], activities: ['I5', 'I6', 'I16'] },
  { keywords: ['governance', 'workflow'], activities: ['E12', 'E13'] },
  { keywords: ['naming', 'product name'], activities: ['I15'] },
  { keywords: ['notification', 'email', 'push'], activities: ['E11'] },
  { keywords: ['persona', 'audience', 'segment'], activities: ['I11', 'I12'] },
  { keywords: ['journey', 'experience map'], activities: ['I10', 'V9'] },
  { keywords: ['prototype', 'concept'], activities: ['V6', 'V8'] },
  { keywords: ['illustration', 'visual asset'], activities: ['E7'] },
  { keywords: ['style guide', 'design system'], activities: ['V4', 'E19'] },
  { keywords: ['survey', 'quantitative'], activities: ['I9'] },
];

export function selectActivitiesRuleBased(projectInputs) {
  const selected = new Set();

  // 1. Core activities
  for (const phase of Object.keys(CORE_ACTIVITIES)) {
    CORE_ACTIVITIES[phase].forEach((id) => selected.add(id));
  }

  // 2. Industry-conditional
  const industryActivities = INDUSTRY_RULES[projectInputs.industry] || [];
  industryActivities.forEach((id) => selected.add(id));

  // 3. Keyword-conditional
  const text = `${projectInputs.description} ${projectInputs.rfpText}`.toLowerCase();
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) {
      rule.activities.forEach((id) => selected.add(id));
    }
  }

  // 4. Transitive dependency resolution
  const resolved = resolveDependencies(selected);

  return [...resolved];
}

function resolveDependencies(selectedIds) {
  const activityMap = new Map(activities.map((a) => [a.id, a]));
  const resolved = new Set(selectedIds);
  let changed = true;

  while (changed) {
    changed = false;
    for (const id of [...resolved]) {
      const activity = activityMap.get(id);
      if (!activity) continue;
      for (const depId of activity.dependencies || []) {
        if (!resolved.has(depId)) {
          resolved.add(depId);
          changed = true;
        }
      }
    }
  }

  return resolved;
}

export function getActivityDuration(activity, sizing, screenCount, allActivities) {
  const sizeKey = sizing === 'S' ? 'min' : sizing === 'M' ? 'mid' : 'max';

  if (activity.durationMode === 'screenDriven') {
    return computeScreenDrivenDuration(activity, sizing, screenCount, allActivities);
  }

  if (activity.durationMode === 'derived') {
    const baseActivity = allActivities.find((a) => a.id === activity.derivedConfig.baseActivity);
    if (baseActivity) {
      const baseDuration = getActivityDuration(baseActivity, sizing, screenCount, allActivities);
      return Math.ceil(baseDuration * activity.derivedConfig.ratio);
    }
  }

  if (activity.durationRange) {
    return activity.durationRange[sizeKey];
  }

  return 10; // fallback
}

function computeScreenDrivenDuration(activity, sizing, screenCount, allActivities) {
  const screens = screenCount || 20; // default
  const config = activity.screenDrivenConfig;

  if (config.throughput) {
    // Wireframes: batches based on throughput
    const sizeKey = sizing === 'S' ? 'S' : sizing === 'M' ? 'M' : 'L';
    const screensPerBatch = config.throughput[sizeKey];
    const batches = Math.ceil(screens / screensPerBatch);
    return batches * config.batchDays;
  }

  if (config.ratioToWireframes) {
    // Visual Design, UX Writing: ratio of wireframe duration
    const wireframes = allActivities.find((a) => a.id === 'E1');
    if (wireframes) {
      const wfDuration = computeScreenDrivenDuration(wireframes, sizing, screenCount, allActivities);
      return Math.ceil(wfDuration * config.ratioToWireframes);
    }
  }

  if (config.formula === 'ceil(screens/6)') {
    // Dev Annotations
    return Math.ceil(screens / 6);
  }

  return 10;
}
