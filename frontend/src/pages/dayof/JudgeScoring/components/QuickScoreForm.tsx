import { CoupleInfo } from '../types';

const SCORE_PRESETS = [60, 65, 70, 75, 80, 85, 90, 95];

const QuickScoreForm = ({
  couples,
  scores,
  onChange,
  isProAm,
}: {
  couples: CoupleInfo[];
  scores: Record<number, number>;
  onChange: (bib: number, value: string) => void;
  isProAm?: boolean;
}) => (
  <div>
    <p style={{ fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>
      Score each couple (0-100):
    </p>
    {couples.map(couple => {
      const score = scores[couple.bib] || 0;
      return (
        <div
          key={couple.bib}
          style={{
            padding: '0.5rem 0.625rem',
            marginBottom: '0.375rem',
            borderRadius: '6px',
            border: `1px solid ${isProAm ? '#fcd34d' : '#e2e8f0'}`,
            borderLeft: isProAm ? '3px solid #f59e0b' : undefined,
            background: isProAm ? '#fffbeb' : '#fff',
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.375rem',
          }}>
            <strong style={{ fontSize: '1.0625rem' }}>#{couple.bib}</strong>
            <span style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: score > 0 ? '#2d3748' : '#cbd5e0',
              minWidth: '40px',
              textAlign: 'right',
            }}>
              {score > 0 ? score : '--'}
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.25rem',
            marginBottom: '0.3125rem',
          }}>
            {SCORE_PRESETS.map(preset => {
              const isActive = score === preset;
              return (
                <button
                  key={preset}
                  onClick={() => onChange(couple.bib, String(preset))}
                  style={{
                    minHeight: '36px',
                    border: isActive ? '2px solid #667eea' : '1px solid #e2e8f0',
                    borderRadius: '6px',
                    background: isActive ? '#667eea' : '#f7fafc',
                    color: isActive ? 'white' : '#2d3748',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {preset}
                </button>
              );
            })}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
          }}>
            <button
              onClick={() => onChange(couple.bib, String(Math.max(0, score - 1)))}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: '1px solid #e2e8f0',
                background: '#f7fafc',
                fontSize: '1.125rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                color: '#4a5568',
              }}
            >
              -
            </button>
            <span style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: '#718096',
              minWidth: '30px',
              textAlign: 'center',
            }}>
              {score > 0 ? score : '--'}
            </span>
            <button
              onClick={() => onChange(couple.bib, String(Math.min(100, score + 1)))}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: '1px solid #e2e8f0',
                background: '#f7fafc',
                fontSize: '1.125rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                color: '#4a5568',
              }}
            >
              +
            </button>
          </div>
        </div>
      );
    })}
  </div>
);

export default QuickScoreForm;
