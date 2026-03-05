import activities from '../data/activities.json';
import { CORE_ACTIVITIES, INDUSTRY_RULES, KEYWORD_RULES } from './activitySelector';

const activityMap = new Map(activities.map((a) => [a.id, a]));

function getActivityName(id) {
  return activityMap.get(id)?.name || id;
}

function formatList(ids) {
  return ids.map((id) => getActivityName(id)).join(', ');
}

export function buildRationale({ projectInputs, selectedActivities }) {
  const sections = [];
  const selectedSet = new Set(selectedActivities);

  // 1. Project context
  const contextParts = [];
  if (projectInputs.projectName) contextParts.push(`project "${projectInputs.projectName}"`);
  if (projectInputs.industry) contextParts.push(`in the ${projectInputs.industry} industry`);
  if (projectInputs.screenCount) contextParts.push(`with ~${projectInputs.screenCount} screens`);

  sections.push({
    title: 'Project Context',
    body: contextParts.length > 0
      ? `This plan was built for ${contextParts.join(' ')}.`
      : 'This plan was generated based on the provided project inputs.',
  });

  // 2. Core activities
  const allCore = [
    ...CORE_ACTIVITIES.insight,
    ...CORE_ACTIVITIES.vision,
    ...CORE_ACTIVITIES.execute,
  ];
  const includedCore = allCore.filter((id) => selectedSet.has(id));
  const removedCore = allCore.filter((id) => !selectedSet.has(id));

  sections.push({
    title: 'Core Activities',
    body: `Every plan starts with a foundational set of activities across Insight, Vision, and Execute phases. ${includedCore.length} core activities are included: ${formatList(includedCore)}.`
      + (removedCore.length > 0 ? ` Note: ${formatList(removedCore)} were removed from the core set.` : ''),
  });

  // 3. Industry-specific
  if (projectInputs.industry && INDUSTRY_RULES[projectInputs.industry]) {
    const industryIds = INDUSTRY_RULES[projectInputs.industry];
    const included = industryIds.filter((id) => selectedSet.has(id));
    const excluded = industryIds.filter((id) => !selectedSet.has(id));

    if (included.length > 0) {
      sections.push({
        title: 'Industry-Specific Activities',
        body: `Based on the ${projectInputs.industry} industry, the following were added: ${formatList(included)}.`
          + (excluded.length > 0 ? ` ${formatList(excluded)} were recommended but not included.` : ''),
      });
    }
  }

  // 4. Keyword-matched
  const text = `${projectInputs.description || ''} ${projectInputs.rfpText || ''}`.toLowerCase();
  const keywordMatches = [];
  for (const rule of KEYWORD_RULES) {
    const matchedKeywords = rule.keywords.filter((kw) => text.includes(kw));
    if (matchedKeywords.length > 0) {
      const included = rule.activities.filter((id) => selectedSet.has(id));
      if (included.length > 0) {
        keywordMatches.push({
          keywords: matchedKeywords,
          activities: included,
        });
      }
    }
  }

  if (keywordMatches.length > 0) {
    const lines = keywordMatches.map(
      (m) => `Keywords "${m.keywords.join(', ')}" triggered: ${formatList(m.activities)}`
    );
    sections.push({
      title: 'Keyword-Matched Activities',
      body: `The project description and RFP text were analyzed for relevant signals.\n${lines.join('\n')}`,
    });
  }

  // 5. Dependency chain
  const coreAndRuleIds = new Set(allCore);
  if (projectInputs.industry && INDUSTRY_RULES[projectInputs.industry]) {
    INDUSTRY_RULES[projectInputs.industry].forEach((id) => coreAndRuleIds.add(id));
  }
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) {
      rule.activities.forEach((id) => coreAndRuleIds.add(id));
    }
  }

  const addedByDeps = selectedActivities.filter(
    (id) => !coreAndRuleIds.has(id) && activityMap.has(id)
  );

  // Check which were pulled in as dependencies vs manually added
  const depPulled = [];
  const manuallyAdded = [];
  for (const id of addedByDeps) {
    const act = activityMap.get(id);
    // Check if any selected activity depends on this one
    const isNeededAsDep = selectedActivities.some((otherId) => {
      const other = activityMap.get(otherId);
      return other?.dependencies?.includes(id);
    });
    if (isNeededAsDep) {
      depPulled.push(id);
    } else {
      manuallyAdded.push(id);
    }
  }

  if (depPulled.length > 0) {
    sections.push({
      title: 'Dependency Chain',
      body: `The following activities were automatically included to satisfy dependency requirements: ${formatList(depPulled)}.`,
    });
  }

  // 6. Manual adjustments
  if (manuallyAdded.length > 0) {
    sections.push({
      title: 'Manual Additions',
      body: `The following activities were added manually beyond rule-based suggestions: ${formatList(manuallyAdded)}.`,
    });
  }

  // 7. Summary
  const phaseCount = {
    insight: selectedActivities.filter((id) => activityMap.get(id)?.phase === 'insight').length,
    vision: selectedActivities.filter((id) => activityMap.get(id)?.phase === 'vision').length,
    execute: selectedActivities.filter((id) => activityMap.get(id)?.phase === 'execute').length,
  };

  sections.push({
    title: 'Summary',
    body: `The final plan includes ${selectedActivities.length} activities: ${phaseCount.insight} in Insight, ${phaseCount.vision} in Vision, and ${phaseCount.execute} in Execute. This selection balances thoroughness with efficiency for the project scope.`,
  });

  return sections;
}
