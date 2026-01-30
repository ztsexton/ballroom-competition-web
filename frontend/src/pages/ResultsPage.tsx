import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsApi } from '../api/client';
import { Event, EventResult } from '../types';

const ResultsPage = () => {
  const { id, round } = useParams<{ id: string; round?: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [results, setResults] = useState<EventResult[]>([]);
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
      
      const resultsResponse = await eventsApi.getResults(parseInt(id!), roundToUse);
      setResults(resultsResponse.data);
    } catch (error) {
      console.error('Failed to load results:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!event) return <div className="container"><div className="card">Event not found</div></div>;

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Results: {event.name}</h2>
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
          <table>
            <thead>
              <tr>
                <th>Place</th>
                <th>Bib</th>
                <th>Leader</th>
                <th>Follower</th>
                {results[0].totalScore !== undefined ? (
                  <th>Avg Score</th>
                ) : results[0].isRecall ? (
                  <th>Total Marks</th>
                ) : (
                  <th>Total Rank</th>
                )}
                <th>Individual Scores</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, index) => (
                <tr key={result.bib}>
                  <td><strong>{index + 1}</strong></td>
                  <td>{result.bib}</td>
                  <td>{result.leaderName}</td>
                  <td>{result.followerName}</td>
                  <td>
                    <strong>
                      {result.totalScore !== undefined
                        ? result.totalScore
                        : result.isRecall
                          ? result.totalMarks
                          : result.totalRank}
                    </strong>
                  </td>
                  <td>{result.scores.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ResultsPage;
