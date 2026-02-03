import { CompetitionSchedule, Event } from '../../../types';
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
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '8px',
        maxWidth: '520px',
        width: '90%',
      }}>
        <h3 style={{ color: '#e53e3e', marginTop: 0, marginBottom: '0.5rem' }}>
          Reset: {targetLabel}
        </h3>
        <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Choose how to handle this heat. Scores will be permanently cleared.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button
            className="btn"
            style={{ background: '#dd6b20', borderColor: '#dd6b20', textAlign: 'left', padding: '0.75rem 1rem' }}
            onClick={onRerun}
          >
            <strong>Re-run this heat only</strong>
            <br />
            <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
              Clear scores for this heat and jump to it. All other results are kept.
            </span>
          </button>

          {heatsAffected > 0 && (
            <button
              className="btn"
              style={{ background: '#e53e3e', borderColor: '#e53e3e', textAlign: 'left', padding: '0.75rem 1rem' }}
              onClick={onReset}
            >
              <strong>Reset to this heat</strong>
              <br />
              <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                Clear scores for this heat and the {heatsAffected} heat{heatsAffected !== 1 ? 's' : ''} after
                it (through the current position). Earlier results are kept.
              </span>
            </button>
          )}
        </div>

        <button
          className="btn btn-secondary"
          onClick={onCancel}
          style={{ width: '100%' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
