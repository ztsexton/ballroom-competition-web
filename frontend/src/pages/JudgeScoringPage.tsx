import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { judgingApi } from '../api/client';
import { ActiveHeatInfo, Judge } from '../types';
import { useCompetitionSSE } from '../hooks/useCompetitionSSE';

type PageState = 'select-judge' | 'waiting' | 'scoring' | 'submitted';

const JudgeScoringPage = () => {
  const { id } = useParams<{ id: string }>();
  const competitionId = parseInt(id || '0');

  const [judges, setJudges] = useState<Judge[]>([]);
  const [selectedJudgeId, setSelectedJudgeId] = useState<number | null>(null);
  const [heatInfo, setHeatInfo] = useState<ActiveHeatInfo | null>(null);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [pageState, setPageState] = useState<PageState>('select-judge');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadJudges = useCallback(async () => {
    if (!competitionId) return;
    try {
      const res = await judgingApi.getJudges(competitionId);
      setJudges(res.data);
    } catch {
      setError('Failed to load judges');
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  const loadActiveHeat = useCallback(async () => {
    if (!competitionId) return;
    try {
      const res = await judgingApi.getActiveHeat(competitionId);
      setHeatInfo(res.data);
      setError('');
    } catch {
      setHeatInfo(null);
    }
  }, [competitionId]);

  useEffect(() => {
    loadJudges();
  }, [loadJudges]);

  useEffect(() => {
    if (selectedJudgeId !== null) {
      loadActiveHeat();
    }
  }, [selectedJudgeId, loadActiveHeat]);

  // Determine page state based on heat info
  useEffect(() => {
    if (selectedJudgeId === null) {
      setPageState('select-judge');
      return;
    }
    if (!heatInfo || heatInfo.status !== 'scoring') {
      setPageState('waiting');
      return;
    }
    // Check if this judge is assigned to the current heat
    const isAssigned = heatInfo.judges.some(j => j.id === selectedJudgeId);
    if (!isAssigned) {
      setPageState('waiting');
      return;
    }
    setPageState('scoring');
  }, [selectedJudgeId, heatInfo]);

  // When entering scoring state, initialize scores
  useEffect(() => {
    if (pageState === 'scoring' && heatInfo) {
      const initial: Record<number, number> = {};
      heatInfo.couples.forEach(c => {
        initial[c.bib] = heatInfo.isRecallRound ? 0 : 1;
      });
      setScores(initial);
      setSubmitting(false);
    }
  }, [pageState, heatInfo?.eventId, heatInfo?.round]);

  // SSE: refresh heat info on schedule or score updates
  useCompetitionSSE(selectedJudgeId !== null ? competitionId : null, {
    onScheduleUpdate: () => {
      loadActiveHeat();
      // Reset submitted state on heat change
      if (pageState === 'submitted') {
        setPageState('scoring');
      }
    },
    onScoreUpdate: () => {
      // Score updates don't affect the judge's own page much,
      // but reload heat info in case status changed
      loadActiveHeat();
    },
  });

  const handleSelectJudge = (judgeId: number) => {
    setSelectedJudgeId(judgeId);
  };

  const handleToggleRecall = (bib: number) => {
    setScores(prev => ({
      ...prev,
      [bib]: prev[bib] === 1 ? 0 : 1,
    }));
  };

  const handleRankChange = (bib: number, value: string) => {
    const rank = parseInt(value);
    if (!isNaN(rank) && rank >= 1) {
      setScores(prev => ({ ...prev, [bib]: rank }));
    }
  };

  const handleSubmit = async () => {
    if (!heatInfo || selectedJudgeId === null) return;

    setSubmitting(true);
    setError('');
    try {
      const scoreArray = Object.entries(scores).map(([bib, score]) => ({
        bib: parseInt(bib),
        score,
      }));

      await judgingApi.submitJudgeScores(
        competitionId,
        selectedJudgeId,
        heatInfo.eventId,
        heatInfo.round,
        scoreArray
      );
      setPageState('submitted');
    } catch {
      setError('Failed to submit scores. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedJudge = judges.find(j => j.id === selectedJudgeId);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="container" style={{ maxWidth: '600px', margin: '0 auto' }}>
      {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Judge Selection */}
      {pageState === 'select-judge' && (
        <div className="card" style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>Judge Scoring</h2>
          <p style={{ color: '#718096', marginBottom: '1.5rem' }}>
            Select your judge identity to begin scoring.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '300px', margin: '0 auto' }}>
            {judges.map(judge => (
              <button
                key={judge.id}
                className="btn"
                onClick={() => handleSelectJudge(judge.id)}
                style={{ textAlign: 'left', padding: '0.75rem 1rem' }}
              >
                #{judge.judgeNumber}: {judge.name}
              </button>
            ))}
            {judges.length === 0 && (
              <p style={{ color: '#a0aec0' }}>No judges found for this competition.</p>
            )}
          </div>
        </div>
      )}

      {/* Waiting for scoring */}
      {pageState === 'waiting' && selectedJudge && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '1rem' }}>
            <span style={{
              padding: '0.25rem 0.75rem',
              background: '#edf2f7',
              borderRadius: '4px',
              fontSize: '0.875rem',
            }}>
              #{selectedJudge.judgeNumber}: {selectedJudge.name}
            </span>
          </div>

          <h2 style={{ marginBottom: '1rem' }}>Waiting for Scoring</h2>

          {heatInfo ? (
            <div>
              <p style={{ color: '#718096', marginBottom: '0.5rem' }}>
                Current heat: <strong>{heatInfo.eventName}</strong> — {heatInfo.round}
              </p>
              <p style={{ color: '#a0aec0', fontSize: '0.875rem' }}>
                Status: {heatInfo.status}
              </p>
              {!heatInfo.judges.some(j => j.id === selectedJudgeId) && (
                <p style={{ color: '#e53e3e', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  You are not assigned to judge this heat.
                </p>
              )}
            </div>
          ) : (
            <p style={{ color: '#a0aec0' }}>
              No active heat. Waiting for the competition to begin...
            </p>
          )}

          <button
            className="btn btn-secondary"
            onClick={() => { setSelectedJudgeId(null); setPageState('select-judge'); }}
            style={{ marginTop: '1.5rem' }}
          >
            Change Judge
          </button>
        </div>
      )}

      {/* Scoring Form */}
      {pageState === 'scoring' && heatInfo && selectedJudge && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{
              padding: '0.25rem 0.75rem',
              background: '#edf2f7',
              borderRadius: '4px',
              fontSize: '0.875rem',
            }}>
              #{selectedJudge.judgeNumber}: {selectedJudge.name}
            </span>
            <span style={{
              padding: '0.25rem 0.75rem',
              background: '#fefcbf',
              borderRadius: '9999px',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}>
              Scoring
            </span>
          </div>

          <h2 style={{ marginBottom: '0.25rem' }}>{heatInfo.eventName}</h2>
          <p style={{ color: '#4a5568', marginBottom: '0.25rem', textTransform: 'capitalize' }}>
            Round: {heatInfo.round}
          </p>
          <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {[heatInfo.style, heatInfo.level, heatInfo.dances?.join(', ')].filter(Boolean).join(' | ')}
          </p>

          {heatInfo.isRecallRound ? (
            /* Recall round: checkboxes */
            <div>
              <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>
                Select couples to recall:
              </p>
              {heatInfo.couples.map(couple => (
                <div
                  key={couple.bib}
                  onClick={() => handleToggleRecall(couple.bib)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                    borderRadius: '6px',
                    border: scores[couple.bib] === 1 ? '2px solid #48bb78' : '2px solid #e2e8f0',
                    background: scores[couple.bib] === 1 ? '#f0fff4' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    border: scores[couple.bib] === 1 ? '2px solid #48bb78' : '2px solid #cbd5e0',
                    background: scores[couple.bib] === 1 ? '#48bb78' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    flexShrink: 0,
                  }}>
                    {scores[couple.bib] === 1 ? 'R' : ''}
                  </div>
                  <div>
                    <strong>#{couple.bib}</strong>{' '}
                    <span style={{ color: '#4a5568' }}>
                      {couple.leaderName} & {couple.followerName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Final round: ranking */
            <div>
              <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>
                Rank each couple (1 = best):
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Bib</th>
                    <th>Couple</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Rank</th>
                  </tr>
                </thead>
                <tbody>
                  {heatInfo.couples.map(couple => (
                    <tr key={couple.bib}>
                      <td><strong>#{couple.bib}</strong></td>
                      <td>{couple.leaderName} & {couple.followerName}</td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          min={1}
                          max={heatInfo.couples.length}
                          value={scores[couple.bib] || ''}
                          onChange={(e) => handleRankChange(couple.bib, e.target.value)}
                          style={{
                            width: '60px',
                            textAlign: 'center',
                            padding: '0.25rem',
                            border: '1px solid #cbd5e0',
                            borderRadius: '4px',
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
            <button
              className="btn btn-success"
              onClick={handleSubmit}
              disabled={submitting}
              style={{ flex: 1, fontSize: '1.125rem', padding: '0.75rem' }}
            >
              {submitting ? 'Submitting...' : 'Submit Scores'}
            </button>
          </div>
        </div>
      )}

      {/* Submitted confirmation */}
      {pageState === 'submitted' && selectedJudge && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '1rem' }}>
            <span style={{
              padding: '0.25rem 0.75rem',
              background: '#edf2f7',
              borderRadius: '4px',
              fontSize: '0.875rem',
            }}>
              #{selectedJudge.judgeNumber}: {selectedJudge.name}
            </span>
          </div>

          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#c6f6d5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            fontSize: '1.5rem',
            color: '#276749',
          }}>
            ✓
          </div>

          <h2 style={{ color: '#276749', marginBottom: '0.5rem' }}>Scores Submitted</h2>
          <p style={{ color: '#718096' }}>
            Waiting for the next heat...
          </p>
        </div>
      )}
    </div>
  );
};

export default JudgeScoringPage;
