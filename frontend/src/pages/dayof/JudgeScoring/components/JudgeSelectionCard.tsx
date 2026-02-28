import { Judge } from '../../../../types';

interface JudgeSelectionCardProps {
  judges: Judge[];
  onSelectJudge: (judgeId: number) => void;
}

const JudgeSelectionCard = ({ judges, onSelectJudge }: JudgeSelectionCardProps) => (
  <div className="max-w-[540px] mx-auto p-2">
    <div className="bg-white rounded-lg shadow p-6 text-center">
      <h2 className="mb-2">Judge Scoring</h2>
      <p className="text-gray-500 mb-6">
        Select your judge identity to begin.
      </p>
      <div className="flex flex-col gap-3">
        {judges.map(judge => (
          <button
            key={judge.id}
            onClick={() => onSelectJudge(judge.id)}
            className="flex items-center gap-3 p-4 px-5 bg-white border-2 border-gray-200 rounded-lg cursor-pointer transition-all duration-150 text-left text-base touch-manipulation [-webkit-tap-highlight-color:transparent] select-none min-h-[44px] hover:border-primary-500 hover:bg-gray-50"
          >
            <span className={`w-10 h-10 rounded-full ${judge.isChairman ? 'bg-yellow-500' : 'bg-primary-500'} text-white flex items-center justify-center font-bold text-base shrink-0`}>
              {judge.judgeNumber}
            </span>
            <span className="font-medium text-lg">
              {judge.name}
              {judge.isChairman && <span className="text-yellow-500 ml-2 text-sm">{'\u2605'} Chairman</span>}
            </span>
          </button>
        ))}
        {judges.length === 0 && (
          <p className="text-gray-400">No judges found for this competition.</p>
        )}
      </div>
    </div>
  </div>
);

export default JudgeSelectionCard;
