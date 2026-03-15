import { CoupleInfo } from '../types';

const ProficiencyForm = ({
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
  const scoredCount = couples.filter(c => (scores[c.bib] || 0) > 0).length;
  const allScored = scoredCount === couples.length;

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <p className="font-semibold m-0 text-sm">Score each couple (0-100):</p>
        <span className={`py-0.5 px-1.5 rounded text-[0.8125rem] font-semibold ${
          allScored ? 'bg-green-200' : 'bg-yellow-100'
        }`}>
          {scoredCount} / {couples.length}
        </span>
      </div>
      {couples.map(couple => (
        <div
          key={couple.bib}
          className={`flex items-center gap-2 px-2.5 py-1.5 mb-[3px] rounded-md min-h-[40px] ${
            isProAm
              ? 'border border-yellow-300 border-l-[3px] border-l-amber-500 bg-amber-50'
              : 'border border-gray-200 bg-white'
          }`}
        >
          <strong className="text-base flex-1">#{couple.bib}</strong>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={scores[couple.bib] ?? ''}
            onChange={(e) => onChange(couple.bib, e.target.value)}
            className="w-14 h-9 text-center p-0.5 border-2 border-gray-300 rounded-md text-lg font-bold touch-manipulation"
          />
        </div>
      ))}
    </div>
  );
};

export default ProficiencyForm;
