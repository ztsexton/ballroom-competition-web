import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { judgingApi } from '../api/client';
import { CompetitionSchedule, Event, Couple, Competition, ScheduledHeat } from '../types';
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

  const getHeatCouples = (heat: ScheduledHeat): { eventName: string; couples: Couple[] }[] => {
    return heat.entries.map(entry => {
      const event = events[entry.eventId];
      if (!event) return { eventName: 'Unknown', couples: [] };
      const h = event.heats.find(h => h.round === entry.round);
      if (!h) return { eventName: event.name, couples: [] };
      const bibs = (entry.bibSubset || h.bibs).slice().sort((a, b) => a - b);
      return {
        eventName: event.name,
        couples: bibs.map(bib => couplesByBib[bib]).filter(Boolean),
      };
    });
  };

  const getAllHeatCouples = (heat: ScheduledHeat): Couple[] => {
    const seen = new Set<number>();
    const result: Couple[] = [];
    for (const entry of heat.entries) {
      const event = events[entry.eventId];
      if (!event) continue;
      const h = event.heats.find(h => h.round === entry.round);
      if (!h) continue;
      const bibs = entry.bibSubset || h.bibs;
      for (const bib of bibs) {
        if (!seen.has(bib) && couplesByBib[bib]) {
          seen.add(bib);
          result.push(couplesByBib[bib]);
        }
      }
    }
    return result.sort((a, b) => a.bib - b.bib);
  };

  const currentHeat = schedule.heatOrder[schedule.currentHeatIndex];
  const currentStatus = currentHeat ? (schedule.heatStatuses[currentHeat.id] || 'pending') : 'pending';

  const nextHeat = schedule.heatOrder[schedule.currentHeatIndex + 1];
  const upcomingHeats = schedule.heatOrder.slice(schedule.currentHeatIndex + 2, schedule.currentHeatIndex + 8);

  const completedCount = Object.values(schedule.heatStatuses).filter(s => s === 'completed').length;
  const totalCount = schedule.heatOrder.length;

  const formatTime = (isoString?: string): string => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

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

  const getHeatLabel = (heat: ScheduledHeat): string => {
    if (heat.isBreak) return heat.breakLabel || 'Break';
    const labels = heat.entries.map(entry => {
      const event = events[entry.eventId];
      return event ? formatEventLabel(event) : 'Unknown';
    });
    return labels.join(' + ');
  };

  const getHeatRound = (heat: ScheduledHeat): string => {
    if (heat.entries.length === 0) return '';
    const entry = heat.entries[0];
    let round = formatRound(entry.round);
    if (entry.totalFloorHeats && entry.totalFloorHeats > 1) {
      round += ` (Heat ${(entry.floorHeatIndex ?? 0) + 1} of ${entry.totalFloorHeats})`;
    }
    if (entry.dance) {
      round += ` — ${entry.dance}`;
    }
    return round;
  };

  const renderCoupleList = (heat: ScheduledHeat, bgColor: string = '#f7fafc') => {
    const entryCouples = getHeatCouples(heat);
    const multiEntry = heat.entries.length > 1;
    const totalCouples = entryCouples.reduce((sum, e) => sum + e.couples.length, 0);

    if (totalCouples === 0) {
      return <p style={{ color: '#a0aec0', fontSize: '0.875rem', margin: 0 }}>Couples TBD</p>;
    }

    return (
      <div>
        {entryCouples.map((ec, idx) => (
          <div key={idx} style={{ marginBottom: idx < entryCouples.length - 1 ? '0.5rem' : 0 }}>
            {multiEntry && (
              <strong style={{ fontSize: '0.8rem', color: '#718096', display: 'block', marginBottom: '0.25rem' }}>
                {ec.eventName} ({ec.couples.length}):
              </strong>
            )}
            {!multiEntry && (
              <strong style={{ fontSize: '0.875rem', color: '#718096' }}>
                Couples ({ec.couples.length}):
              </strong>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
              {ec.couples.map(c => (
                <span key={c.bib} style={{
                  padding: '0.25rem 0.5rem',
                  background: bgColor,
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}>
                  <strong>#{c.bib}</strong> {c.leaderName} & {c.followerName}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h3 style={{ margin: 0, color: '#667eea' }}>NOW ON FLOOR</h3>
            {currentHeat?.estimatedStartTime && (
              <span style={{ fontSize: '0.8125rem', color: '#718096' }}>
                {currentHeat.actualStartTime
                  ? `Started ${formatTime(currentHeat.actualStartTime)}`
                  : `Est. ${formatTime(currentHeat.estimatedStartTime)}`}
              </span>
            )}
          </div>
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
        ) : currentHeat.entries.length > 0 ? (
          <div>
            {currentHeat.entries.map(entry => {
              const event = events[entry.eventId];
              if (!event) return null;
              const roundLabel = formatRound(entry.round)
                + (entry.totalFloorHeats && entry.totalFloorHeats > 1 ? ` (Heat ${(entry.floorHeatIndex ?? 0) + 1} of ${entry.totalFloorHeats})` : '')
                + (entry.dance ? ` — ${entry.dance}` : '');
              return (
                <div key={`${entry.eventId}-${entry.floorHeatIndex ?? 0}-${entry.dance ?? ''}`} style={{ marginBottom: '0.25rem' }}>
                  <p style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.125rem' }}>
                    {formatEventLabel(event)}
                  </p>
                  <p style={{ color: '#4a5568', margin: 0 }}>
                    {roundLabel}
                  </p>
                </div>
              );
            })}
            <div style={{ marginTop: '0.75rem' }}>
              {renderCoupleList(currentHeat)}
            </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, color: '#c05621' }}>ON DECK — Get Ready!</h3>
            {nextHeat.estimatedStartTime && (
              <span style={{ fontSize: '0.8125rem', color: '#718096' }}>
                Est. {formatTime(nextHeat.estimatedStartTime)}
              </span>
            )}
          </div>

          {nextHeat.isBreak ? (
            <div>
              <p style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.25rem', fontStyle: 'italic' }}>
                {nextHeat.breakLabel || 'Break'}
              </p>
              {nextHeat.breakDuration && (
                <p style={{ color: '#718096', margin: 0 }}>{nextHeat.breakDuration} minutes</p>
              )}
            </div>
          ) : nextHeat.entries.length > 0 ? (
            <div>
              {nextHeat.entries.map(entry => {
                const event = events[entry.eventId];
                if (!event) return null;
                const nextRoundLabel = formatRound(entry.round)
                  + (entry.totalFloorHeats && entry.totalFloorHeats > 1 ? ` (Heat ${(entry.floorHeatIndex ?? 0) + 1} of ${entry.totalFloorHeats})` : '')
                  + (entry.dance ? ` — ${entry.dance}` : '');
                return (
                  <div key={`${entry.eventId}-${entry.floorHeatIndex ?? 0}-${entry.dance ?? ''}`} style={{ marginBottom: '0.25rem' }}>
                    <p style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.125rem' }}>
                      {formatEventLabel(event)}
                    </p>
                    <p style={{ color: '#4a5568', margin: 0 }}>
                      {nextRoundLabel}
                    </p>
                  </div>
                );
              })}
              <div style={{ marginTop: '0.75rem' }}>
                {renderCoupleList(nextHeat, 'white')}
              </div>
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
              const status = schedule.heatStatuses[heat.id] || 'pending';

              if (heat.isBreak) {
                return (
                  <div key={heat.id + '-' + heatIdx} style={{
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
                      {heat.estimatedStartTime && (
                        <span style={{ color: '#a0aec0', marginLeft: '0.5rem', fontSize: '0.8125rem' }}>
                          {formatTime(heat.estimatedStartTime)}
                        </span>
                      )}
                    </span>
                    {statusBadge(status)}
                  </div>
                );
              }

              const coupleCount = getAllHeatCouples(heat).length;

              return (
                <div key={heat.id + '-' + heatIdx} style={{
                  padding: '0.5rem 0.75rem',
                  background: '#f7fafc',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span>
                    <strong>{heatIdx + 1}.</strong>{' '}
                    {getHeatLabel(heat)} ({getHeatRound(heat)})
                    {coupleCount > 0 && <span style={{ color: '#718096' }}> — {coupleCount} couples</span>}
                    {heat.estimatedStartTime && (
                      <span style={{ color: '#a0aec0', marginLeft: '0.5rem', fontSize: '0.8125rem' }}>
                        {formatTime(heat.estimatedStartTime)}
                      </span>
                    )}
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
