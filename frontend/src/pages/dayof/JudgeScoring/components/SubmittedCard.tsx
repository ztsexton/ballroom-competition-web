import { ActiveHeatInfo, Judge } from '../../../../types';
import JudgeBadge from './JudgeBadge';
import { formatRound } from '../utils';

interface SubmittedCardProps {
  judge: Judge;
  heatInfo: ActiveHeatInfo | null;
  onChangeJudge: () => void;
}

const SubmittedCard = ({ judge, heatInfo, onChangeJudge }: SubmittedCardProps) => (
  <div className="max-w-[540px] mx-auto p-2">
    <div className="text-center mb-4">
      <JudgeBadge judge={judge} />
    </div>

    <div className="bg-white rounded-lg shadow p-6 text-center">
      <div className="w-[72px] h-[72px] rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4 text-3xl text-green-800">
        ✓
      </div>

      <h2 className="text-green-800 mb-2">Scores Submitted</h2>
      {heatInfo && (
        <>
          <p className="text-gray-400 mb-1 text-[0.8rem]">
            Heat {heatInfo.heatNumber} of {heatInfo.totalHeats}
          </p>
          {heatInfo.entries.map(entry => (
            <p key={entry.eventId} className="text-gray-500 mb-1">
              {entry.eventName} — {formatRound(entry.round)}
            </p>
          ))}
        </>
      )}
      <p className="text-gray-400 text-sm mt-2">
        Waiting for the next heat...
      </p>
    </div>

    <div className="text-center mt-4">
      <button
        onClick={onChangeJudge}
        className="py-3 px-5 bg-transparent border border-gray-300 rounded-md text-gray-500 cursor-pointer text-sm touch-manipulation min-h-[44px] select-none [-webkit-tap-highlight-color:transparent]"
      >
        Change Judge
      </button>
    </div>
  </div>
);

export default SubmittedCard;
