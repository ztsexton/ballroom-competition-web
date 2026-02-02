import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { schedulesApi, eventsApi, couplesApi, judgesApi, judgingApi } from '../api/client';
import { CompetitionSchedule, Event, Couple, Judge, ScoringProgress, ScheduledHeat } from '../types';
import { useAuth } from '../context/AuthContext';
import { useCompetitionSSE } from '../hooks/useCompetitionSSE';

/* Inline scoring progress panel shown when a heat is in "scoring" status */
const ScoringProgressPanel = ({
  scoringProgress,
  onLoadProgress,
  onAdvance,
  couples,
  events,
}: {
  scoringProgress: ScoringProgress | null;
  onLoadProgress: () => void;
  onAdvance: () => void;
  couples: Couple[];
  events: Record<number, Event>;
}) => {
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
              #{judge.judgeNumber}: {judge.judgeName} {judge.hasSubmitted ? '✓' : '…'}
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
              // Per-dance score tables for multi-dance events
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
              // Single-dance score table
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
};

const RunCompetitionPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const competitionId = parseInt(id || '0');

  const [schedule, setSchedule] = useState<CompetitionSchedule | null>(null);
  const [events, setEvents] = useState<Record<number, Event>>({});
  const [couples, setCouples] = useState<Couple[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [scoringProgress, setScoringProgress] = useState<ScoringProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resetTargetIndex, setResetTargetIndex] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!competitionId) return;

    try {
      const [schedRes, eventsRes, couplesRes, judgesRes] = await Promise.all([
        schedulesApi.get(competitionId),
        eventsApi.getAll(competitionId),
        couplesApi.getAll(competitionId),
        judgesApi.getAll(competitionId),
      ]);
      setSchedule(schedRes.data);
      setEvents(eventsRes.data);
      setCouples(couplesRes.data);
      setJudges(judgesRes.data);
      setError('');
    } catch {
      setError('Failed to load competition data. Make sure a schedule has been generated.');
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  const loadScoringProgress = useCallback(async () => {
    if (!competitionId) return;
    try {
      const res = await judgingApi.getScoringProgress(competitionId);
      setScoringProgress(res.data);
    } catch {
      setScoringProgress(null);
    }
  }, [competitionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // SSE: real-time updates
  useCompetitionSSE(competitionId || null, {
    onScoreUpdate: () => {
      loadScoringProgress();
    },
    onScheduleUpdate: () => {
      loadData();
    },
  });

  const handleAdvance = async () => {
    try {
      const res = await schedulesApi.advance(competitionId);
      setSchedule(res.data);
    } catch {
      setError('Failed to advance');
    }
  };

  const handleBack = async () => {
    try {
      const res = await schedulesApi.back(competitionId);
      setSchedule(res.data);
    } catch {
      setError('Failed to go back');
    }
  };

  const handleAdvanceDance = async () => {
    try {
      const res = await schedulesApi.advanceDance(competitionId);
      setSchedule(res.data);
    } catch {
      setError('Failed to advance dance');
    }
  };

  const handleBackDance = async () => {
    try {
      const res = await schedulesApi.backDance(competitionId);
      setSchedule(res.data);
    } catch {
      setError('Failed to go back dance');
    }
  };

  const handleJump = async (heatIndex: number) => {
    try {
      const res = await schedulesApi.jump(competitionId, heatIndex);
      setSchedule(res.data);
    } catch {
      setError('Failed to jump to heat');
    }
  };

  const handleReset = async () => {
    if (resetTargetIndex === null) return;
    try {
      const res = await schedulesApi.reset(competitionId, resetTargetIndex);
      setSchedule(res.data);
      setResetTargetIndex(null);
    } catch {
      setError('Failed to reset to heat');
      setResetTargetIndex(null);
    }
  };

  const handleRerun = async () => {
    if (resetTargetIndex === null) return;
    try {
      const res = await schedulesApi.rerun(competitionId, resetTargetIndex);
      setSchedule(res.data);
      setResetTargetIndex(null);
    } catch {
      setError('Failed to re-run heat');
      setResetTargetIndex(null);
    }
  };

  if (loading || authLoading) return <div className="loading">Loading...</div>;

  if (!isAdmin) {
    return (
      <div className="container">
        <div className="card">
          <h2>Access Denied</h2>
          <p>You must be an admin to run competitions.</p>
        </div>
      </div>
    );
  }

  if (!schedule || Object.keys(events).length === 0) {
    return (
      <div className="container">
        <div className="card">
          <h2>Run Competition</h2>
          <p>{error || 'No schedule found. Generate a schedule first.'}</p>
          <button className="btn btn-secondary" onClick={() => navigate(`/competitions/${competitionId}/schedule`)} style={{ marginTop: '1rem' }}>
            Go to Schedule
          </button>
        </div>
      </div>
    );
  }

  const currentScheduledHeat = schedule.heatOrder[schedule.currentHeatIndex];
  const isCurrentBreak = currentScheduledHeat?.isBreak === true;
  const currentStatus = currentScheduledHeat ? (schedule.heatStatuses[currentScheduledHeat.id] || 'pending') : 'pending';

  const completedCount = Object.values(schedule.heatStatuses).filter(s => s === 'completed').length;
  const totalCount = schedule.heatOrder.length;
  const allCompleted = completedCount === totalCount;

  const getCouplesForHeat = (heat: ScheduledHeat): Couple[] => {
    const seen = new Set<number>();
    const result: Couple[] = [];
    for (const entry of heat.entries) {
      const event = events[entry.eventId];
      if (!event) continue;
      const h = event.heats.find(h => h.round === entry.round);
      if (!h) continue;
      for (const bib of h.bibs) {
        if (!seen.has(bib)) {
          seen.add(bib);
          const couple = couples.find(c => c.bib === bib);
          if (couple) result.push(couple);
        }
      }
    }
    return result;
  };

  const getJudgesForHeat = (heat: ScheduledHeat): Judge[] => {
    const judgeIds = new Set<number>();
    for (const entry of heat.entries) {
      const event = events[entry.eventId];
      if (!event) continue;
      const h = event.heats.find(h => h.round === entry.round);
      if (!h) continue;
      h.judges.forEach(j => judgeIds.add(j));
    }
    return judges.filter(j => judgeIds.has(j.id)).sort((a, b) => a.judgeNumber - b.judgeNumber);
  };

  const getHeatLabel = (heat: ScheduledHeat): string => {
    if (heat.isBreak) return heat.breakLabel || 'Break';
    const labels = heat.entries.map(entry => {
      const event = events[entry.eventId];
      return event ? event.name : 'Unknown';
    });
    if (labels.length === 1) return labels[0];
    return labels.join(' + ');
  };

  const getHeatRound = (heat: ScheduledHeat): string => {
    if (heat.entries.length === 0) return '';
    return heat.entries[0].round;
  };

  const formatTime = (isoString?: string): string => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#e2e8f0';
      case 'scoring': return '#fefcbf';
      case 'completed': return '#c6f6d5';
      default: return '#e2e8f0';
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '○';
      case 'scoring': return '◑';
      case 'completed': return '●';
      default: return '○';
    }
  };

  // Upcoming heats (next 3 after current)
  const upcomingHeats = schedule.heatOrder
    .slice(schedule.currentHeatIndex + 1, schedule.currentHeatIndex + 4);

  const currentCouples = currentScheduledHeat && !isCurrentBreak ? getCouplesForHeat(currentScheduledHeat) : [];
  const currentJudges = currentScheduledHeat && !isCurrentBreak ? getJudgesForHeat(currentScheduledHeat) : [];

  // Multi-dance: get dance list and current dance from schedule
  const heatDances: string[] = (() => {
    if (!currentScheduledHeat || isCurrentBreak) return [];
    const result: string[] = [];
    const seen = new Set<string>();
    for (const entry of currentScheduledHeat.entries) {
      const event = events[entry.eventId];
      if (event?.dances && event.dances.length > 1) {
        for (const d of event.dances) {
          if (!seen.has(d)) { seen.add(d); result.push(d); }
        }
      }
    }
    return result;
  })();
  const isMultiDanceHeat = heatDances.length > 0;
  const currentDance = schedule?.currentDance;
  const currentDanceIndex = currentDance ? heatDances.indexOf(currentDance) : 0;
  const isFirstDance = currentDanceIndex <= 0;
  const isLastDance = currentDanceIndex >= heatDances.length - 1;

  return (
    <div className="container">
      {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Progress Bar */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <strong>Progress</strong>
          <span>
            Heat {schedule.currentHeatIndex + 1} of {totalCount} ({completedCount} completed)
            {(() => {
              const lastHeat = schedule.heatOrder[schedule.heatOrder.length - 1];
              if (lastHeat?.estimatedStartTime && lastHeat?.estimatedDurationSeconds) {
                const finish = new Date(new Date(lastHeat.estimatedStartTime).getTime() + lastHeat.estimatedDurationSeconds * 1000);
                return <span style={{ marginLeft: '0.5rem', color: '#718096' }}>· Est. finish {formatTime(finish.toISOString())}</span>;
              }
              return null;
            })()}
          </span>
        </div>
        <div style={{
          width: '100%',
          height: '8px',
          background: '#e2e8f0',
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${(completedCount / totalCount) * 100}%`,
            height: '100%',
            background: '#48bb78',
            borderRadius: '4px',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Main Content: Current Heat + Sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1rem' }}>
        {/* Current Heat Panel */}
        <div>
          {allCompleted ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <h2 style={{ color: '#276749' }}>Competition Complete!</h2>
              <p style={{ color: '#718096', marginTop: '0.5rem' }}>All {totalCount} heats have been completed.</p>
              <button className="btn" onClick={() => navigate(`/competitions/${competitionId}/schedule`)} style={{ marginTop: '1rem' }}>
                Back to Schedule
              </button>
            </div>
          ) : isCurrentBreak ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <h2 style={{ marginBottom: '0.5rem' }}>
                {currentScheduledHeat?.breakLabel || 'Break'}
              </h2>
              {currentScheduledHeat?.breakDuration && (
                <p style={{ color: '#718096', fontSize: '1.125rem', marginBottom: '1rem' }}>
                  Duration: {currentScheduledHeat.breakDuration} minutes
                </p>
              )}
              <p style={{ color: '#a0aec0', marginBottom: '1.5rem' }}>
                {currentStatus === 'completed' ? 'Break completed' : 'Break in progress'}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={handleBack}
                  disabled={schedule.currentHeatIndex === 0 && currentStatus === 'pending'}>
                  Back
                </button>
                {currentStatus !== 'completed' ? (
                  <button className="btn btn-success" onClick={handleAdvance}
                    style={{ fontSize: '1.125rem', padding: '0.75rem 2rem' }}>
                    End Break
                  </button>
                ) : schedule.currentHeatIndex < totalCount - 1 ? (
                  <button className="btn btn-success" onClick={handleAdvance}
                    style={{ fontSize: '1.125rem', padding: '0.75rem 2rem' }}>
                    Next Heat
                  </button>
                ) : null}
              </div>
            </div>
          ) : currentScheduledHeat && currentScheduledHeat.entries.length > 0 ? (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  {currentScheduledHeat.entries.map(entry => {
                    const event = events[entry.eventId];
                    if (!event) return null;
                    return (
                      <div key={entry.eventId} style={{ marginBottom: '0.25rem' }}>
                        <h2 style={{ marginBottom: '0.125rem' }}>
                          Event #{event.id}: {event.name}
                        </h2>
                        <p style={{ color: '#718096', fontSize: '0.875rem', margin: 0 }}>
                          {[
                            event.style,
                            event.level,
                            event.designation,
                            event.dances?.join(', '),
                          ].filter(Boolean).join(' | ') || 'No details'}
                        </p>
                      </div>
                    );
                  })}
                  <p style={{ color: '#4a5568', fontSize: '1rem', fontWeight: 600, textTransform: 'capitalize', margin: '0.25rem 0' }}>
                    Round: {getHeatRound(currentScheduledHeat)}
                  </p>
                  {(currentScheduledHeat.estimatedStartTime || currentScheduledHeat.actualStartTime) && (
                    <p style={{ color: '#718096', fontSize: '0.875rem', margin: '0.125rem 0' }}>
                      {currentScheduledHeat.estimatedStartTime && (
                        <span>Est. {formatTime(currentScheduledHeat.estimatedStartTime)}</span>
                      )}
                      {currentScheduledHeat.actualStartTime && (
                        <span style={{ marginLeft: currentScheduledHeat.estimatedStartTime ? '0.75rem' : 0 }}>
                          Started {formatTime(currentScheduledHeat.actualStartTime)}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <span style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  background: statusColor(currentStatus),
                  textTransform: 'capitalize',
                }}>
                  {currentStatus}
                </span>
              </div>

              {/* State-dependent content */}
              <div style={{ marginTop: '1.5rem' }}>
                {currentStatus === 'pending' && (
                  <>
                    <h3 style={{ marginBottom: '0.75rem' }}>Couples</h3>
                    {currentCouples.length > 0 ? (
                      currentScheduledHeat.entries.map(entry => {
                        const event = events[entry.eventId];
                        if (!event) return null;
                        const heat = event.heats.find(h => h.round === entry.round);
                        const entryCouples = heat
                          ? heat.bibs.map(bib => couples.find(c => c.bib === bib)).filter(Boolean) as Couple[]
                          : [];
                        return (
                          <div key={entry.eventId} style={{ marginBottom: currentScheduledHeat.entries.length > 1 ? '1rem' : 0 }}>
                            {currentScheduledHeat.entries.length > 1 && (
                              <h4 style={{ margin: '0 0 0.5rem', color: '#4a5568', fontSize: '0.875rem' }}>
                                {event.name} ({entryCouples.length})
                              </h4>
                            )}
                            <table>
                              <thead>
                                <tr>
                                  <th>Bib #</th>
                                  <th>Leader</th>
                                  <th>Follower</th>
                                </tr>
                              </thead>
                              <tbody>
                                {entryCouples.map(couple => (
                                  <tr key={couple.bib}>
                                    <td><strong>#{couple.bib}</strong></td>
                                    <td>{couple.leaderName}</td>
                                    <td>{couple.followerName}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })
                    ) : (
                      <p style={{ color: '#a0aec0' }}>Couples TBD (previous round not yet scored)</p>
                    )}

                    {currentJudges.length > 0 && (
                      <div style={{ marginTop: '1rem' }}>
                        <h3 style={{ marginBottom: '0.5rem' }}>Judges</h3>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {currentJudges.map(judge => (
                            <span key={judge.id} style={{
                              padding: '0.25rem 0.75rem',
                              background: '#edf2f7',
                              borderRadius: '4px',
                              fontSize: '0.875rem',
                            }}>
                              #{judge.judgeNumber}: {judge.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                      <button className="btn btn-success" onClick={handleAdvance} style={{ fontSize: '1.125rem', padding: '0.75rem 2rem' }}>
                        Begin Scoring
                      </button>
                    </div>
                  </>
                )}

                {currentStatus === 'scoring' && (
                  <>
                    {/* Dance navigation for multi-dance heats */}
                    {isMultiDanceHeat && currentDance && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        background: '#eef2ff',
                        border: '2px solid #667eea',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                      }}>
                        <button
                          className="btn btn-secondary"
                          onClick={handleBackDance}
                          disabled={isFirstDance}
                          style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                        >
                          Prev Dance
                        </button>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: '1.125rem', color: '#4338ca' }}>
                            {currentDance}
                          </p>
                          <p style={{ margin: 0, fontSize: '0.8rem', color: '#6366f1' }}>
                            Dance {currentDanceIndex + 1} of {heatDances.length}
                          </p>
                        </div>
                        <button
                          className="btn"
                          onClick={handleAdvanceDance}
                          disabled={isLastDance}
                          style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: isLastDance ? '#a0aec0' : '#667eea', borderColor: isLastDance ? '#a0aec0' : '#667eea' }}
                        >
                          Next Dance
                        </button>
                      </div>
                    )}
                    <ScoringProgressPanel
                      scoringProgress={scoringProgress}
                      onLoadProgress={loadScoringProgress}
                      onAdvance={handleAdvance}
                      couples={couples}
                      events={events}
                    />
                  </>
                )}

                {currentStatus === 'completed' && (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <p style={{ fontSize: '1.125rem', color: '#276749', marginBottom: '1rem' }}>Heat completed</p>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                      {currentScheduledHeat.entries.length === 1 && (
                        <Link
                          to={`/events/${currentScheduledHeat.entries[0].eventId}/results/${currentScheduledHeat.entries[0].round}`}
                          className="btn btn-secondary"
                        >
                          View Results
                        </Link>
                      )}
                      {schedule.currentHeatIndex < totalCount - 1 && (
                        <button className="btn btn-success" onClick={handleAdvance} style={{ fontSize: '1.125rem', padding: '0.75rem 2rem' }}>
                          Next Heat
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation buttons */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '1.5rem',
                paddingTop: '1rem',
                borderTop: '1px solid #e2e8f0',
              }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleBack}
                  disabled={schedule.currentHeatIndex === 0 && currentStatus === 'pending'}
                >
                  Back
                </button>
                <button className="btn btn-secondary" onClick={() => navigate(`/competitions/${competitionId}/schedule`)}>
                  Back to Schedule
                </button>
              </div>
            </div>
          ) : null}

          {/* Up Next */}
          {upcomingHeats.length > 0 && !allCompleted && (
            <div className="card">
              <h3>Up Next</h3>
              {upcomingHeats.map((scheduledHeat, idx) => {
                const isBreak = scheduledHeat.isBreak;
                const heatNum = schedule.currentHeatIndex + 2 + idx;
                return (
                  <div key={scheduledHeat.id + '-' + idx} style={{
                    padding: '0.5rem 0',
                    borderBottom: idx < upcomingHeats.length - 1 ? '1px solid #e2e8f0' : undefined,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <strong style={{ fontStyle: isBreak ? 'italic' : undefined }}>
                        <span style={{ color: '#a0aec0', fontWeight: 400, fontSize: '0.8rem', marginRight: '0.5rem' }}>#{heatNum}</span>
                        {isBreak ? (scheduledHeat.breakLabel || 'Break') : getHeatLabel(scheduledHeat)}
                      </strong>
                      <p style={{ color: '#718096', fontSize: '0.875rem', margin: 0, textTransform: 'capitalize' }}>
                        {isBreak
                          ? (scheduledHeat.breakDuration ? `${scheduledHeat.breakDuration} min` : 'Break')
                          : `${getHeatRound(scheduledHeat)} | ${scheduledHeat.entries.map(e => {
                              const ev = events[e.eventId];
                              return ev ? [ev.style, ev.level].filter(Boolean).join(' - ') : '';
                            }).filter(Boolean).join(', ') || 'No details'}`}
                        {scheduledHeat.estimatedStartTime && (
                          <span style={{ marginLeft: '0.5rem', textTransform: 'none' }}>
                            · {formatTime(scheduledHeat.estimatedStartTime)}
                          </span>
                        )}
                      </p>
                    </div>
                    {!isBreak && (
                      <span style={{ color: '#a0aec0', fontSize: '0.875rem' }}>
                        {getCouplesForHeat(scheduledHeat).length > 0
                          ? `${getCouplesForHeat(scheduledHeat).length} couples`
                          : 'TBD'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Heat Sidebar */}
        <div className="card" style={{ alignSelf: 'start', maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>All Heats</h3>
          {schedule.heatOrder.map((scheduledHeat, idx) => {
            const isBreak = scheduledHeat.isBreak;
            const status = schedule.heatStatuses[scheduledHeat.id] || 'pending';
            const isCurrent = idx === schedule.currentHeatIndex;

            return (
              <div
                key={scheduledHeat.id + '-' + idx}
                onClick={() => handleJump(idx)}
                style={{
                  padding: '0.5rem',
                  marginBottom: '0.25rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: isCurrent ? '#ebf8ff' : isBreak ? '#fefce8' : 'transparent',
                  border: isCurrent ? '1px solid #90cdf4' : '1px solid transparent',
                  transition: 'background 0.15s',
                }}
                onMouseOver={(e) => { if (!isCurrent) e.currentTarget.style.background = isBreak ? '#fef9c3' : '#f7fafc'; }}
                onMouseOut={(e) => { if (!isCurrent) e.currentTarget.style.background = isCurrent ? '#ebf8ff' : isBreak ? '#fefce8' : 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: statusColor(status) === '#c6f6d5' ? '#276749' : '#718096' }}>
                    {statusIcon(status)}
                  </span>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: isCurrent ? 600 : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontStyle: isBreak ? 'italic' : undefined,
                    flex: 1,
                  }}>
                    {idx + 1}. {isBreak
                      ? (scheduledHeat.breakLabel || 'Break')
                      : `${getHeatLabel(scheduledHeat)} (${getHeatRound(scheduledHeat)})`}
                    {scheduledHeat.estimatedStartTime && (
                      <span style={{ color: '#a0aec0', fontSize: '0.7rem', marginLeft: '0.25rem' }}>
                        {formatTime(scheduledHeat.estimatedStartTime)}
                      </span>
                    )}
                  </span>
                  {(status === 'completed' || status === 'scoring') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setResetTargetIndex(idx);
                      }}
                      title="Reset to this heat"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0.125rem 0.25rem',
                        fontSize: '0.7rem',
                        color: '#e53e3e',
                        opacity: 0.6,
                        flexShrink: 0,
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; }}
                      onMouseOut={(e) => { e.currentTarget.style.opacity = '0.6'; }}
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reset/re-run confirmation modal */}
      {resetTargetIndex !== null && (() => {
        const targetHeat = schedule.heatOrder[resetTargetIndex];
        const targetLabel = targetHeat?.isBreak
          ? (targetHeat.breakLabel || 'Break')
          : getHeatLabel(targetHeat) + ` (${getHeatRound(targetHeat)})`;
        const heatsAffected = Math.max(0, schedule.currentHeatIndex - resetTargetIndex);

        return (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}>
            <div style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '8px',
              maxWidth: '520px',
              width: '90%',
            }}>
              <h3 style={{ color: '#e53e3e', marginTop: 0, marginBottom: '0.5rem' }}>
                Reset: {targetLabel}
              </h3>
              <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                Choose how to handle this heat. Scores will be permanently cleared.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {/* Re-run this heat only */}
                <button
                  className="btn"
                  style={{ background: '#dd6b20', borderColor: '#dd6b20', textAlign: 'left', padding: '0.75rem 1rem' }}
                  onClick={handleRerun}
                >
                  <strong>Re-run this heat only</strong>
                  <br />
                  <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Clear scores for this heat and jump to it. All other results are kept.
                  </span>
                </button>

                {/* Reset to this heat */}
                {heatsAffected > 0 && (
                  <button
                    className="btn"
                    style={{ background: '#e53e3e', borderColor: '#e53e3e', textAlign: 'left', padding: '0.75rem 1rem' }}
                    onClick={handleReset}
                  >
                    <strong>Reset to this heat</strong>
                    <br />
                    <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                      Clear scores for this heat and the {heatsAffected} heat{heatsAffected !== 1 ? 's' : ''} after
                      it (through the current position). Earlier results are kept.
                    </span>
                  </button>
                )}
              </div>

              <button
                className="btn btn-secondary"
                onClick={() => setResetTargetIndex(null)}
                style={{ width: '100%' }}
              >
                Cancel
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default RunCompetitionPage;
