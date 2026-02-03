import { useEffect } from 'react';
import { Event, Couple, ScoringProgress } from '../../../types';

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <strong style={{ fontSize: '1rem' }}>Scoring Progress</strong>
        {progress && (
          <span style={{
            padding: '0.25rem 0.75rem',
            background: progress.submittedCount === progress.totalJudges ? '#c6f6d5' : '#fefcbf',
            borderRadius: '9999px',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}>
            {progress.submittedCount} / {progress.totalJudges} judges
          </span>
        )}
      </div>

      {/* Judge status chips */}
      {progress && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {progress.judges.map(judge => (
            <span
              key={judge.judgeId}
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '4px',
                fontSize: '0.875rem',
                background: judge.hasSubmitted ? '#c6f6d5' : '#fed7d7',
                color: judge.hasSubmitted ? '#276749' : '#9b2c2c',
                fontWeight: 500,
              }}
            >
              #{judge.judgeNumber}: {judge.judgeName} {judge.hasSubmitted ? '\u2713' : '\u2026'}
            </span>
          ))}
        </div>
      )}

      {/* Per-entry scores tables */}
      {progress && progress.entries.map(entry => {
        const hasDances = entry.dances && entry.dances.length > 0 && entry.danceScoresByBib;
        return (
          <div key={`${entry.eventId}:${entry.round}`} style={{ marginBottom: '1rem' }}>
            {progress.entries.length > 1 && (
              <h4 style={{ margin: '0 0 0.5rem', color: '#4a5568', fontSize: '0.875rem' }}>
                {events[entry.eventId]?.name || `Event #${entry.eventId}`} — {entry.round}
              </h4>
            )}
            {hasDances ? (
              entry.dances!.map(dance => {
                const danceScores = entry.danceScoresByBib![dance] || {};
                return Object.keys(danceScores).length > 0 ? (
                  <div key={dance} style={{ marginBottom: '0.75rem' }}>
                    <h5 style={{ margin: '0 0 0.375rem', color: '#667eea', fontSize: '0.8125rem', fontWeight: 600 }}>
                      {dance}
                    </h5>
                    <div style={{ overflowX: 'auto' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Bib</th>
                            <th>Couple</th>
                            {progress.judges.map(j => (
                              <th key={j.judgeId} style={{ textAlign: 'center' }}>
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
                              <tr key={bib}>
                                <td><strong>#{bib}</strong></td>
                                <td>{couple ? `${couple.leaderName} & ${couple.followerName}` : 'Unknown'}</td>
                                {progress.judges.map(j => (
                                  <td key={j.judgeId} style={{ textAlign: 'center', color: judgeScores[j.judgeId] !== undefined ? '#2d3748' : '#cbd5e0' }}>
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
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Bib</th>
                        <th>Couple</th>
                        {progress.judges.map(j => (
                          <th key={j.judgeId} style={{ textAlign: 'center' }}>
                            #{j.judgeNumber}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(entry.scoresByBib).map(([bibStr, judgeScores]) => {
                        const bib = parseInt(bibStr);
                        const couple = couples.find(c => c.bib === bib);
                        return (
                          <tr key={bib}>
                            <td><strong>#{bib}</strong></td>
                            <td>{couple ? `${couple.leaderName} & ${couple.followerName}` : 'Unknown'}</td>
                            {progress.judges.map(j => (
                              <td key={j.judgeId} style={{ textAlign: 'center', color: judgeScores[j.judgeId] !== undefined ? '#2d3748' : '#cbd5e0' }}>
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
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-success" onClick={onAdvance} style={{ fontSize: '1.125rem', padding: '0.75rem 2rem' }}>
          Mark Complete
        </button>
      </div>
    </div>
  );
}
