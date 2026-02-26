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
    <p className="font-semibold mb-1.5 text-sm">
      Score each couple (0-100):
    </p>
    {couples.map(couple => {
      const score = scores[couple.bib] || 0;
      return (
        <div
          key={couple.bib}
          className={`px-2.5 py-2 mb-1.5 rounded-md ${
            isProAm
              ? 'border border-yellow-300 border-l-[3px] border-l-amber-500 bg-amber-50'
              : 'border border-gray-200 bg-white'
          }`}
        >
          <div className="flex justify-between items-center mb-1.5">
            <strong className="text-[1.0625rem]">#{couple.bib}</strong>
            <span className={`text-2xl font-bold min-w-[40px] text-right ${
              score > 0 ? 'text-gray-800' : 'text-gray-300'
            }`}>
              {score > 0 ? score : '--'}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1 mb-[0.3125rem]">
            {SCORE_PRESETS.map(preset => {
              const isActive = score === preset;
              return (
                <button
                  key={preset}
                  onClick={() => onChange(couple.bib, String(preset))}
                  className={`min-h-[36px] rounded-md text-[0.9375rem] font-semibold cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent] ${
                    isActive
                      ? 'border-2 border-primary-500 bg-primary-500 text-white'
                      : 'border border-gray-200 bg-gray-50 text-gray-800'
                  }`}
                >
                  {preset}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => onChange(couple.bib, String(Math.max(0, score - 1)))}
              className="w-9 h-9 rounded-full border border-gray-200 bg-gray-50 text-lg font-bold cursor-pointer flex items-center justify-center touch-manipulation [-webkit-tap-highlight-color:transparent] text-gray-600"
            >
              -
            </button>
            <span className="text-base font-semibold text-gray-500 min-w-[30px] text-center">
              {score > 0 ? score : '--'}
            </span>
            <button
              onClick={() => onChange(couple.bib, String(Math.min(100, score + 1)))}
              className="w-9 h-9 rounded-full border border-gray-200 bg-gray-50 text-lg font-bold cursor-pointer flex items-center justify-center touch-manipulation [-webkit-tap-highlight-color:transparent] text-gray-600"
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
