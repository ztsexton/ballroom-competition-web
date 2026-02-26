interface BreakFormProps {
  breakLabel: string;
  breakDuration: number | '';
  breakPosition: number;
  heatCount: number;
  onLabelChange: (label: string) => void;
  onDurationChange: (duration: number | '') => void;
  onPositionChange: (position: number) => void;
  onSubmit: () => void;
}

export default function BreakForm({
  breakLabel,
  breakDuration,
  breakPosition,
  heatCount,
  onLabelChange,
  onDurationChange,
  onPositionChange,
  onSubmit,
}: BreakFormProps) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-3">
      <h4 className="mb-2 mt-0 font-semibold">Add Break</h4>
      <div className="flex gap-2 flex-wrap items-end">
        <div>
          <label className="block text-sm mb-1">Label *</label>
          <input
            type="text"
            value={breakLabel}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="e.g. Lunch Break"
            className="px-3 py-1.5 rounded border border-gray-200 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Duration (min)</label>
          <input
            type="number"
            value={breakDuration}
            onChange={(e) => onDurationChange(e.target.value ? parseInt(e.target.value) : '')}
            placeholder="Optional"
            min={1}
            className="w-20 px-3 py-1.5 rounded border border-gray-200 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Position</label>
          <select
            value={breakPosition}
            onChange={(e) => onPositionChange(parseInt(e.target.value))}
            className="px-3 py-1.5 rounded border border-gray-200 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          >
            {Array.from({ length: heatCount + 1 }, (_, i) => (
              <option key={i} value={i}>
                {i === 0 ? 'At the beginning' : i >= heatCount ? 'At the end' : `Position ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
        <button
          className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 disabled:opacity-50"
          onClick={onSubmit}
          disabled={!breakLabel.trim()}
        >
          Insert Break
        </button>
      </div>
    </div>
  );
}
