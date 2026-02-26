import { useEffect } from 'react';
import { Event, Couple, ScoringProgress } from '../../../../types';

interface ScoringProgressPanelProps {
  scoringProgress: ScoringProgress | null;
  onLoadProgress: () => void;
  onAdvance: () => void;
  couples: Couple[];
  events: Record<number, Event>;
}

export default function ScoringProgressPanel({
  scoringProgress,
  onLoadProgress,
  onAdvance,
  couples,
  events,
}: ScoringProgressPanelProps) {
  useEffect(() => {
    onLoadProgress();
  }, []);

  const progress = scoringProgress;

  return (
    <div>
      {/* Progress badge */}
      <div className="flex items-center gap-3 mb-4">
        <strong className="text-base">Scoring Progress</strong>
        {progress && (
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
            progress.submittedCount === progress.totalJudges ? 'bg-green-100' : 'bg-yellow-100'
          }`}>
            {progress.submittedCount} / {progress.totalJudges} judges
          </span>
        )}
      </div>

      {/* Judge status chips */}
      {progress && (
        <div className="flex gap-2 flex-wrap mb-4">
          {progress.judges.map(judge => (
            <span
              key={judge.judgeId}
              className={`px-3 py-1 rounded text-sm font-medium ${
                judge.hasSubmitted
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              #{judge.judgeNumber}: {judge.judgeName}{judge.isChairman ? ' \u2605' : ''} {judge.hasSubmitted ? '\u2713' : '\u2026'}
            </span>
          ))}
        </div>
      )}

      {/* Per-entry scores tables */}
      {progress && progress.entries.map(entry => {
        const hasDances = entry.dances && entry.dances.length > 0 && entry.danceScoresByBib;
        return (
          <div key={`${entry.eventId}:${entry.round}`} className="mb-4">
            {progress.entries.length > 1 && (
              <h4 className="m-0 mb-2 text-gray-600 text-sm">
                {events[entry.eventId]?.name || `Event #${entry.eventId}`} — {entry.round}
              </h4>
            )}
            {hasDances ? (
              entry.dances!.map(dance => {
                const danceScores = entry.danceScoresByBib![dance] || {};
                return Object.keys(danceScores).length > 0 ? (
                  <div key={dance} className="mb-3">
                    <h5 className="m-0 mb-1.5 text-primary-500 text-[0.8125rem] font-semibold">
                      {dance}
                    </h5>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b-2 border-gray-200">
                            <th className="text-left px-2 py-1.5">Bib</th>
                            <th className="text-left px-2 py-1.5">Couple</th>
                            {progress.judges.map(j => (
                              <th key={j.judgeId} className="text-center px-2 py-1.5">
                                #{j.judgeNumber}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(danceScores).map(([bibStr, judgeScores]) => {
                            const bib = parseInt(bibStr);
                            const couple = couples.find(c => c.bib === bib);
                            return (
                              <tr key={bib} className="border-b border-gray-100">
                                <td className="px-2 py-1.5"><strong>#{bib}</strong></td>
                                <td className="px-2 py-1.5">{couple ? `${couple.leaderName} & ${couple.followerName}` : 'Unknown'}</td>
                                {progress.judges.map(j => (
                                  <td key={j.judgeId} className={`text-center px-2 py-1.5 ${judgeScores[j.judgeId] !== undefined ? 'text-gray-800' : 'text-gray-300'}`}>
                                    {judgeScores[j.judgeId] !== undefined ? judgeScores[j.judgeId] : '--'}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null;
              })
            ) : (
              Object.keys(entry.scoresByBib).length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left px-2 py-1.5">Bib</th>
                        <th className="text-left px-2 py-1.5">Couple</th>
                        {progress.judges.map(j => (
                          <th key={j.judgeId} className="text-center px-2 py-1.5">
                            #{j.judgeNumber}{j.isChairman ? ' \u2605' : ''}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(entry.scoresByBib).map(([bibStr, judgeScores]) => {
                        const bib = parseInt(bibStr);
                        const couple = couples.find(c => c.bib === bib);
                        return (
                          <tr key={bib} className="border-b border-gray-100">
                            <td className="px-2 py-1.5"><strong>#{bib}</strong></td>
                            <td className="px-2 py-1.5">{couple ? `${couple.leaderName} & ${couple.followerName}` : 'Unknown'}</td>
                            {progress.judges.map(j => (
                              <td key={j.judgeId} className={`text-center px-2 py-1.5 ${judgeScores[j.judgeId] !== undefined ? 'text-gray-800' : 'text-gray-300'}`}>
                                {judgeScores[j.judgeId] !== undefined ? judgeScores[j.judgeId] : '--'}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        );
      })}

      {/* Actions */}
      <div className="flex gap-2 justify-center flex-wrap">
        <button
          className="px-8 py-3 bg-success-500 text-white rounded border-none cursor-pointer text-lg font-medium transition-colors hover:bg-success-600"
          onClick={onAdvance}
        >
          Mark Complete
        </button>
      </div>
    </div>
  );
}
