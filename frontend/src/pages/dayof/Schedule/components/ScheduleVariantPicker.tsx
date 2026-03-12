import { useState } from 'react';
import { ScheduleVariant } from '../../../../types';

interface ScheduleVariantPickerProps {
  variants: ScheduleVariant[];
  applying: boolean;
  onSelect: (variantId: string) => void;
  onCancel: () => void;
}

export default function ScheduleVariantPicker({
  variants,
  applying,
  onSelect,
  onCancel,
}: ScheduleVariantPickerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800">Choose a Schedule Variant</h3>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded border border-gray-200 text-sm cursor-pointer hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
      <p className="text-gray-500 text-sm mb-4">
        Each option has the same events but different break placements and judge rotation patterns. Select one to apply.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        {variants.map(variant => {
          const isSelected = selectedId === variant.id;
          return (
            <div
              key={variant.id}
              onClick={() => setSelectedId(variant.id)}
              className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                isSelected
                  ? 'border-primary-500 bg-primary-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <h4 className="font-semibold text-gray-800 mb-1">{variant.label}</h4>
              <p className="text-gray-500 text-xs mb-3">{variant.description}</p>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700 mb-3">
                <span>{variant.stats.totalHeats} heats</span>
                <span>{variant.stats.estimatedDurationMinutes}min total</span>
                <span>{variant.stats.breakCount} breaks</span>
                {variant.stats.lunchPlacement && (
                  <span>Lunch: {variant.stats.lunchPlacement}</span>
                )}
              </div>

              <div className="border-t border-gray-100 pt-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Per Judge</span>
                <div className="mt-1 flex flex-col gap-1">
                  {variant.stats.judgeStats.map(js => (
                    <div key={js.judgeId} className="flex items-center gap-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded font-semibold ${
                        js.judgeRole === 'fill-in'
                          ? 'bg-teal-100 text-teal-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {js.judgeRole === 'fill-in' ? 'Fill-in' : 'Main'}
                      </span>
                      <span className="text-gray-600 truncate flex-1">{js.judgeName}</span>
                      <span className="text-gray-500">{js.workMinutes}min</span>
                      <span className="text-gray-400" title="Longest continuous session">
                        (max {js.longestSessionMinutes}m)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedId && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onSelect(selectedId)}
            disabled={applying}
            className="px-6 py-2.5 bg-primary-500 text-white rounded border-none text-sm font-medium transition-colors hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {applying && (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {applying ? 'Applying...' : 'Apply Selected Schedule'}
          </button>
        </div>
      )}
    </div>
  );
}
