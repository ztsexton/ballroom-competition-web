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

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <p className="font-semibold m-0 text-sm">Tap couples in placement order:</p>
        <span className={`py-0.5 px-1.5 rounded text-[0.8125rem] font-semibold ${
          allRanked ? 'bg-green-200' : 'bg-yellow-100'
        }`}>
          {ranked.length} / {couples.length}
        </span>
      </div>

      {/* Ranked section */}
      {ranked.length > 0 && (
        <div className={unranked.length > 0 ? 'mb-1.5' : ''}>
          {ranked.map(couple => {
            const rank = scores[couple.bib];
            const maxRank = Math.max(0, ...Object.values(scores).filter(v => v > 0));
            const canMoveUp = rank > 1;
            const canMoveDown = rank < maxRank;
            return (
              <div
                key={couple.bib}
                className="flex items-center gap-1.5 w-full py-1 px-2 mb-[3px] rounded-md border-2 border-primary-500 bg-indigo-50 cursor-default text-left min-h-[40px] touch-manipulation [-webkit-tap-highlight-color:transparent] select-none"
              >
                <span className="w-7 h-7 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {rank}
                </span>
                <strong className="flex-1 text-base">#{couple.bib}</strong>
                <div className="flex gap-0.5 items-center shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMoveUp(couple.bib); }}
                    disabled={!canMoveUp}
                    className={`w-7 h-7 rounded border border-indigo-200 bg-white flex items-center justify-center text-xs font-bold cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent] p-0 text-primary-500 ${
                      !canMoveUp ? 'opacity-30' : ''
                    }`}
                  >
                    ▲
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMoveDown(couple.bib); }}
                    disabled={!canMoveDown}
                    className={`w-7 h-7 rounded border border-indigo-200 bg-white flex items-center justify-center text-xs font-bold cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent] p-0 text-primary-500 ${
                      !canMoveDown ? 'opacity-30' : ''
                    }`}
                  >
                    ▼
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveRank(couple.bib); }}
                    className="w-7 h-7 rounded bg-gray-200 border-none flex items-center justify-center text-xs text-gray-500 shrink-0 cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent] p-0"
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
        <p className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wide mb-[3px]">
          Tap to place
        </p>
      )}

      {/* Unranked section */}
      {unranked.map(couple => (
        <button
          key={couple.bib}
          onClick={() => handleTapToRank(couple.bib)}
          className={`flex items-center gap-1.5 w-full py-1 px-2 mb-[3px] rounded-md border-none cursor-pointer text-left min-h-[40px] touch-manipulation [-webkit-tap-highlight-color:transparent] select-none ${
            isProAm
              ? 'bg-amber-50 border border-yellow-300 border-l-[3px] border-l-amber-500'
              : 'bg-white border border-gray-200'
          }`}
        >
          <span className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center font-bold text-sm text-gray-300 shrink-0">
            {ranked.length + unranked.indexOf(couple) + 1}
          </span>
          <strong className="flex-1 text-base">#{couple.bib}</strong>
        </button>
      ))}

      {ranked.length > 0 && (
        <div className="text-center mt-1.5">
          <button
            onClick={handleClearAll}
            className="py-1.5 px-3 bg-transparent border border-gray-200 rounded-md text-gray-400 cursor-pointer text-xs touch-manipulation"
          >
            Reset Rankings
          </button>
        </div>
      )}
    </div>
  );
};

export default TapToRankForm;
