import { useEffect, useState, useMemo } from 'react';
import { usePlanStore } from '../context/PlanContext';
import activities from '../data/activities.json';
import { selectActivitiesRuleBased, getActivityDuration } from '../utils/activitySelector';
import SizingToggle from './SizingToggle';

const PHASE_LABELS = { insight: 'Insight', vision: 'Vision', execute: 'Execute' };
const PHASE_COLORS = {
  insight: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  vision: 'bg-teal-400/20 text-teal-400 border-teal-400/30',
  execute: 'bg-violet-400/20 text-violet-400 border-violet-400/30',
};
const OWNER_COLORS = {
  UX: 'bg-blue-500/20 text-blue-400',
  'Visual Design': 'bg-pink-500/20 text-pink-400',
  'Product Management': 'bg-amber-500/20 text-amber-400',
  Strategy: 'bg-emerald-500/20 text-emerald-400',
  'Content Strategy': 'bg-purple-500/20 text-purple-400',
  Analytics: 'bg-cyan-500/20 text-cyan-400',
  Technology: 'bg-orange-500/20 text-orange-400',
  'UX/Dev': 'bg-indigo-500/20 text-indigo-400',
  'Analytics/UX': 'bg-teal-500/20 text-teal-400',
};

export default function ActivitySelector() {
  const {
    projectInputs,
    selectedActivities,
    setSelectedActivities,
    toggleActivity,
    sizing,
    aiSuggestions,
    aiReasonings,
    aiLoading,
    setAiSuggestions,
    setAiReasonings,
    setAiLoading,
    usabilityTestDep,
    setUsabilityTestDep,
    nextStep,
    prevStep,
  } = usePlanStore();

  const [expandedId, setExpandedId] = useState(null);
  const [showAddPanel, setShowAddPanel] = useState(false);

  // Run rule-based selection on mount
  useEffect(() => {
    const ruleSelected = selectActivitiesRuleBased(projectInputs);
    setSelectedActivities(ruleSelected);

    // Fire AI request in background if available
    (async () => {
      setAiLoading(true);
      try {
        const res = await fetch('/api/suggest-activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(projectInputs),
        });
        const data = await res.json();
        if (data.aiAvailable !== false && data.suggestions) {
          setAiSuggestions(data.suggestions);
          if (data.reasoning) {
            setAiReasonings(data.reasoning);
          }
        }
      } catch {
        // AI not available, that's fine
      }
      setAiLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Merge AI suggestions
  useEffect(() => {
    if (aiSuggestions.length > 0) {
      const current = usePlanStore.getState().selectedActivities;
      const merged = [...new Set([...current, ...aiSuggestions])];
      setSelectedActivities(merged);
    }
  }, [aiSuggestions]); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => {
    const groups = { insight: [], vision: [], execute: [] };
    for (const act of activities) {
      if (groups[act.phase]) groups[act.phase].push(act);
    }
    return groups;
  }, []);

  const isLocked = (actId) => {
    // Check if any selected activity depends on this one
    return selectedActivities.some((selId) => {
      const a = activities.find((x) => x.id === selId);
      return a?.dependencies?.includes(actId);
    });
  };

  const totalDuration = useMemo(() => {
    let max = 0;
    for (const id of selectedActivities) {
      const act = activities.find((a) => a.id === id);
      if (act) {
        const dur = getActivityDuration(act, sizing, projectInputs.screenCount, activities);
        max = Math.max(max, dur);
      }
    }
    return selectedActivities.reduce((sum, id) => {
      const act = activities.find((a) => a.id === id);
      if (!act) return sum;
      return sum + getActivityDuration(act, sizing, projectInputs.screenCount, activities);
    }, 0);
  }, [selectedActivities, sizing, projectInputs.screenCount]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Select Activities</h2>
        <div className="flex items-center gap-4">
          {aiLoading && (
            <span className="text-xs text-amber-400 animate-pulse">AI analyzing...</span>
          )}
          <SizingToggle />
        </div>
      </div>

      {/* Activity list by phase */}
      {Object.entries(grouped).map(([phase, acts]) => (
        <div key={phase} className="mb-6">
          <h3
            className={`text-sm font-bold uppercase tracking-wider mb-3 px-3 py-1.5 rounded-lg border inline-block ${PHASE_COLORS[phase]}`}
          >
            {PHASE_LABELS[phase]}
          </h3>
          <div className="space-y-1">
            {acts.map((act) => {
              const isSelected = selectedActivities.includes(act.id);
              const locked = isLocked(act.id) && isSelected;
              const isAiSuggested = aiSuggestions.includes(act.id);
              const duration = getActivityDuration(act, sizing, projectInputs.screenCount, activities);

              return (
                <div key={act.id} className="bg-slate-800 rounded-lg">
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-750"
                    onClick={() => !locked && toggleActivity(act.id)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="w-4 h-4 accent-amber-500"
                      disabled={locked}
                    />
                    {locked && <span className="text-slate-500 text-xs">🔒</span>}
                    <span className="flex-1 text-sm font-medium">{act.name}</span>
                    {isAiSuggested && (
                      <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded">
                        AI suggested
                      </span>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${OWNER_COLORS[act.owner] || 'bg-slate-700 text-slate-400'}`}
                    >
                      {act.owner}
                    </span>
                    <span className="text-xs text-slate-400 w-16 text-right">{duration}d</span>
                    {/* Usability testing dependency selector */}
                    {act.id === 'E8' && isSelected && (
                      <select
                        className="bg-slate-700 text-xs text-slate-300 rounded px-2 py-1 border border-slate-600"
                        value={usabilityTestDep}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          setUsabilityTestDep(e.target.value);
                        }}
                      >
                        <option value="E1">After Wireframes</option>
                        <option value="E2">After Visual Design</option>
                      </select>
                    )}
                    <button
                      className="text-slate-500 hover:text-white text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(expandedId === act.id ? null : act.id);
                      }}
                    >
                      {expandedId === act.id ? '▲' : '▼'}
                    </button>
                  </div>
                  {expandedId === act.id && (
                    <div className="px-4 pb-3 text-sm text-slate-400 border-t border-slate-700 pt-2">
                      {aiReasonings[act.id] && (
                        <p className="mb-2 text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded px-3 py-2 text-xs">
                          <strong>AI Reasoning:</strong> {aiReasonings[act.id]}
                        </p>
                      )}
                      {act.notes && <p className="mb-1">{act.notes}</p>}
                      {act.considerations && (
                        <p className="mb-1 text-slate-500">
                          <strong>Note:</strong> {act.considerations}
                        </p>
                      )}
                      {act.contributors?.length > 0 && (
                        <p className="text-slate-500">
                          Contributors: {act.contributors.join(', ')}
                        </p>
                      )}
                      {act.optional && (
                        <p className="text-amber-400 text-xs mt-1">Optional post-launch activity</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Add Activity button */}
      <button
        className="text-sm text-teal-400 hover:text-teal-300 mb-4"
        onClick={() => setShowAddPanel(!showAddPanel)}
      >
        {showAddPanel ? '− Hide Library' : '+ Browse Full Library'}
      </button>

      {/* Sticky footer */}
      <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 py-4 mt-4 flex items-center justify-between">
        <div className="text-sm text-slate-400">
          <span className="text-white font-bold">{selectedActivities.length}</span> activities
          selected · ~{totalDuration} business days total
        </div>
        <div className="flex gap-3">
          <button
            className="px-6 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
            onClick={prevStep}
          >
            Back
          </button>
          <button
            className="px-6 py-2.5 bg-amber-500 text-slate-900 rounded-lg font-bold hover:bg-amber-400 disabled:opacity-50"
            disabled={selectedActivities.length === 0}
            onClick={nextStep}
          >
            Confirm Activities
          </button>
        </div>
      </div>
    </div>
  );
}
