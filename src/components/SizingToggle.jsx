import { usePlanStore } from '../context/PlanContext';

const SIZES = ['S', 'M', 'L'];

export default function SizingToggle() {
  const sizing = usePlanStore((s) => s.sizing);
  const setSizing = usePlanStore((s) => s.setSizing);

  return (
    <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
      {SIZES.map((size) => (
        <button
          key={size}
          className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${
            sizing === size
              ? 'bg-amber-500 text-slate-900'
              : 'text-slate-400 hover:text-white'
          }`}
          onClick={() => setSizing(size)}
        >
          {size}
        </button>
      ))}
    </div>
  );
}
