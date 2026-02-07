import { CoupleInfo } from '../types';

const RecallForm = ({
  couples,
  scores,
  onToggle,
  isProAm,
  maxRecalls,
}: {
  couples: CoupleInfo[];
  scores: Record<number, number>;
  onToggle: (bib: number) => void;
  isProAm?: boolean;
  maxRecalls?: number;
}) => {
  const recallCount = Object.values(scores).filter(v => v === 1).length;
  const atLimit = maxRecalls !== undefined && recallCount >= maxRecalls;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
        <p style={{ fontWeight: 600, margin: 0, fontSize: '0.875rem' }}>
          {maxRecalls !== undefined ? `Select ${maxRecalls} to recall:` : 'Select couples to recall:'}
        </p>
        <span style={{
          padding: '0.125rem 0.375rem',
          background: maxRecalls !== undefined
            ? (recallCount === maxRecalls ? '#c6f6d5' : recallCount > maxRecalls ? '#fed7d7' : '#fefcbf')
            : (recallCount > 0 ? '#c6f6d5' : '#e2e8f0'),
          borderRadius: '4px',
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: maxRecalls !== undefined && recallCount > maxRecalls ? '#9b2c2c' : undefined,
        }}>
          {recallCount}{maxRecalls !== undefined ? ` / ${maxRecalls}` : ` / ${couples.length}`}
        </span>
      </div>
      {couples.map(couple => {
        const selected = scores[couple.bib] === 1;
        const disabled = !selected && atLimit;
        return (
          <div
            key={couple.bib}
            onClick={() => {
              if (disabled) return;
              onToggle(couple.bib);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.625rem',
              marginBottom: '0.3125rem',
              borderRadius: '6px',
              border: selected ? '2px solid #48bb78' : `1px solid ${isProAm ? '#fcd34d' : '#e2e8f0'}`,
              borderLeft: isProAm && !selected ? '3px solid #f59e0b' : undefined,
              background: selected ? '#f0fff4' : disabled ? '#f7fafc' : isProAm ? '#fffbeb' : '#fff',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              transition: 'all 0.15s',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
              minHeight: '44px',
            }}
          >
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '5px',
              border: selected ? '2px solid #48bb78' : '2px solid #cbd5e0',
              background: selected ? '#48bb78' : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.875rem',
              flexShrink: 0,
              transition: 'all 0.15s',
            }}>
              {selected ? '\u2713' : ''}
            </div>
            <strong style={{ fontSize: '1.0625rem' }}>#{couple.bib}</strong>
          </div>
        );
      })}
    </div>
  );
};

export default RecallForm;
