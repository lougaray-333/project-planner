import { usePlanStore } from './context/PlanContext';
import InputScreen from './components/InputScreen';
import ActivitySelector from './components/ActivitySelector';
import HolidayReview from './components/HolidayReview';
import GanttChart from './components/GanttChart';

const STEPS = [
  { label: 'Project Details', component: InputScreen },
  { label: 'Activities', component: ActivitySelector },
  { label: 'Holidays', component: HolidayReview },
  { label: 'Schedule', component: GanttChart },
];

function StepIndicator({ currentStep }) {
  const setCurrentStep = usePlanStore((s) => s.setCurrentStep);

  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((step, i) => {
        const canClick = i < currentStep;
        return (
          <div key={i} className="flex items-center gap-2">
            <button
              disabled={!canClick}
              onClick={() => canClick && setCurrentStep(i)}
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                i === currentStep
                  ? 'bg-amber-500 text-slate-900'
                  : i < currentStep
                  ? 'bg-teal-400 text-slate-900 hover:bg-teal-300 cursor-pointer'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {i < currentStep ? '✓' : i + 1}
            </button>
            <span
              className={`text-sm hidden sm:inline ${
                canClick ? 'text-teal-400 hover:text-teal-300 cursor-pointer' : i === currentStep ? 'text-white font-medium' : 'text-slate-400'
              }`}
              onClick={() => canClick && setCurrentStep(i)}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-px ${i < currentStep ? 'bg-teal-400' : 'bg-slate-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const currentStep = usePlanStore((s) => s.currentStep);
  const StepComponent = STEPS[currentStep].component;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-amber-500">Fantasy</span>{' '}
            <span className="text-slate-300 font-normal">Project Planner</span>
          </h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <StepIndicator currentStep={currentStep} />
        <StepComponent />
      </main>
    </div>
  );
}
