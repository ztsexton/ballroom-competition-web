import { JudgeSettings, TimingSettings } from '../../../../types';
import { moveItem } from '../utils';

interface ScheduleConfigFormProps {
  styleOrder: string[];
  levelOrder: string[];
  judgeSettings: JudgeSettings;
  timingSettings: TimingSettings;
  eventCount: number;
  onStyleOrderChange: (order: string[]) => void;
  onLevelOrderChange: (order: string[]) => void;
  onJudgeSettingsChange: (settings: JudgeSettings) => void;
  onTimingSettingsChange: (fn: (prev: TimingSettings) => TimingSettings) => void;
  onGenerate: () => void;
}

export default function ScheduleConfigForm({
  styleOrder,
  levelOrder,
  judgeSettings,
  timingSettings,
  eventCount,
  onStyleOrderChange,
  onLevelOrderChange,
  onJudgeSettingsChange,
  onTimingSettingsChange,
  onGenerate,
}: ScheduleConfigFormProps) {
  return (
    <>
      <div style={{ marginTop: '1.5rem' }}>
        <h3>Style Order</h3>
        <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
          Events are grouped by style first. Use arrows to set priority.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '300px' }}>
          {styleOrder.map((style, idx) => (
            <div key={style} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem',
              background: '#f7fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
            }}>
              <span style={{ fontWeight: 600, minWidth: '1.5rem' }}>{idx + 1}.</span>
              <span style={{ flex: 1 }}>{style}</span>
              <button
                onClick={() => onStyleOrderChange(moveItem(styleOrder, idx, 'up'))}
                disabled={idx === 0}
                style={{ padding: '0.125rem 0.375rem', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1 }}
              >
                ▲
              </button>
              <button
                onClick={() => onStyleOrderChange(moveItem(styleOrder, idx, 'down'))}
                disabled={idx === styleOrder.length - 1}
                style={{ padding: '0.125rem 0.375rem', cursor: idx === styleOrder.length - 1 ? 'default' : 'pointer', opacity: idx === styleOrder.length - 1 ? 0.3 : 1 }}
              >
                ▼
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <h3>Level Order</h3>
        <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
          Within each style, events are sorted by level.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '300px' }}>
          {levelOrder.map((level, idx) => (
            <div key={level} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem',
              background: '#f7fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
            }}>
              <span style={{ fontWeight: 600, minWidth: '1.5rem' }}>{idx + 1}.</span>
              <span style={{ flex: 1 }}>{level}</span>
              <button
                onClick={() => onLevelOrderChange(moveItem(levelOrder, idx, 'up'))}
                disabled={idx === 0}
                style={{ padding: '0.125rem 0.375rem', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1 }}
              >
                ▲
              </button>
              <button
                onClick={() => onLevelOrderChange(moveItem(levelOrder, idx, 'down'))}
                disabled={idx === levelOrder.length - 1}
                style={{ padding: '0.125rem 0.375rem', cursor: idx === levelOrder.length - 1 ? 'default' : 'pointer', opacity: idx === levelOrder.length - 1 ? 0.3 : 1 }}
              >
                ▼
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <h3>Judge Assignment</h3>
        <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
          Judges are automatically rotated across heats. Set the number required per level.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '300px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label style={{ flex: 1, fontWeight: 600 }}>Default count</label>
            <input
              type="number"
              min={1}
              value={judgeSettings.defaultCount}
              onChange={(e) => onJudgeSettingsChange({ ...judgeSettings, defaultCount: Math.max(1, parseInt(e.target.value) || 1) })}
              style={{ width: '4rem', padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0', textAlign: 'center' }}
            />
          </div>
          {levelOrder.map(level => (
            <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label style={{ flex: 1, color: '#4a5568' }}>{level}</label>
              <input
                type="number"
                min={1}
                placeholder={String(judgeSettings.defaultCount)}
                value={judgeSettings.levelOverrides[level] ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const overrides = { ...judgeSettings.levelOverrides };
                  if (val === '' || parseInt(val) === judgeSettings.defaultCount) {
                    delete overrides[level];
                  } else {
                    overrides[level] = Math.max(1, parseInt(val) || 1);
                  }
                  onJudgeSettingsChange({ ...judgeSettings, levelOverrides: overrides });
                }}
                style={{ width: '4rem', padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0', textAlign: 'center' }}
              />
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <h3>Timing Settings</h3>
        <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
          Configure dance durations and transition times to estimate the schedule timeline.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '400px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label style={{ flex: 1, fontWeight: 600 }}>Start time</label>
            <input
              type="datetime-local"
              value={timingSettings.startTime || ''}
              onChange={(e) => onTimingSettingsChange(prev => ({ ...prev, startTime: e.target.value || undefined }))}
              style={{ padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label style={{ flex: 1, fontWeight: 600 }}>Default dance duration (sec)</label>
            <input
              type="number"
              min={1}
              value={timingSettings.defaultDanceDurationSeconds}
              onChange={(e) => onTimingSettingsChange(prev => ({ ...prev, defaultDanceDurationSeconds: Math.max(1, parseInt(e.target.value) || 75) }))}
              style={{ width: '5rem', padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0', textAlign: 'center' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label style={{ flex: 1, fontWeight: 600 }}>Scholarship duration (sec)</label>
            <input
              type="number"
              min={1}
              placeholder="90"
              value={timingSettings.scholarshipDurationSeconds ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                onTimingSettingsChange(prev => ({
                  ...prev,
                  scholarshipDurationSeconds: val === '' ? undefined : Math.max(1, parseInt(val) || 90),
                }));
              }}
              style={{ width: '5rem', padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0', textAlign: 'center' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label style={{ flex: 1, fontWeight: 600 }}>Between dances (sec)</label>
            <input
              type="number"
              min={0}
              value={timingSettings.betweenDanceSeconds}
              onChange={(e) => onTimingSettingsChange(prev => ({ ...prev, betweenDanceSeconds: Math.max(0, parseInt(e.target.value) || 0) }))}
              style={{ width: '5rem', padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0', textAlign: 'center' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label style={{ flex: 1, fontWeight: 600 }}>Between heats (sec)</label>
            <input
              type="number"
              min={0}
              value={timingSettings.betweenHeatSeconds}
              onChange={(e) => onTimingSettingsChange(prev => ({ ...prev, betweenHeatSeconds: Math.max(0, parseInt(e.target.value) || 0) }))}
              style={{ width: '5rem', padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0', textAlign: 'center' }}
            />
          </div>
          <div style={{ marginTop: '0.25rem' }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.375rem' }}>Duration overrides by level (sec)</label>
            {levelOrder.map(level => (
              <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                <label style={{ flex: 1, color: '#4a5568' }}>{level}</label>
                <input
                  type="number"
                  min={1}
                  placeholder={String(timingSettings.defaultDanceDurationSeconds)}
                  value={timingSettings.levelDurationOverrides?.[level] ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    onTimingSettingsChange(prev => {
                      const overrides = { ...prev.levelDurationOverrides };
                      if (val === '' || parseInt(val) === prev.defaultDanceDurationSeconds) {
                        delete overrides[level];
                      } else {
                        overrides[level] = Math.max(1, parseInt(val) || 1);
                      }
                      return { ...prev, levelDurationOverrides: Object.keys(overrides).length > 0 ? overrides : undefined };
                    });
                  }}
                  style={{ width: '5rem', padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0', textAlign: 'center' }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <button className="btn" onClick={onGenerate}>
          Generate Schedule ({eventCount} events)
        </button>
      </div>
    </>
  );
}
