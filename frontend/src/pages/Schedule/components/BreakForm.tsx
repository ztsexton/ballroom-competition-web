import React from 'react';

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
    <div style={{
      background: '#f7fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      padding: '1rem',
      marginTop: '0.75rem',
    }}>
      <h4 style={{ marginBottom: '0.5rem', marginTop: 0 }}>Add Break</h4>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Label *</label>
          <input
            type="text"
            value={breakLabel}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="e.g. Lunch Break"
            style={{ padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Duration (min)</label>
          <input
            type="number"
            value={breakDuration}
            onChange={(e) => onDurationChange(e.target.value ? parseInt(e.target.value) : '')}
            placeholder="Optional"
            min={1}
            style={{ width: '5rem', padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Position</label>
          <select
            value={breakPosition}
            onChange={(e) => onPositionChange(parseInt(e.target.value))}
            style={{ padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}
          >
            {Array.from({ length: heatCount + 1 }, (_, i) => (
              <option key={i} value={i}>
                {i === 0 ? 'At the beginning' : i >= heatCount ? 'At the end' : `Position ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
        <button className="btn" onClick={onSubmit} disabled={!breakLabel.trim()}>
          Insert Break
        </button>
      </div>
    </div>
  );
}
