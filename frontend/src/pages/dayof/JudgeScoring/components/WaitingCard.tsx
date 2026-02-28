import { ActiveHeatInfo, Judge } from '../../../../types';
import JudgeBadge from './JudgeBadge';
import { formatRound } from '../utils';

const statusCls = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-gray-200 text-gray-600';
    case 'scoring': return 'bg-yellow-100 text-yellow-800';
    case 'completed': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-200 text-gray-600';
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case 'pending': return 'Pending';
    case 'scoring': return 'Scoring';
    case 'completed': return 'Completed';
    default: return status;
  }
};

interface WaitingCardProps {
  judge: Judge;
  heatInfo: ActiveHeatInfo | null;
  isAssigned: boolean;
  onChangeJudge: () => void;
}

const WaitingCard = ({ judge, heatInfo, isAssigned, onChangeJudge }: WaitingCardProps) => (
  <div className="max-w-[540px] mx-auto p-2">
    <div className="text-center mb-4">
      <JudgeBadge judge={judge} />
    </div>

    <div className="bg-white rounded-lg shadow p-6 text-center">
      <h2 className="mb-4">Waiting</h2>

      {!heatInfo ? (
        <div>
          <div className="text-3xl mb-2 text-gray-400">...</div>
          <p className="text-gray-400">No active heat. Waiting for the competition to begin.</p>
        </div>
      ) : heatInfo.isBreak ? (
        <div>
          <p className="text-gray-400 mb-2 text-[0.8rem]">
            Heat {heatInfo.heatNumber} of {heatInfo.totalHeats}
          </p>
          <div className="p-4 bg-yellow-50 rounded-lg mb-3">
            <p className="text-lg font-semibold mb-1">
              {heatInfo.breakLabel || 'Break'}
            </p>
            {heatInfo.breakDuration && (
              <p className="text-gray-500 m-0">{heatInfo.breakDuration} minutes</p>
            )}
          </div>
          <p className="text-gray-500 text-sm">Scoring will resume after the break.</p>
        </div>
      ) : (
        <div>
          <p className="text-gray-400 mb-2 text-[0.8rem]">
            Heat {heatInfo.heatNumber} of {heatInfo.totalHeats}
          </p>
          <div className="p-4 bg-gray-50 rounded-lg mb-3">
            {heatInfo.entries.map(entry => (
              <div key={entry.eventId} className="mb-1">
                <p className="text-lg font-semibold mb-0.5">
                  {entry.eventName}
                </p>
                <p className="text-gray-600 m-0 capitalize">
                  {formatRound(entry.round)}
                </p>
              </div>
            ))}
            <div className="mt-2">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold uppercase ${statusCls(heatInfo.status)}`}>
                {statusLabel(heatInfo.status)}
              </span>
            </div>
          </div>

          {heatInfo.status === 'scoring' && !isAssigned && (
            <p className="text-red-500 text-sm font-medium">
              You are not assigned to judge this heat.
            </p>
          )}
          {heatInfo.status !== 'scoring' && isAssigned && (
            <p className="text-primary-500 text-sm font-medium">
              You are assigned to this heat. Scoring will begin soon.
            </p>
          )}
          {heatInfo.status !== 'scoring' && !isAssigned && (
            <p className="text-gray-500 text-sm">
              Waiting for this heat to enter scoring.
            </p>
          )}
        </div>
      )}
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

export default WaitingCard;
