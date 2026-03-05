export default function HolidayBadge({ count }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
      {count} holiday{count !== 1 ? 's' : ''} excluded
    </span>
  );
}
