import { Event, CompetitionSchedule } from '../../../../types';
import { getHeatLabel, getHeatRound } from '../utils';

interface UnscheduledEventsBannerProps {
  unscheduledEvents: Event[];
  suggestedPositions: Record<number, number>;
  customPositions: Record<number, number>;
  schedule: CompetitionSchedule;
  events: Event[];
  onCustomPositionChange: (eventId: number, position: number) => void;
  onInsertEvent: (eventId: number, position: number) => void;
}

export default function UnscheduledEventsBanner({
  unscheduledEvents,
  suggestedPositions,
  customPositions,
  schedule,
  events,
  onCustomPositionChange,
  onInsertEvent,
}: UnscheduledEventsBannerProps) {
  if (unscheduledEvents.length === 0) return null;

  return (
    <div className="bg-amber-100 border border-amber-500 rounded-lg p-4 mt-4">
      <h3 className="mb-2 text-amber-800">
        {unscheduledEvents.length} New Event{unscheduledEvents.length > 1 ? 's' : ''} Not in Schedule
      </h3>
      <p className="text-amber-900 text-sm mb-3">
        These events were added after the schedule was generated. Choose where to insert each one.
      </p>
      {unscheduledEvents.map(event => {
        const suggested = suggestedPositions[event.id] ?? schedule.heatOrder.length;
        const current = customPositions[event.id] ?? suggested;
        const positionLabel = (pos: number) => {
          if (pos === 0) return 'At the beginning';
          if (pos >= schedule.heatOrder.length) return 'At the end';
          const afterHeat = schedule.heatOrder[pos - 1];
          const afterLabel = getHeatLabel(afterHeat, events);
          const afterRound = getHeatRound(afterHeat);
          return `Position ${pos + 1} (after ${afterLabel} ${afterRound})`;
        };

        return (
          <div key={event.id} className="bg-white border border-gray-200 rounded p-3 mb-2">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <strong>{event.name}</strong>
                <span className="text-gray-500 text-sm ml-2">
                  {[event.style, event.level].filter(Boolean).join(' - ')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={current}
                  onChange={(e) => onCustomPositionChange(event.id, parseInt(e.target.value))}
                  className="p-1.5 rounded border border-gray-200"
                >
                  {Array.from({ length: schedule.heatOrder.length + 1 }, (_, i) => (
                    <option key={i} value={i}>
                      {positionLabel(i)}{i === suggested ? ' (suggested)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  className="px-3 py-1.5 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600"
                  onClick={() => onInsertEvent(event.id, current)}
                >
                  Insert
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
