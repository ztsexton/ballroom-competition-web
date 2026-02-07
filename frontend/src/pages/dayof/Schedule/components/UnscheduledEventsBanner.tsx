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
    <div style={{
      background: '#fef3c7',
      border: '1px solid #f59e0b',
      borderRadius: '8px',
      padding: '1rem',
      marginTop: '1rem',
    }}>
      <h3 style={{ marginBottom: '0.5rem', color: '#92400e' }}>
        {unscheduledEvents.length} New Event{unscheduledEvents.length > 1 ? 's' : ''} Not in Schedule
      </h3>
      <p style={{ color: '#78350f', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
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
          <div key={event.id} style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
            padding: '0.75rem',
            marginBottom: '0.5rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <strong>{event.name}</strong>
                <span style={{ color: '#718096', fontSize: '0.875rem', marginLeft: '0.5rem' }}>
                  {[event.style, event.level].filter(Boolean).join(' - ')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <select
                  value={current}
                  onChange={(e) => onCustomPositionChange(event.id, parseInt(e.target.value))}
                  style={{ padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                >
                  {Array.from({ length: schedule.heatOrder.length + 1 }, (_, i) => (
                    <option key={i} value={i}>
                      {positionLabel(i)}{i === suggested ? ' (suggested)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  className="btn"
                  style={{ fontSize: '0.875rem', padding: '0.375rem 0.75rem' }}
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
