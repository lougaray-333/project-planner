import { useState, useEffect } from 'react';
import { usePlanStore } from '../context/PlanContext';
import { format } from 'date-fns';
import { buildRationale } from '../utils/rationaleBuilder';

const RESOURCE_ESTIMATES = { S: '3–4', M: '5–7', L: '8–12' };

export default function PlanSummary({ schedule, overrun }) {
  const { projectInputs, sizing, selectedActivities, planRationale, setPlanRationale } = usePlanStore();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(
    projectInputs.projectName || 'Untitled Project'
  );
  const [rationaleOpen, setRationaleOpen] = useState(false);
  const updateProjectInputs = usePlanStore((s) => s.updateProjectInputs);

  // Compute rationale when entering Step 4
  useEffect(() => {
    const rationale = buildRationale({ projectInputs, selectedActivities });
    setPlanRationale(rationale);
  }, [projectInputs, selectedActivities, setPlanRationale]);

  if (!schedule || schedule.length === 0) return null;

  const startDate = schedule.reduce(
    (min, s) => (s.startDate < min ? s.startDate : min),
    schedule[0].startDate
  );
  const endDate = schedule.reduce(
    (max, s) => (s.endDate > max ? s.endDate : max),
    schedule[0].endDate
  );

  const insightCount = schedule.filter((s) => s.phase === 'insight').length;
  const visionCount = schedule.filter((s) => s.phase === 'vision').length;
  const executeCount = schedule.filter((s) => s.phase === 'execute').length;

  const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));

  return (
    <div className="bg-slate-800 rounded-xl p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          {editingName ? (
            <input
              autoFocus
              className="text-xl font-bold bg-slate-700 border border-amber-500 rounded px-2 py-1 text-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                setEditingName(false);
                updateProjectInputs({ projectName: name });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setEditingName(false);
                  updateProjectInputs({ projectName: name });
                }
              }}
            />
          ) : (
            <h2
              className="text-xl font-bold cursor-pointer hover:text-amber-500 transition-colors"
              onClick={() => setEditingName(true)}
              title="Click to edit"
            >
              {name}
            </h2>
          )}
          <p className="text-sm text-slate-400 mt-1">
            {format(startDate, 'MMM d, yyyy')} — {format(endDate, 'MMM d, yyyy')} ·{' '}
            {totalDays} calendar days
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-500">{sizing}</div>
            <div className="text-xs text-slate-400">Sizing</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{selectedActivities.length}</div>
            <div className="text-xs text-slate-400">Activities</div>
          </div>
        </div>
      </div>

      <div className="flex gap-6 text-sm">
        <div>
          <span className="text-amber-400 font-bold">{insightCount}</span>{' '}
          <span className="text-slate-400">Insight</span>
        </div>
        <div>
          <span className="text-teal-400 font-bold">{visionCount}</span>{' '}
          <span className="text-slate-400">Vision</span>
        </div>
        <div>
          <span className="text-violet-400 font-bold">{executeCount}</span>{' '}
          <span className="text-slate-400">Execute</span>
        </div>
        <div className="ml-auto text-slate-400">
          Est. team: <span className="text-white font-medium">{RESOURCE_ESTIMATES[sizing]}</span>{' '}
          people
          <span className="text-slate-500 text-xs ml-1">(directional)</span>
        </div>
      </div>

      {overrun && (
        <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-red-400 text-sm">
          Schedule exceeds deadline by{' '}
          {Math.round(
            (endDate - new Date(projectInputs.deadline + 'T00:00:00')) / (1000 * 60 * 60 * 24)
          )}{' '}
          days. Consider reducing scope or adjusting sizing.
        </div>
      )}

      {/* Plan Rationale */}
      {planRationale && planRationale.length > 0 && (
        <div className="mt-4 border-t border-slate-700 pt-3">
          <button
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors w-full text-left"
            onClick={() => setRationaleOpen(!rationaleOpen)}
          >
            <span className={`transition-transform ${rationaleOpen ? 'rotate-90' : ''}`}>&#9654;</span>
            <span className="font-medium">Plan Rationale</span>
            <span className="text-slate-500 text-xs ml-1">— why these activities were selected</span>
          </button>
          {rationaleOpen && (
            <div className="mt-3 space-y-3 text-sm">
              {planRationale.map((section, i) => (
                <div key={i}>
                  <div className="text-slate-300 font-medium mb-1">{section.title}</div>
                  <div className="text-slate-400 whitespace-pre-line">{section.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
