import React from 'react';
import { CoupleInfo } from '../types';

const TapToRankForm = ({
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
  // Derive ranked and unranked lists from scores
  const ranked = couples
    .filter(c => scores[c.bib] > 0)
    .sort((a, b) => scores[a.bib] - scores[b.bib]);
  const unranked = couples.filter(c => !scores[c.bib] || scores[c.bib] === 0);
  const allRanked = ranked.length === couples.length;

  const handleTapToRank = (bib: number) => {
    const maxRank = Math.max(0, ...Object.values(scores).filter(v => v > 0));
    onScoresChange({ ...scores, [bib]: maxRank + 1 });
  };

  const handleRemoveRank = (bib: number) => {
    const removedRank = scores[bib];
    const updated: Record<number, number> = {};
    for (const [b, r] of Object.entries(scores)) {
      const bibNum = parseInt(b);
      if (bibNum === bib) {
        updated[bibNum] = 0;
      } else if (r > removedRank) {
        updated[bibNum] = r - 1;
      } else {
        updated[bibNum] = r;
      }
    }
    onScoresChange(updated);
  };

  const handleMoveUp = (bib: number) => {
    const rank = scores[bib];
    if (rank <= 1) return;
    const swapBib = couples.find(c => scores[c.bib] === rank - 1)?.bib;
    if (swapBib === undefined) return;
    onScoresChange({ ...scores, [bib]: rank - 1, [swapBib]: rank });
  };

  const handleMoveDown = (bib: number) => {
    const rank = scores[bib];
    const maxRank = Math.max(0, ...Object.values(scores).filter(v => v > 0));
    if (rank >= maxRank) return;
    const swapBib = couples.find(c => scores[c.bib] === rank + 1)?.bib;
    if (swapBib === undefined) return;
    onScoresChange({ ...scores, [bib]: rank + 1, [swapBib]: rank });
  };

  const handleClearAll = () => {
    const cleared: Record<number, number> = {};
    couples.forEach(c => { cleared[c.bib] = 0; });
    onScoresChange(cleared);
  };

  const rowBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.4375rem 0.625rem',
    marginBottom: '0.3125rem',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '0.9375rem',
    minHeight: '44px',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none',
  };

  return (
    <div>
      {/* Progress header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
        <p style={{ fontWeight: 600, margin: 0, fontSize: '0.875rem' }}>Tap couples in placement order:</p>
        <span style={{
          padding: '0.125rem 0.375rem',
          background: allRanked ? '#c6f6d5' : '#fefcbf',
          borderRadius: '4px',
          fontSize: '0.8125rem',
          fontWeight: 600,
        }}>
          {ranked.length} / {couples.length}
        </span>
      </div>

      {/* Ranked section */}
      {ranked.length > 0 && (
        <div style={{ marginBottom: unranked.length > 0 ? '0.5rem' : 0 }}>
          {ranked.map(couple => {
            const rank = scores[couple.bib];
            const maxRank = Math.max(0, ...Object.values(scores).filter(v => v > 0));
            const canMoveUp = rank > 1;
            const canMoveDown = rank < maxRank;
            const arrowBtn: React.CSSProperties = {
              width: '28px',
              height: '28px',
              borderRadius: '4px',
              border: '1px solid #c3cfea',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              padding: 0,
              color: '#667eea',
            };
            return (
              <div
                key={couple.bib}
                style={{
                  ...rowBase,
                  background: '#eef2ff',
                  border: '2px solid #667eea',
                  cursor: 'default',
                }}
              >
                <span style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#667eea',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '1rem',
                  flexShrink: 0,
                }}>
                  {rank}
                </span>
                <strong style={{ flex: 1, fontSize: '1.0625rem' }}>#{couple.bib}</strong>
                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexShrink: 0 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMoveUp(couple.bib); }}
                    disabled={!canMoveUp}
                    style={{ ...arrowBtn, opacity: canMoveUp ? 1 : 0.3 }}
                  >
                    ▲
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMoveDown(couple.bib); }}
                    disabled={!canMoveDown}
                    style={{ ...arrowBtn, opacity: canMoveDown ? 1 : 0.3 }}
                  >
                    ▼
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveRank(couple.bib); }}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '4px',
                      background: '#e2e8f0',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      color: '#718096',
                      flexShrink: 0,
                      cursor: 'pointer',
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                      padding: 0,
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Divider with label */}
      {ranked.length > 0 && unranked.length > 0 && (
        <p style={{
          fontSize: '0.6875rem',
          fontWeight: 600,
          color: '#a0aec0',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.3125rem',
        }}>
          Tap to place
        </p>
      )}

      {/* Unranked section */}
      {unranked.map(couple => (
        <button
          key={couple.bib}
          onClick={() => handleTapToRank(couple.bib)}
          style={{
            ...rowBase,
            background: isProAm ? '#fffbeb' : '#fff',
            border: `1px solid ${isProAm ? '#fcd34d' : '#e2e8f0'}`,
            borderLeft: isProAm ? '3px solid #f59e0b' : undefined,
          }}
        >
          <span style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '2px dashed #cbd5e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '1rem',
            color: '#cbd5e0',
            flexShrink: 0,
          }}>
            {ranked.length + unranked.indexOf(couple) + 1}
          </span>
          <strong style={{ flex: 1, fontSize: '1.0625rem' }}>#{couple.bib}</strong>
        </button>
      ))}

      {/* Clear all button */}
      {ranked.length > 0 && (
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

export default TapToRankForm;
