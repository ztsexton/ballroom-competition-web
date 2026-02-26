import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsApi, couplesApi, judgesApi } from '../../api/client';
import { Event, Couple, Judge } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Skeleton } from '../../components/Skeleton';

const ScoreEventPage = () => {
  const { id, round } = useParams<{ id: string; round?: string }>();
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [couples, setCouples] = useState<Couple[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentRound, setCurrentRound] = useState<string>('final');
  const [numJudges, setNumJudges] = useState(3);
  const [heatJudges, setHeatJudges] = useState<Judge[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id, round]);

  const loadData = async () => {
    try {
      const eventResponse = await eventsApi.getById(parseInt(id!));
      setEvent(eventResponse.data);

      const roundToUse = round || eventResponse.data.heats[0]?.round || 'final';
      setCurrentRound(roundToUse);

      const heat = eventResponse.data.heats.find(h => h.round === roundToUse);
      if (heat) {
        setNumJudges(heat.judges.length || 3);

        const [couplesResponse, judgesResponse] = await Promise.all([
          couplesApi.getAll(),
          judgesApi.getAll(eventResponse.data.competitionId),
        ]);
        const eventCouples = couplesResponse.data.filter(c => heat.bibs.includes(c.bib));
        setCouples(eventCouples);

        const judgeMap = new Map(judgesResponse.data.map(j => [j.id, j]));
        setHeatJudges(heat.judges.map(jId => judgeMap.get(jId)).filter((j): j is Judge => !!j));
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      setError('Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const isRecallRound = ['quarter-final', 'semi-final', '1/8-final', '1/16-final', '1/32-final'].includes(currentRound);
  const isProficiency = event?.scoringType === 'proficiency';

  const handleScoreChange = (judgeIndex: number, bib: number, value: string) => {
    const key = `${judgeIndex}-${bib}`;
    if (isRecallRound && !isProficiency) {
      setScores(prev => ({ ...prev, [key]: prev[key] === 1 ? 0 : 1 }));
    } else if (isProficiency) {
      const num = parseInt(value) || 0;
      setScores(prev => ({ ...prev, [key]: Math.min(100, Math.max(0, num)) }));
    } else {
      setScores(prev => ({ ...prev, [key]: parseInt(value) || 0 }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!event) return;

    const scoresArray: Array<{ judgeIndex: number; bib: number; score: number }> = [];

    for (let judgeIndex = 0; judgeIndex < numJudges; judgeIndex++) {
      for (const couple of couples) {
        const key = `${judgeIndex}-${couple.bib}`;
        const score = scores[key] || (isProficiency ? 0 : isRecallRound ? 0 : couples.length);
        scoresArray.push({ judgeIndex, bib: couple.bib, score });
      }
    }

    try {
      await eventsApi.submitScores(event.id, currentRound, scoresArray);
      navigate(`/events/${event.id}/results/${currentRound}`);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to submit scores');
    }
  };

  if (loading || authLoading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <Skeleton variant="card" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500">Event not found</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-500">You must be an admin to score events.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Score Event: {event.name}</h2>
          <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200">Cancel</button>
        </div>

        {event.heats.length > 1 && (
          <div className="mb-4">
            <label className="mr-2 font-medium">Round:</label>
            {event.heats.map(heat => (
              <button
                key={heat.round}
                onClick={() => navigate(`/events/${id}/score/${heat.round}`)}
                className={`mr-2 px-4 py-2 rounded border-none cursor-pointer text-sm font-medium transition-colors capitalize ${
                  heat.round === currentRound
                    ? 'bg-primary-500 text-white hover:bg-primary-600'
                    : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                {heat.round}
              </button>
            ))}
          </div>
        )}

        {error && <div className="px-4 py-3 bg-red-100 text-red-700 rounded mb-4 text-sm">{error}</div>}

        {couples.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No couples in this round yet.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className={`p-4 rounded mb-4 ${
              isProficiency ? 'bg-green-50 border border-success-600' :
              isRecallRound ? 'bg-amber-50 border border-amber-400' :
              'bg-blue-50 border border-blue-400'
            }`}>
              <strong>
                {isProficiency ? 'Proficiency Scoring' : isRecallRound ? 'Recall Round' : 'Final Round'}
              </strong>
              <p className="mt-2">
                {isProficiency
                  ? 'Enter a score from 0-100 for each couple.'
                  : isRecallRound
                    ? 'Check the box for couples you want to recall to the next round.'
                    : 'Enter rankings for each couple (1 = best).'}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Bib #</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Leader</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Follower</th>
                    {Array.from({ length: numJudges }, (_, i) => (
                      <th key={i} className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">
                        {heatJudges[i] ? `#${heatJudges[i].judgeNumber}: ${heatJudges[i].name}${heatJudges[i].isChairman ? ' \u2605' : ''}` : `Judge ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {couples.map(couple => (
                    <tr key={couple.bib}>
                      <td className="px-3 py-2 border-t border-gray-100"><strong>#{couple.bib}</strong></td>
                      <td className="px-3 py-2 border-t border-gray-100">{couple.leaderName}</td>
                      <td className="px-3 py-2 border-t border-gray-100">{couple.followerName}</td>
                      {Array.from({ length: numJudges }, (_, judgeIndex) => {
                        const key = `${judgeIndex}-${couple.bib}`;
                        return (
                          <td key={judgeIndex} className="px-3 py-2 border-t border-gray-100">
                            {isProficiency ? (
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={scores[key] ?? ''}
                                onChange={e => handleScoreChange(judgeIndex, couple.bib, e.target.value)}
                                className="w-[70px] text-center px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                              />
                            ) : isRecallRound ? (
                              <input
                                type="checkbox"
                                checked={scores[key] === 1}
                                onChange={() => handleScoreChange(judgeIndex, couple.bib, '')}
                                className="w-5 h-5 cursor-pointer"
                              />
                            ) : (
                              <input
                                type="number"
                                min="1"
                                max={couples.length}
                                value={scores[key] || ''}
                                onChange={e => handleScoreChange(judgeIndex, couple.bib, e.target.value)}
                                className="w-[60px] text-center px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2 mt-6">
              <button type="submit" className="px-4 py-2 bg-success-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-success-600">
                Submit Scores
              </button>
              <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ScoreEventPage;
