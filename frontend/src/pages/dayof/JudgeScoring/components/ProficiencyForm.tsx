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
}) => (
  <div>
    <p className="font-semibold mb-1.5 text-sm">
      Score each couple (0-100):
    </p>
    {couples.map(couple => (
      <div
        key={couple.bib}
        className={`flex items-center gap-2 px-2.5 py-2 mb-[0.3125rem] rounded-md min-h-[44px] ${
          isProAm
            ? 'border border-yellow-300 border-l-[3px] border-l-amber-500 bg-amber-50'
            : 'border border-gray-200 bg-white'
        }`}
      >
        <strong className="text-[1.0625rem] flex-1">#{couple.bib}</strong>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={scores[couple.bib] ?? ''}
          onChange={(e) => onChange(couple.bib, e.target.value)}
          className="w-14 h-10 text-center p-0.5 border-2 border-gray-300 rounded-md text-xl font-bold touch-manipulation"
        />
      </div>
    ))}
  </div>
);

export default ProficiencyForm;
