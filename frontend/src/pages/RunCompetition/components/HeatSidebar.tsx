import { Event, CompetitionSchedule } from '../../../types';
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
    <div className="card" style={{ alignSelf: 'start', maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
      <h3 style={{ marginBottom: '0.75rem' }}>All Heats</h3>
      {schedule.heatOrder.map((scheduledHeat, idx) => {
        const isBreak = scheduledHeat.isBreak;
        const status = schedule.heatStatuses[scheduledHeat.id] || 'pending';
        const isCurrent = idx === schedule.currentHeatIndex;

        return (
          <div
            key={scheduledHeat.id + '-' + idx}
            onClick={() => onJump(idx)}
            style={{
              padding: '0.5rem',
              marginBottom: '0.25rem',
              borderRadius: '4px',
              cursor: 'pointer',
              background: isCurrent ? '#ebf8ff' : isBreak ? '#fefce8' : 'transparent',
              border: isCurrent ? '1px solid #90cdf4' : '1px solid transparent',
              transition: 'background 0.15s',
            }}
            onMouseOver={(e) => { if (!isCurrent) e.currentTarget.style.background = isBreak ? '#fef9c3' : '#f7fafc'; }}
            onMouseOut={(e) => { if (!isCurrent) e.currentTarget.style.background = isCurrent ? '#ebf8ff' : isBreak ? '#fefce8' : 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: statusColor(status) === '#c6f6d5' ? '#276749' : '#718096' }}>
                {statusIcon(status)}
              </span>
              <span style={{
                fontSize: '0.8rem',
                fontWeight: isCurrent ? 600 : 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontStyle: isBreak ? 'italic' : undefined,
                flex: 1,
              }}>
                {idx + 1}. {isBreak
                  ? (scheduledHeat.breakLabel || 'Break')
                  : `${getHeatLabel(scheduledHeat, events)} (${getHeatRound(scheduledHeat)})`}
                {scheduledHeat.estimatedStartTime && (
                  <span style={{ color: '#a0aec0', fontSize: '0.7rem', marginLeft: '0.25rem' }}>
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
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.125rem 0.25rem',
                    fontSize: '0.7rem',
                    color: '#e53e3e',
                    opacity: 0.6,
                    flexShrink: 0,
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; }}
                  onMouseOut={(e) => { e.currentTarget.style.opacity = '0.6'; }}
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
