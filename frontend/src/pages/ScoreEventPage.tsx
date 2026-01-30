import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsApi, couplesApi, judgesApi } from '../api/client';
import { Event, Couple, Judge } from '../types';
import { useAuth } from '../context/AuthContext';

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

  const isRecallRound = ['quarter-final', 'semi-final'].includes(currentRound);
  const isProficiency = event?.scoringType === 'proficiency';

  const handleScoreChange = (judgeIndex: number, bib: number, value: string) => {
    const key = `${judgeIndex}-${bib}`;
    if (isRecallRound && !isProficiency) {
      // For recall: toggle checkbox (0 or 1)
      setScores(prev => ({ ...prev, [key]: prev[key] === 1 ? 0 : 1 }));
    } else if (isProficiency) {
      // For proficiency: 0-100
      const num = parseInt(value) || 0;
      setScores(prev => ({ ...prev, [key]: Math.min(100, Math.max(0, num)) }));
    } else {
      // For final: set rank
      setScores(prev => ({ ...prev, [key]: parseInt(value) || 0 }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!event) return;
    
    // Convert scores object to array format
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

  if (loading || authLoading) return <div className="loading">Loading...</div>;
  if (!event) return <div className="container"><div className="card">Event not found</div></div>;

  if (!isAdmin) {
    return (
      <div className="container">
        <div className="card">
          <h2>Access Denied</h2>
          <p>You must be an admin to score events.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Score Event: {event.name}</h2>
          <button onClick={() => navigate(-1)} className="btn btn-secondary">Cancel</button>
        </div>

        {event.heats.length > 1 && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ marginRight: '0.5rem', fontWeight: 500 }}>Round:</label>
            {event.heats.map(heat => (
              <button
                key={heat.round}
                onClick={() => navigate(`/events/${id}/score/${heat.round}`)}
                className={`btn ${heat.round === currentRound ? '' : 'btn-secondary'}`}
                style={{ marginRight: '0.5rem', textTransform: 'capitalize' }}
              >
                {heat.round}
              </button>
            ))}
          </div>
        )}

        {error && <div className="error">{error}</div>}

        {couples.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
            <p>No couples in this round yet.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{
              background: isProficiency ? '#f0fff4' : isRecallRound ? '#fef3c7' : '#e6f7ff',
              border: `1px solid ${isProficiency ? '#38a169' : isRecallRound ? '#f59e0b' : '#1890ff'}`,
              padding: '1rem',
              borderRadius: '4px',
              marginBottom: '1rem'
            }}>
              <strong>
                {isProficiency ? 'Proficiency Scoring' : isRecallRound ? '📋 Recall Round' : '🏆 Final Round'}
              </strong>
              <p style={{ margin: '0.5rem 0 0 0' }}>
                {isProficiency
                  ? 'Enter a score from 0-100 for each couple.'
                  : isRecallRound
                    ? 'Check the box for couples you want to recall to the next round.'
                    : 'Enter rankings for each couple (1 = best).'}
              </p>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Bib #</th>
                    <th>Leader</th>
                    <th>Follower</th>
                    {Array.from({ length: numJudges }, (_, i) => (
                      <th key={i}>{heatJudges[i] ? `#${heatJudges[i].judgeNumber}: ${heatJudges[i].name}` : `Judge ${i + 1}`}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {couples.map(couple => (
                    <tr key={couple.bib}>
                      <td><strong>#{couple.bib}</strong></td>
                      <td>{couple.leaderName}</td>
                      <td>{couple.followerName}</td>
                      {Array.from({ length: numJudges }, (_, judgeIndex) => {
                        const key = `${judgeIndex}-${couple.bib}`;
                        return (
                          <td key={judgeIndex}>
                            {isProficiency ? (
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={scores[key] ?? ''}
                                onChange={e => handleScoreChange(judgeIndex, couple.bib, e.target.value)}
                                style={{ width: '70px', textAlign: 'center' }}
                              />
                            ) : isRecallRound ? (
                              <input
                                type="checkbox"
                                checked={scores[key] === 1}
                                onChange={() => handleScoreChange(judgeIndex, couple.bib, '')}
                                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                              />
                            ) : (
                              <input
                                type="number"
                                min="1"
                                max={couples.length}
                                value={scores[key] || ''}
                                onChange={e => handleScoreChange(judgeIndex, couple.bib, e.target.value)}
                                style={{ width: '60px', textAlign: 'center' }}
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

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button type="submit" className="btn btn-success">
                Submit Scores
              </button>
              <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">
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
