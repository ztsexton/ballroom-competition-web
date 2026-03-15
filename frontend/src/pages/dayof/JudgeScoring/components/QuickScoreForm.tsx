import { useState } from 'react';
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
}) => {
  const [expandedBib, setExpandedBib] = useState<number | null>(null);
  const allScored = couples.every(c => (scores[c.bib] || 0) > 0);
  const scoredCount = couples.filter(c => (scores[c.bib] || 0) > 0).length;

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
      {couples.map(couple => {
        const score = scores[couple.bib] || 0;
        const isExpanded = expandedBib === couple.bib;
        return (
          <div
            key={couple.bib}
            className={`mb-1 rounded-md overflow-hidden transition-all ${
              isProAm
                ? 'border border-yellow-300 border-l-[3px] border-l-amber-500 bg-amber-50'
                : score > 0 ? 'border border-primary-200 bg-primary-50/30' : 'border border-gray-200 bg-white'
            }`}
          >
            {/* Compact row — always visible */}
            <div
              className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer touch-manipulation select-none [-webkit-tap-highlight-color:transparent]"
              onClick={() => setExpandedBib(isExpanded ? null : couple.bib)}
            >
              <strong className="text-base shrink-0">#{couple.bib}</strong>
              <div className="flex-1" />

              {/* Inline quick presets — most common scores */}
              <div className="flex gap-[3px]">
                {SCORE_PRESETS.map(preset => (
                  <button
                    key={preset}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(couple.bib, String(preset));
                      // Auto-advance to next unscored couple
                      const nextUnscored = couples.find(c => c.bib !== couple.bib && (scores[c.bib] || 0) === 0);
                      if (nextUnscored) setExpandedBib(nextUnscored.bib);
                      else setExpandedBib(null);
                    }}
                    className={`w-[34px] h-[34px] rounded text-xs font-bold cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent] p-0 ${
                      score === preset
                        ? 'border-2 border-primary-500 bg-primary-500 text-white'
                        : 'border border-gray-200 bg-gray-50 text-gray-700'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Current score badge */}
              <span className={`ml-1 w-[38px] text-center font-bold text-lg shrink-0 ${
                score > 0 ? 'text-primary-600' : 'text-gray-300'
              }`}>
                {score > 0 ? score : '--'}
              </span>
            </div>

            {/* Expanded fine-tune row */}
            {isExpanded && (
              <div className="flex items-center justify-center gap-3 px-2 pb-2 pt-0.5">
                <button
                  onClick={() => onChange(couple.bib, String(Math.max(0, score - 5)))}
                  className="w-10 h-10 rounded-lg border border-gray-200 bg-gray-50 text-sm font-bold cursor-pointer flex items-center justify-center touch-manipulation [-webkit-tap-highlight-color:transparent] text-gray-600"
                >
                  -5
                </button>
                <button
                  onClick={() => onChange(couple.bib, String(Math.max(0, score - 1)))}
                  className="w-10 h-10 rounded-lg border border-gray-200 bg-gray-50 text-lg font-bold cursor-pointer flex items-center justify-center touch-manipulation [-webkit-tap-highlight-color:transparent] text-gray-600"
                >
                  -
                </button>
                <span className="text-2xl font-bold min-w-[48px] text-center text-gray-800">
                  {score > 0 ? score : '--'}
                </span>
                <button
                  onClick={() => onChange(couple.bib, String(Math.min(100, score + 1)))}
                  className="w-10 h-10 rounded-lg border border-gray-200 bg-gray-50 text-lg font-bold cursor-pointer flex items-center justify-center touch-manipulation [-webkit-tap-highlight-color:transparent] text-gray-600"
                >
                  +
                </button>
                <button
                  onClick={() => onChange(couple.bib, String(Math.min(100, score + 5)))}
                  className="w-10 h-10 rounded-lg border border-gray-200 bg-gray-50 text-sm font-bold cursor-pointer flex items-center justify-center touch-manipulation [-webkit-tap-highlight-color:transparent] text-gray-600"
                >
                  +5
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default QuickScoreForm;
