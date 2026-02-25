import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsApi } from '../../api/client';
import { Event, DetailedResultsResponse } from '../../types';
import { JudgeGrid } from '../../components/results/JudgeGrid';
import { SkatingBreakdown } from '../../components/results/SkatingBreakdown';
import { MultiDanceSummary } from '../../components/results/MultiDanceSummary';

const RECALL_ROUNDS = ['quarter-final', 'semi-final'];

const ResultsPage = () => {
  const { id, round } = useParams<{ id: string; round?: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [detailed, setDetailed] = useState<DetailedResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentRound, setCurrentRound] = useState<string>('final');

  useEffect(() => {
    if (id) {
      loadEventAndResults();
    }
  }, [id, round]);

  const loadEventAndResults = async () => {
    try {
      const eventResponse = await eventsApi.getById(parseInt(id!));
      setEvent(eventResponse.data);

      const roundToUse = round || eventResponse.data.heats[0]?.round || 'final';
      setCurrentRound(roundToUse);

      const detailResponse = await eventsApi.getDetailedResults(parseInt(id!), roundToUse);
      setDetailed(detailResponse.data);
    } catch (error) {
      console.error('Failed to load results:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!event) return <div className="container"><div className="card">Event not found</div></div>;

  const results = detailed?.results || [];
  const judges = detailed?.judges || [];
  const dances = detailed?.dances || [];
  const isRecall = RECALL_ROUNDS.includes(currentRound);
  const isMultiDance = dances.length > 1;
  const isProficiency = event.scoringType === 'proficiency';
  const hasSkatingDetail = results.some(r => r.skatingDetail);

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>Results: {event.name}</h2>
            {(detailed?.style || detailed?.level) && (
              <div style={{ fontSize: '0.875rem', color: '#718096', marginTop: '0.25rem' }}>
                {[detailed.style, detailed.level].filter(Boolean).join(' \u00b7 ')}
                {isMultiDance && <> &middot; {dances.join(', ')}</>}
              </div>
            )}
          </div>
          <button onClick={() => navigate(-1)} className="btn btn-secondary">Back</button>
        </div>

        {event.heats.length > 1 && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ marginRight: '0.5rem', fontWeight: 500 }}>Round:</label>
            {event.heats.map(heat => (
              <button
                key={heat.round}
                onClick={() => navigate(`/events/${id}/results/${heat.round}`)}
                className={`btn ${heat.round === currentRound ? '' : 'btn-secondary'}`}
                style={{ marginRight: '0.5rem', textTransform: 'capitalize' }}
              >
                {heat.round}
              </button>
            ))}
          </div>
        )}

        {results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
            <p>No scores submitted yet for this round</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Judge Grid(s) */}
            {judges.length > 0 && (
              isMultiDance ? (
                dances.map(dance => (
                  <div key={dance}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', textTransform: 'capitalize' }}>
                      {dance}
                    </h3>
                    <JudgeGrid results={results} judges={judges} isRecall={isRecall} dance={dance} />
                  </div>
                ))
              ) : (
                <div>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
                    {isRecall ? 'Recall Marks' : 'Judge Placements'}
                  </h3>
                  <JudgeGrid results={results} judges={judges} isRecall={isRecall} />
                </div>
              )
            )}

            {/* Skating Breakdown for single-dance finals */}
            {!isRecall && !isProficiency && hasSkatingDetail && !isMultiDance && (
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Skating System Breakdown</h3>
                <SkatingBreakdown results={results} numJudges={judges.length} />
              </div>
            )}

            {/* Per-dance skating breakdown for multi-dance finals */}
            {!isRecall && !isProficiency && isMultiDance && results.some(r => r.danceDetails?.some(d => d.skatingDetail)) && (
              dances.map(dance => {
                const danceResults = results.map(r => {
                  const dd = r.danceDetails?.find(d => d.dance === dance);
                  if (!dd?.skatingDetail) return null;
                  return { ...r, skatingDetail: dd.skatingDetail, place: dd.placement };
                }).filter(Boolean) as typeof results;
                if (danceResults.length === 0) return null;
                return (
                  <div key={`skating-${dance}`}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', textTransform: 'capitalize' }}>
                      Skating: {dance}
                    </h3>
                    <SkatingBreakdown results={danceResults} numJudges={judges.length} />
                  </div>
                );
              })
            )}

            {/* Multi-dance summary table */}
            {isMultiDance && !isRecall && (
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Overall Placement</h3>
                <MultiDanceSummary results={results} dances={dances} />
              </div>
            )}

            {/* Proficiency scoring summary */}
            {isProficiency && (
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Proficiency Scores</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Bib</th>
                      <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Couple</th>
                      <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem' }}>Avg Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={r.bib} style={{ borderBottom: '1px solid #edf2f7', background: i % 2 === 0 ? '#fafafa' : 'white' }}>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{r.bib}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{r.leaderName} &amp; {r.followerName}</td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                          {r.totalScore?.toFixed(1) ?? '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsPage;
