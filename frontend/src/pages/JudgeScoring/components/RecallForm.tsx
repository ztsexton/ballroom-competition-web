import { CoupleInfo } from '../types';

const RecallForm = ({
  couples,
  scores,
  onToggle,
  isProAm,
}: {
  couples: CoupleInfo[];
  scores: Record<number, number>;
  onToggle: (bib: number) => void;
  isProAm?: boolean;
}) => {
  const recallCount = Object.values(scores).filter(v => v === 1).length;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
        <p style={{ fontWeight: 600, margin: 0, fontSize: '0.875rem' }}>Select couples to recall:</p>
        <span style={{
          padding: '0.125rem 0.375rem',
          background: recallCount > 0 ? '#c6f6d5' : '#e2e8f0',
          borderRadius: '4px',
          fontSize: '0.8125rem',
          fontWeight: 600,
        }}>
          {recallCount} / {couples.length}
        </span>
      </div>
      {couples.map(couple => {
        const selected = scores[couple.bib] === 1;
        return (
          <div
            key={couple.bib}
            onClick={() => onToggle(couple.bib)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.625rem',
              marginBottom: '0.3125rem',
              borderRadius: '6px',
              border: selected ? '2px solid #48bb78' : `1px solid ${isProAm ? '#fcd34d' : '#e2e8f0'}`,
              borderLeft: isProAm && !selected ? '3px solid #f59e0b' : undefined,
              background: selected ? '#f0fff4' : isProAm ? '#fffbeb' : '#fff',
              cursor: 'pointer',
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
              {selected ? '✓' : ''}
            </div>
            <strong style={{ fontSize: '1.0625rem' }}>#{couple.bib}</strong>
          </div>
        );
      })}
    </div>
  );
};

export default RecallForm;
