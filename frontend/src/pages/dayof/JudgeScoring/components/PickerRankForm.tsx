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
    if (currentRank === rank) {
      onScoresChange({ ...scores, [bib]: 0 });
      return;
    }
    const updated = { ...scores };
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
      <div className="flex justify-between items-center mb-1">
        <p className="font-semibold m-0 text-sm">
          Pick a rank for each couple (1 = best):
        </p>
        <span className={`py-0.5 px-1.5 rounded text-[0.8125rem] font-semibold ${
          allRanked ? 'bg-green-200' : 'bg-yellow-100'
        }`}>
          {Object.keys(rankToBib).length} / {coupleCount}
        </span>
      </div>

      {couples.map(couple => {
        const currentRank = scores[couple.bib];
        const hasRank = currentRank >= 1 && currentRank <= coupleCount;
        return (
          <div
            key={couple.bib}
            className={`flex items-center gap-1.5 px-2 py-1 mb-[3px] rounded-md min-h-[40px] ${
              hasRank
                ? 'border-2 border-primary-500 bg-indigo-50'
                : isProAm
                  ? 'border border-yellow-300 border-l-[3px] border-l-amber-500 bg-amber-50'
                  : 'border border-gray-200 bg-white'
            }`}
          >
            <strong className="text-base shrink-0 min-w-[36px]">#{couple.bib}</strong>
            <div className="flex flex-wrap gap-[3px] flex-1 justify-end">
              {rankOptions.map(rank => {
                const isSelected = currentRank === rank;
                const isUsedByOther = rankToBib[rank] !== undefined && rankToBib[rank] !== couple.bib;
                return (
                  <button
                    key={rank}
                    onClick={() => handlePickRank(couple.bib, rank)}
                    className={`w-8 h-8 rounded text-sm font-bold touch-manipulation [-webkit-tap-highlight-color:transparent] transition-all p-0 ${
                      isSelected
                        ? 'border-2 border-primary-500 bg-primary-500 text-white cursor-pointer'
                        : isUsedByOther
                          ? 'border border-gray-200 bg-gray-50 text-gray-300 cursor-default opacity-50'
                          : 'border border-gray-300 bg-white text-gray-800 cursor-pointer'
                    }`}
                  >
                    {rank}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {Object.keys(rankToBib).length > 0 && (
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

export default PickerRankForm;
