import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { schedulesApi, eventsApi, couplesApi, judgesApi } from '../api/client';
import { CompetitionSchedule, Event, Couple, Judge } from '../types';
import { useAuth } from '../context/AuthContext';

const RunCompetitionPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const competitionId = parseInt(id || '0');

  const [schedule, setSchedule] = useState<CompetitionSchedule | null>(null);
  const [events, setEvents] = useState<Record<number, Event>>({});
  const [couples, setCouples] = useState<Couple[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const handleJump = async (heatIndex: number) => {
    try {
      const res = await schedulesApi.jump(competitionId, heatIndex);
      setSchedule(res.data);
    } catch {
      setError('Failed to jump to heat');
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
  const currentEvent = currentScheduledHeat ? events[currentScheduledHeat.eventId] : undefined;
  const currentRound = currentScheduledHeat?.round || '';
  const heatKey = currentScheduledHeat ? `${currentScheduledHeat.eventId}:${currentScheduledHeat.round}` : '';
  const currentStatus = heatKey ? (schedule.heatStatuses[heatKey] || 'pending') : 'pending';

  const completedCount = Object.values(schedule.heatStatuses).filter(s => s === 'completed').length;
  const totalCount = schedule.heatOrder.length;
  const allCompleted = completedCount === totalCount;

  const getCouplesForHeat = (event: Event, round: string): Couple[] => {
    const heat = event.heats.find(h => h.round === round);
    if (!heat) return [];
    return couples.filter(c => heat.bibs.includes(c.bib));
  };

  const getJudgesForHeat = (event: Event, round: string): Judge[] => {
    const heat = event.heats.find(h => h.round === round);
    if (!heat) return [];
    return judges.filter(j => heat.judges.includes(j.id));
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#e2e8f0';
      case 'announced': return '#bee3f8';
      case 'scoring': return '#fefcbf';
      case 'completed': return '#c6f6d5';
      default: return '#e2e8f0';
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '○';
      case 'announced': return '◐';
      case 'scoring': return '◑';
      case 'completed': return '●';
      default: return '○';
    }
  };

  // Upcoming heats (next 3 after current)
  const upcomingHeats = schedule.heatOrder
    .slice(schedule.currentHeatIndex + 1, schedule.currentHeatIndex + 4);

  const currentCouples = currentEvent ? getCouplesForHeat(currentEvent, currentRound) : [];
  const currentJudges = currentEvent ? getJudgesForHeat(currentEvent, currentRound) : [];
  const coupleCountLabel = currentCouples.length > 0 ? `${currentCouples.length} couples` : 'TBD';
  const judgeCountLabel = currentJudges.length > 0 ? `${currentJudges.length} judges` : '';

  return (
    <div className="container">
      {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Progress Bar */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <strong>Progress</strong>
          <span>Heat {schedule.currentHeatIndex + 1} of {totalCount} ({completedCount} completed)</span>
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
          ) : currentEvent ? (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ marginBottom: '0.25rem' }}>
                    Event #{currentEvent.id}: {currentEvent.name}
                  </h2>
                  <p style={{ color: '#4a5568', fontSize: '1rem', fontWeight: 600, textTransform: 'capitalize', margin: '0.25rem 0' }}>
                    Round: {currentRound}
                  </p>
                  <p style={{ color: '#718096', fontSize: '0.875rem' }}>
                    {[
                      currentEvent.style,
                      currentEvent.level,
                      currentEvent.designation,
                      currentEvent.dances?.join(', '),
                    ].filter(Boolean).join(' | ') || 'No details'}
                  </p>
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
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <p style={{ fontSize: '1.125rem', color: '#718096', marginBottom: '1rem' }}>
                      Ready to announce this heat
                    </p>
                    <p style={{ color: '#a0aec0', marginBottom: '1.5rem' }}>
                      {coupleCountLabel}{judgeCountLabel ? `, ${judgeCountLabel}` : ''}
                    </p>
                    <button className="btn btn-success" onClick={handleAdvance} style={{ fontSize: '1.125rem', padding: '0.75rem 2rem' }}>
                      Announce Heat
                    </button>
                  </div>
                )}

                {currentStatus === 'announced' && (
                  <>
                    <h3 style={{ marginBottom: '0.75rem' }}>Couples</h3>
                    {currentCouples.length > 0 ? (
                      <table>
                        <thead>
                          <tr>
                            <th>Bib #</th>
                            <th>Leader</th>
                            <th>Follower</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentCouples.map(couple => (
                            <tr key={couple.bib}>
                              <td><strong>#{couple.bib}</strong></td>
                              <td>{couple.leaderName}</td>
                              <td>{couple.followerName}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <p style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Scoring in progress</p>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <Link
                        to={`/events/${currentEvent.id}/score/${currentRound}`}
                        className="btn"
                        style={{ fontSize: '1.125rem', padding: '0.75rem 2rem' }}
                      >
                        Open Scoring Page
                      </Link>
                      <button className="btn btn-success" onClick={handleAdvance} style={{ fontSize: '1.125rem', padding: '0.75rem 2rem' }}>
                        Mark Complete
                      </button>
                    </div>
                  </div>
                )}

                {currentStatus === 'completed' && (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <p style={{ fontSize: '1.125rem', color: '#276749', marginBottom: '1rem' }}>Heat completed</p>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <Link
                        to={`/events/${currentEvent.id}/results/${currentRound}`}
                        className="btn btn-secondary"
                      >
                        View Results
                      </Link>
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
                const event = events[scheduledHeat.eventId];
                if (!event) return null;
                const heatCouples = getCouplesForHeat(event, scheduledHeat.round);
                return (
                  <div key={`${scheduledHeat.eventId}:${scheduledHeat.round}`} style={{
                    padding: '0.5rem 0',
                    borderBottom: idx < upcomingHeats.length - 1 ? '1px solid #e2e8f0' : undefined,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <strong>{event.name}</strong>
                      <p style={{ color: '#718096', fontSize: '0.875rem', margin: 0, textTransform: 'capitalize' }}>
                        {scheduledHeat.round} | {[event.style, event.level].filter(Boolean).join(' - ') || 'No details'}
                      </p>
                    </div>
                    <span style={{ color: '#a0aec0', fontSize: '0.875rem' }}>
                      {heatCouples.length > 0 ? `${heatCouples.length} couples` : 'TBD'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Heat Sidebar */}
        <div className="card" style={{ alignSelf: 'start', maxHeight: '80vh', overflowY: 'auto' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>All Heats</h3>
          {schedule.heatOrder.map((scheduledHeat, idx) => {
            const event = events[scheduledHeat.eventId];
            if (!event) return null;
            const key = `${scheduledHeat.eventId}:${scheduledHeat.round}`;
            const status = schedule.heatStatuses[key] || 'pending';
            const isCurrent = idx === schedule.currentHeatIndex;

            return (
              <div
                key={key + '-' + idx}
                onClick={() => handleJump(idx)}
                style={{
                  padding: '0.5rem',
                  marginBottom: '0.25rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: isCurrent ? '#ebf8ff' : 'transparent',
                  border: isCurrent ? '1px solid #90cdf4' : '1px solid transparent',
                  transition: 'background 0.15s',
                }}
                onMouseOver={(e) => { if (!isCurrent) e.currentTarget.style.background = '#f7fafc'; }}
                onMouseOut={(e) => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
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
                    textTransform: 'capitalize',
                  }}>
                    {idx + 1}. {event.name} ({scheduledHeat.round})
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RunCompetitionPage;
