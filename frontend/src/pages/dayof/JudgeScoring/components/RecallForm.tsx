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
      <div className="flex justify-between items-center mb-1.5">
        <p className="font-semibold m-0 text-sm">
          {maxRecalls !== undefined ? `Select ${maxRecalls} to recall:` : 'Select couples to recall:'}
        </p>
        <span className={`py-0.5 px-1.5 rounded text-[0.8125rem] font-semibold ${
          maxRecalls !== undefined
            ? (recallCount === maxRecalls ? 'bg-green-200' : recallCount > maxRecalls ? 'bg-red-200 text-red-800' : 'bg-yellow-100')
            : (recallCount > 0 ? 'bg-green-200' : 'bg-gray-200')
        }`}>
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
            className={`flex items-center gap-2 px-2.5 py-2 mb-[0.3125rem] rounded-md transition-all select-none touch-manipulation [-webkit-tap-highlight-color:transparent] min-h-[44px] ${
              selected
                ? 'border-2 border-success-500 bg-green-50'
                : isProAm
                  ? 'border border-yellow-300 border-l-[3px] border-l-amber-500 bg-amber-50'
                  : 'border border-gray-200 bg-white'
            } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
          >
            <div className={`w-[26px] h-[26px] rounded-[5px] flex items-center justify-center text-white font-bold text-sm shrink-0 transition-all ${
              selected
                ? 'border-2 border-success-500 bg-success-500'
                : 'border-2 border-gray-300 bg-white'
            }`}>
              {selected ? '\u2713' : ''}
            </div>
            <strong className="text-[1.0625rem]">#{couple.bib}</strong>
          </div>
        );
      })}
    </div>
  );
};

export default RecallForm;
