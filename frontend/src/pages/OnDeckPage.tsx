import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { judgingApi } from '../api/client';
import { CompetitionSchedule, Event, Couple, Competition } from '../types';
import { useCompetitionSSE } from '../hooks/useCompetitionSSE';

const OnDeckPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const competitionId = parseInt(id || '0');

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [schedule, setSchedule] = useState<CompetitionSchedule | null>(null);
  const [events, setEvents] = useState<Record<number, Event>>({});
  const [couples, setCouples] = useState<Couple[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    if (!competitionId) return;
    try {
      const [compRes, schedRes, eventsRes, couplesRes] = await Promise.all([
        judgingApi.getCompetition(competitionId),
        judgingApi.getSchedule(competitionId),
        judgingApi.getEvents(competitionId),
        judgingApi.getCouples(competitionId),
      ]);
      setCompetition(compRes.data);
      setSchedule(schedRes.data);
      setEvents(eventsRes.data);
      setCouples(couplesRes.data);
      setError('');
    } catch {
      setError('Failed to load competition data.');
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useCompetitionSSE(competitionId || null, {
    onScheduleUpdate: () => loadData(),
    onScoreUpdate: () => loadData(),
  });

  if (loading) return <div className="loading">Loading...</div>;

  if (error || !schedule) {
    return (
      <div className="container">
        <div className="card">
          <h2>On-Deck Captain</h2>
          <p>{error || 'No schedule found.'}</p>
          <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ marginTop: '1rem' }}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const couplesByBib: Record<number, Couple> = {};
  couples.forEach(c => { couplesByBib[c.bib] = c; });

  const getHeatCouples = (eventId: number, round: string): Couple[] => {
    const event = events[eventId];
    if (!event) return [];
    const heat = event.heats.find(h => h.round === round);
    if (!heat) return [];
    return heat.bibs.map(bib => couplesByBib[bib]).filter(Boolean);
  };

  const currentHeat = schedule.heatOrder[schedule.currentHeatIndex];
  const currentEvent = currentHeat && !currentHeat.isBreak ? events[currentHeat.eventId] : null;
  const heatKey = currentHeat ? `${currentHeat.eventId}:${currentHeat.round}` : '';
  const currentStatus = heatKey ? (schedule.heatStatuses[heatKey] || 'pending') : 'pending';

  const nextHeat = schedule.heatOrder[schedule.currentHeatIndex + 1];
  const nextEvent = nextHeat && !nextHeat.isBreak ? events[nextHeat.eventId] : null;

  const upcomingHeats = schedule.heatOrder.slice(schedule.currentHeatIndex + 2, schedule.currentHeatIndex + 8);

  const completedCount = Object.values(schedule.heatStatuses).filter(s => s === 'completed').length;
  const totalCount = schedule.heatOrder.length;

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      pending: { bg: '#e2e8f0', text: '#4a5568' },
      scoring: { bg: '#fefcbf', text: '#744210' },
      completed: { bg: '#c6f6d5', text: '#276749' },
    };
    const c = colors[status] || colors.pending;
    return (
      <span style={{
        padding: '0.25rem 0.75rem',
        borderRadius: '9999px',
        fontSize: '0.875rem',
        fontWeight: 600,
        background: c.bg,
        color: c.text,
        textTransform: 'uppercase',
      }}>
        {status}
      </span>
    );
  };

  const formatEventLabel = (event: Event) => {
    const parts: string[] = [];
    if (event.style) parts.push(event.style);
    if (event.dances?.length) parts.push(event.dances.join(', '));
    if (event.level) parts.push(event.level);
    return parts.length > 0 ? parts.join(' — ') : event.name;
  };

  const formatRound = (round: string) =>
    round.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div className="container" style={{ maxWidth: '900px' }}>
      {/* Header */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ margin: 0 }}>On-Deck Captain</h2>
          <span style={{ color: '#718096' }}>
            Heat {schedule.currentHeatIndex + 1} of {totalCount} ({completedCount} completed)
          </span>
        </div>
        {competition && (
          <p style={{ color: '#4a5568', margin: '0.5rem 0 0' }}>{competition.name}</p>
        )}
      </div>

      {/* NOW ON FLOOR */}
      <div className="card" style={{
        marginBottom: '1rem',
        borderLeft: '4px solid #667eea',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, color: '#667eea' }}>NOW ON FLOOR</h3>
          {statusBadge(currentStatus)}
        </div>

        {!currentHeat ? (
          <p style={{ color: '#718096' }}>No current heat</p>
        ) : currentHeat.isBreak ? (
          <div>
            <p style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.25rem' }}>
              {currentHeat.breakLabel || 'Break'}
            </p>
            {currentHeat.breakDuration && (
              <p style={{ color: '#718096', margin: 0 }}>{currentHeat.breakDuration} minutes</p>
            )}
          </div>
        ) : currentEvent ? (
          <div>
            <p style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.25rem' }}>
              {formatEventLabel(currentEvent)}
            </p>
            <p style={{ color: '#4a5568', margin: '0 0 0.75rem' }}>
              {formatRound(currentHeat.round)}
            </p>
            {(() => {
              const heatCouples = getHeatCouples(currentHeat.eventId, currentHeat.round);
              return heatCouples.length > 0 ? (
                <div>
                  <strong style={{ fontSize: '0.875rem', color: '#718096' }}>
                    Couples ({heatCouples.length}):
                  </strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                    {heatCouples.map(c => (
                      <span key={c.bib} style={{
                        padding: '0.25rem 0.5rem',
                        background: '#f7fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                      }}>
                        <strong>#{c.bib}</strong> {c.leaderName} & {c.followerName}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p style={{ color: '#a0aec0', fontSize: '0.875rem', margin: 0 }}>Couples TBD</p>
              );
            })()}
          </div>
        ) : (
          <p style={{ color: '#718096' }}>Event not found</p>
        )}
      </div>

      {/* ON DECK */}
      {nextHeat && (
        <div className="card" style={{
          marginBottom: '1rem',
          borderLeft: '4px solid #ed8936',
          background: '#fffaf0',
        }}>
          <h3 style={{ margin: '0 0 0.75rem', color: '#c05621' }}>ON DECK — Get Ready!</h3>

          {nextHeat.isBreak ? (
            <div>
              <p style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.25rem', fontStyle: 'italic' }}>
                {nextHeat.breakLabel || 'Break'}
              </p>
              {nextHeat.breakDuration && (
                <p style={{ color: '#718096', margin: 0 }}>{nextHeat.breakDuration} minutes</p>
              )}
            </div>
          ) : nextEvent ? (
            <div>
              <p style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.25rem' }}>
                {formatEventLabel(nextEvent)}
              </p>
              <p style={{ color: '#4a5568', margin: '0 0 0.75rem' }}>
                {formatRound(nextHeat.round)}
              </p>
              {(() => {
                const heatCouples = getHeatCouples(nextHeat.eventId, nextHeat.round);
                return heatCouples.length > 0 ? (
                  <div>
                    <strong style={{ fontSize: '0.875rem', color: '#718096' }}>
                      Couples ({heatCouples.length}):
                    </strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                      {heatCouples.map(c => (
                        <span key={c.bib} style={{
                          padding: '0.25rem 0.5rem',
                          background: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '4px',
                          fontSize: '0.875rem',
                        }}>
                          <strong>#{c.bib}</strong> {c.leaderName} & {c.followerName}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p style={{ color: '#a0aec0', fontSize: '0.875rem', margin: 0 }}>Couples TBD</p>
                );
              })()}
            </div>
          ) : (
            <p style={{ color: '#718096' }}>Event not found</p>
          )}
        </div>
      )}

      {/* COMING UP */}
      {upcomingHeats.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 0.75rem', color: '#4a5568' }}>COMING UP</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {upcomingHeats.map((heat, idx) => {
              const heatIdx = schedule.currentHeatIndex + 2 + idx;
              const event = heat.isBreak ? null : events[heat.eventId];
              const hk = `${heat.eventId}:${heat.round}`;
              const status = schedule.heatStatuses[hk] || 'pending';

              if (heat.isBreak) {
                return (
                  <div key={hk + '-' + heatIdx} style={{
                    padding: '0.5rem 0.75rem',
                    background: '#fefce8',
                    borderRadius: '4px',
                    fontStyle: 'italic',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span>
                      <strong>{heatIdx + 1}.</strong>{' '}
                      {heat.breakLabel || 'Break'}
                      {heat.breakDuration ? ` — ${heat.breakDuration} min` : ''}
                    </span>
                    {statusBadge(status)}
                  </div>
                );
              }

              if (!event) return null;

              const heatData = event.heats.find(h => h.round === heat.round);
              const coupleCount = heatData?.bibs.length || 0;

              return (
                <div key={hk + '-' + heatIdx} style={{
                  padding: '0.5rem 0.75rem',
                  background: '#f7fafc',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span>
                    <strong>{heatIdx + 1}.</strong>{' '}
                    {formatEventLabel(event)} ({formatRound(heat.round)})
                    {coupleCount > 0 && <span style={{ color: '#718096' }}> — {coupleCount} couples</span>}
                  </span>
                  {statusBadge(status)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>
    </div>
  );
};

export default OnDeckPage;
