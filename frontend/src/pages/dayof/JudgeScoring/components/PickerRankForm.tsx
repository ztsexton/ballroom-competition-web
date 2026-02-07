import { CoupleInfo } from '../types';

const PickerRankForm = ({
  couples,
  scores,
  onScoresChange,
  isProAm,
}: {
  couples: CoupleInfo[];
  scores: Record<number, number>;
  onScoresChange: (scores: Record<number, number>) => void;
  isProAm?: boolean;
}) => {
  const coupleCount = couples.length;
  const rankOptions = Array.from({ length: coupleCount }, (_, i) => i + 1);

  // Which ranks are already used, and by which bib
  const rankToBib: Record<number, number> = {};
  for (const c of couples) {
    const r = scores[c.bib];
    if (r >= 1 && r <= coupleCount) {
      rankToBib[r] = c.bib;
    }
  }

  const allRanked = Object.keys(rankToBib).length === coupleCount;

  const handlePickRank = (bib: number, rank: number) => {
    const currentRank = scores[bib];
    // If tapping the same rank, deselect it
    if (currentRank === rank) {
      onScoresChange({ ...scores, [bib]: 0 });
      return;
    }
    const updated = { ...scores };
    // If another couple has this rank, clear them
    if (rankToBib[rank] !== undefined && rankToBib[rank] !== bib) {
      updated[rankToBib[rank]] = 0;
    }
    updated[bib] = rank;
    onScoresChange(updated);
  };

  const handleClearAll = () => {
    const cleared: Record<number, number> = {};
    couples.forEach(c => { cleared[c.bib] = 0; });
    onScoresChange(cleared);
  };

  return (
    <div>
      {/* Progress header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
        <p style={{ fontWeight: 600, margin: 0, fontSize: '0.875rem' }}>
          Pick a rank for each couple (1 = best):
        </p>
        <span style={{
          padding: '0.125rem 0.375rem',
          background: allRanked ? '#c6f6d5' : '#fefcbf',
          borderRadius: '4px',
          fontSize: '0.8125rem',
          fontWeight: 600,
        }}>
          {Object.keys(rankToBib).length} / {coupleCount}
        </span>
      </div>

      {couples.map(couple => {
        const currentRank = scores[couple.bib];
        const hasRank = currentRank >= 1 && currentRank <= coupleCount;
        return (
          <div
            key={couple.bib}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.375rem 0.5rem',
              marginBottom: '0.3125rem',
              borderRadius: '6px',
              border: hasRank ? '2px solid #667eea' : `1px solid ${isProAm ? '#fcd34d' : '#e2e8f0'}`,
              borderLeft: isProAm && !hasRank ? '3px solid #f59e0b' : undefined,
              background: hasRank ? '#eef2ff' : isProAm ? '#fffbeb' : '#fff',
              minHeight: '44px',
            }}
          >
            <strong style={{ fontSize: '1.0625rem', flexShrink: 0, minWidth: '36px' }}>#{couple.bib}</strong>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.25rem',
              flex: 1,
              justifyContent: 'flex-end',
            }}>
              {rankOptions.map(rank => {
                const isSelected = currentRank === rank;
                const isUsedByOther = rankToBib[rank] !== undefined && rankToBib[rank] !== couple.bib;
                return (
                  <button
                    key={rank}
                    onClick={() => handlePickRank(couple.bib, rank)}
                    style={{
                      width: '36px',
                      height: '36px',
                      border: isSelected
                        ? '2px solid #667eea'
                        : isUsedByOther
                          ? '1px solid #e2e8f0'
                          : '1px solid #cbd5e0',
                      borderRadius: '6px',
                      background: isSelected
                        ? '#667eea'
                        : isUsedByOther
                          ? '#f7fafc'
                          : '#fff',
                      color: isSelected
                        ? 'white'
                        : isUsedByOther
                          ? '#cbd5e0'
                          : '#2d3748',
                      fontSize: '1rem',
                      fontWeight: 700,
                      cursor: isUsedByOther ? 'default' : 'pointer',
                      opacity: isUsedByOther ? 0.5 : 1,
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                      transition: 'all 0.1s',
                      padding: 0,
                    }}
                  >
                    {rank}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Clear all button */}
      {Object.keys(rankToBib).length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          <button
            onClick={handleClearAll}
            style={{
              padding: '0.5rem 1rem',
              background: 'transparent',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              color: '#a0aec0',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              touchAction: 'manipulation',
            }}
          >
            Reset Rankings
          </button>
        </div>
      )}
    </div>
  );
};

export default PickerRankForm;
