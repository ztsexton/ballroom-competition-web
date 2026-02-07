import { CoupleInfo } from '../types';

const RankingForm = ({
  couples,
  scores,
  onChange,
  isProAm,
}: {
  couples: CoupleInfo[];
  scores: Record<number, number>;
  onChange: (bib: number, value: string) => void;
  isProAm?: boolean;
}) => {
  const rankCounts: Record<number, number> = {};
  Object.values(scores).forEach(r => {
    if (r >= 1) rankCounts[r] = (rankCounts[r] || 0) + 1;
  });

  return (
    <div>
      <p style={{ fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>
        Rank each couple (1 = best, {couples.length} = last):
      </p>
      {couples.map(couple => {
        const rank = scores[couple.bib];
        const isDuplicate = rank >= 1 && rankCounts[rank] > 1;
        return (
          <div
            key={couple.bib}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.625rem',
              marginBottom: '0.3125rem',
              borderRadius: '6px',
              border: isDuplicate ? '2px solid #e53e3e' : `1px solid ${isProAm ? '#fcd34d' : '#e2e8f0'}`,
              borderLeft: isProAm && !isDuplicate ? '3px solid #f59e0b' : undefined,
              background: isDuplicate ? '#fff5f5' : isProAm ? '#fffbeb' : '#fff',
              minHeight: '44px',
            }}
          >
            <strong style={{ fontSize: '1.0625rem', flex: 1 }}>#{couple.bib}</strong>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={rank || ''}
              onChange={(e) => onChange(couple.bib, e.target.value)}
              style={{
                width: '52px',
                height: '40px',
                textAlign: 'center',
                padding: '0.125rem',
                border: isDuplicate ? '2px solid #e53e3e' : '2px solid #cbd5e0',
                borderRadius: '6px',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: isDuplicate ? '#e53e3e' : '#2d3748',
                touchAction: 'manipulation',
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

export default RankingForm;
