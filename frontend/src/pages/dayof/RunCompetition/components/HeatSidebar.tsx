import { Event, CompetitionSchedule } from '../../../../types';
import { formatTime, statusColor, statusIcon, getHeatLabel, getHeatRound } from '../utils';

interface HeatSidebarProps {
  schedule: CompetitionSchedule;
  events: Record<number, Event>;
  onJump: (heatIndex: number) => void;
  onResetRequest: (heatIndex: number) => void;
}

export default function HeatSidebar({
  schedule,
  events,
  onJump,
  onResetRequest,
}: HeatSidebarProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6 self-start max-h-[80vh] overflow-y-auto relative">
      <h3 className="mb-3 font-semibold">All Heats</h3>
      {schedule.heatOrder.map((scheduledHeat, idx) => {
        const isBreak = scheduledHeat.isBreak;
        const status = schedule.heatStatuses[scheduledHeat.id] || 'pending';
        const isCurrent = idx === schedule.currentHeatIndex;

        return (
          <div
            key={scheduledHeat.id + '-' + idx}
            onClick={() => onJump(idx)}
            className={`p-2 mb-1 rounded cursor-pointer transition-colors ${
              isCurrent
                ? 'bg-blue-50 border border-blue-300'
                : isBreak
                  ? 'bg-yellow-50 border border-transparent hover:bg-yellow-100'
                  : 'border border-transparent hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={statusColor(status) === '#c6f6d5' ? 'text-green-800' : 'text-gray-500'}>
                {statusIcon(status)}
              </span>
              <span className={`text-xs overflow-hidden text-ellipsis whitespace-nowrap flex-1 ${isCurrent ? 'font-semibold' : ''} ${isBreak ? 'italic' : ''}`}>
                {idx + 1}. {isBreak
                  ? (scheduledHeat.breakLabel || 'Break')
                  : `${getHeatLabel(scheduledHeat, events)} (${getHeatRound(scheduledHeat)})`}
                {scheduledHeat.estimatedStartTime && (
                  <span className="text-gray-400 text-[0.7rem] ml-1">
                    {formatTime(scheduledHeat.estimatedStartTime)}
                  </span>
                )}
              </span>
              {(status === 'completed' || status === 'scoring') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onResetRequest(idx);
                  }}
                  title="Reset to this heat"
                  className="bg-transparent border-none cursor-pointer p-0.5 text-[0.7rem] text-danger-500 opacity-60 hover:opacity-100 shrink-0"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
