import { CompetitionSchedule, Event } from '../../../../types';
import { getHeatLabel, getHeatRound } from '../utils';

interface ResetModalProps {
  schedule: CompetitionSchedule;
  events: Record<number, Event>;
  targetIndex: number;
  onRerun: () => void;
  onReset: () => void;
  onCancel: () => void;
}

export default function ResetModal({
  schedule,
  events,
  targetIndex,
  onRerun,
  onReset,
  onCancel,
}: ResetModalProps) {
  const targetHeat = schedule.heatOrder[targetIndex];
  const targetLabel = targetHeat?.isBreak
    ? (targetHeat.breakLabel || 'Break')
    : getHeatLabel(targetHeat, events) + ` (${getHeatRound(targetHeat)})`;
  const heatsAffected = Math.max(0, schedule.currentHeatIndex - targetIndex);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
      <div className="bg-white p-8 rounded-lg max-w-[520px] w-[90%]">
        <h3 className="text-danger-500 mt-0 mb-2 font-semibold">
          Reset: {targetLabel}
        </h3>
        <p className="text-gray-500 text-sm mb-6">
          Choose how to handle this heat. Scores will be permanently cleared.
        </p>

        <div className="flex flex-col gap-3 mb-6">
          <button
            className="bg-orange-600 text-white rounded border-none cursor-pointer text-left px-4 py-3 transition-colors hover:bg-orange-700"
            onClick={onRerun}
          >
            <strong>Re-run this heat only</strong>
            <br />
            <span className="text-xs opacity-90">
              Clear scores for this heat and jump to it. All other results are kept.
            </span>
          </button>

          {heatsAffected > 0 && (
            <button
              className="bg-danger-500 text-white rounded border-none cursor-pointer text-left px-4 py-3 transition-colors hover:bg-danger-600"
              onClick={onReset}
            >
              <strong>Reset to this heat</strong>
              <br />
              <span className="text-xs opacity-90">
                Clear scores for this heat and the {heatsAffected} heat{heatsAffected !== 1 ? 's' : ''} after
                it (through the current position). Earlier results are kept.
              </span>
            </button>
          )}
        </div>

        <button
          className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
