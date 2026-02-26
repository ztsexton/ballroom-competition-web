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
      <p className="font-semibold mb-1.5 text-sm">
        Rank each couple (1 = best, {couples.length} = last):
      </p>
      {couples.map(couple => {
        const rank = scores[couple.bib];
        const isDuplicate = rank >= 1 && rankCounts[rank] > 1;
        return (
          <div
            key={couple.bib}
            className={`flex items-center gap-2 px-2.5 py-2 mb-[0.3125rem] rounded-md min-h-[44px] ${
              isDuplicate
                ? 'border-2 border-danger-500 bg-red-50'
                : isProAm
                  ? 'border border-yellow-300 border-l-[3px] border-l-amber-500 bg-amber-50'
                  : 'border border-gray-200 bg-white'
            }`}
          >
            <strong className="text-[1.0625rem] flex-1">#{couple.bib}</strong>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={rank || ''}
              onChange={(e) => onChange(couple.bib, e.target.value)}
              className={`w-[52px] h-10 text-center p-0.5 rounded-md text-xl font-bold touch-manipulation ${
                isDuplicate
                  ? 'border-2 border-danger-500 text-danger-500'
                  : 'border-2 border-gray-300 text-gray-800'
              }`}
            />
          </div>
        );
      })}
    </div>
  );
};

export default RankingForm;
