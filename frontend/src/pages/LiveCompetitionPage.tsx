import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { judgingApi } from '../api/client';
import { CompetitionSchedule, Event, Competition } from '../types';
import { useCompetitionSSE } from '../hooks/useCompetitionSSE';

const LiveCompetitionPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const competitionId = parseInt(id || '0');

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [schedule, setSchedule] = useState<CompetitionSchedule | null>(null);
  const [events, setEvents] = useState<Record<number, Event>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    if (!competitionId) return;
    try {
      const [compRes, schedRes, eventsRes] = await Promise.all([
        judgingApi.getCompetition(competitionId),
        judgingApi.getSchedule(competitionId),
        judgingApi.getEvents(competitionId),
      ]);
      setCompetition(compRes.data);
      setSchedule(schedRes.data);
      setEvents(eventsRes.data);
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
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
        <div className="card">
          <h2>Live Competition</h2>
          <p>{error || 'No schedule found.'}</p>
          <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ marginTop: '1rem' }}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const currentHeat = schedule.heatOrder[schedule.currentHeatIndex];
  const currentEvent = currentHeat && !currentHeat.isBreak ? events[currentHeat.eventId] : null;
  const heatKey = currentHeat ? `${currentHeat.eventId}:${currentHeat.round}` : '';
  const currentStatus = heatKey ? (schedule.heatStatuses[heatKey] || 'pending') : 'pending';

  const completedCount = Object.values(schedule.heatStatuses).filter(s => s === 'completed').length;
  const totalCount = schedule.heatOrder.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const nextHeat = schedule.heatOrder[schedule.currentHeatIndex + 1];
  const nextEvent = nextHeat && !nextHeat.isBreak ? events[nextHeat.eventId] : null;

  const laterHeats = schedule.heatOrder.slice(schedule.currentHeatIndex + 2, schedule.currentHeatIndex + 6);

  const statusBadge = (status: string, large?: boolean) => {
    const colors: Record<string, { bg: string; text: string }> = {
      pending: { bg: '#e2e8f0', text: '#4a5568' },
      announced: { bg: '#bee3f8', text: '#2a4365' },
      scoring: { bg: '#fefcbf', text: '#744210' },
      completed: { bg: '#c6f6d5', text: '#276749' },
    };
    const c = colors[status] || colors.pending;
    return (
      <span style={{
        padding: large ? '0.375rem 1rem' : '0.25rem 0.75rem',
        borderRadius: '9999px',
        fontSize: large ? '1rem' : '0.75rem',
        fontWeight: 700,
        background: c.bg,
        color: c.text,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
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

  const getCoupleCount = (eventId: number, round: string): number => {
    const event = events[eventId];
    if (!event) return 0;
    const heat = event.heats.find(h => h.round === round);
    return heat?.bibs.length || 0;
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        padding: '0.75rem 1rem',
        background: '#2d3748',
        borderRadius: '8px',
        color: 'white',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>{competition?.name || 'Competition'}</h2>
        </div>
        <span style={{
          padding: '0.25rem 0.75rem',
          background: '#e53e3e',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
        }}>
          LIVE
        </span>
      </div>

      {/* NOW */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '0.75rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        borderLeft: '4px solid #667eea',
      }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#667eea', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
          Now
        </div>

        {!currentHeat ? (
          <p style={{ color: '#718096', fontSize: '1.125rem', margin: 0 }}>Waiting to start...</p>
        ) : currentHeat.isBreak ? (
          <div>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem' }}>
              {currentHeat.breakLabel || 'Break'}
            </p>
            {currentHeat.breakDuration && (
              <p style={{ color: '#718096', margin: '0 0 0.5rem', fontSize: '1rem' }}>
                {currentHeat.breakDuration} minutes
              </p>
            )}
            {statusBadge(currentStatus, true)}
          </div>
        ) : currentEvent ? (
          <div>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem', lineHeight: 1.2 }}>
              {formatEventLabel(currentEvent)}
            </p>
            <p style={{ fontSize: '1rem', color: '#4a5568', margin: '0 0 0.5rem' }}>
              {formatRound(currentHeat.round)}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {statusBadge(currentStatus, true)}
              <span style={{ color: '#718096', fontSize: '0.875rem' }}>
                {getCoupleCount(currentHeat.eventId, currentHeat.round)} couples
              </span>
            </div>
          </div>
        ) : (
          <p style={{ color: '#718096', margin: 0 }}>Unknown event</p>
        )}
      </div>

      {/* UP NEXT */}
      {nextHeat && (
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          marginBottom: '0.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #ed8936',
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#c05621', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            Up Next
          </div>

          {nextHeat.isBreak ? (
            <div>
              <p style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0, fontStyle: 'italic' }}>
                {nextHeat.breakLabel || 'Break'}
                {nextHeat.breakDuration ? ` — ${nextHeat.breakDuration} min` : ''}
              </p>
            </div>
          ) : nextEvent ? (
            <div>
              <p style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.125rem' }}>
                {formatEventLabel(nextEvent)}
              </p>
              <p style={{ color: '#718096', margin: 0, fontSize: '0.875rem' }}>
                {formatRound(nextHeat.round)}
                {' · '}
                {getCoupleCount(nextHeat.eventId, nextHeat.round)} couples
              </p>
            </div>
          ) : (
            <p style={{ color: '#718096', margin: 0 }}>Unknown event</p>
          )}
        </div>
      )}

      {/* COMING UP */}
      {laterHeats.length > 0 && (
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          marginBottom: '0.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            Coming Up
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {laterHeats.map((heat, idx) => {
              const event = heat.isBreak ? null : events[heat.eventId];
              const hk = `${heat.eventId}:${heat.round}`;

              if (heat.isBreak) {
                return (
                  <div key={hk + '-' + idx} style={{
                    padding: '0.5rem 0',
                    borderBottom: idx < laterHeats.length - 1 ? '1px solid #edf2f7' : undefined,
                    fontStyle: 'italic',
                    color: '#718096',
                  }}>
                    {heat.breakLabel || 'Break'}
                    {heat.breakDuration ? ` — ${heat.breakDuration} min` : ''}
                  </div>
                );
              }

              if (!event) return null;

              const coupleCount = getCoupleCount(heat.eventId, heat.round);

              return (
                <div key={hk + '-' + idx} style={{
                  padding: '0.5rem 0',
                  borderBottom: idx < laterHeats.length - 1 ? '1px solid #edf2f7' : undefined,
                }}>
                  <span style={{ fontWeight: 500 }}>{formatEventLabel(event)}</span>
                  <span style={{ color: '#a0aec0', marginLeft: '0.5rem', fontSize: '0.875rem' }}>
                    {formatRound(heat.round)}
                    {coupleCount > 0 && ` · ${coupleCount}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Progress */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem', color: '#718096' }}>Progress</span>
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{completedCount} of {totalCount} heats</span>
        </div>
        <div style={{
          width: '100%',
          height: '8px',
          background: '#e2e8f0',
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${progressPercent}%`,
            height: '100%',
            background: '#667eea',
            borderRadius: '4px',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <button
          className="btn btn-secondary"
          onClick={() => navigate(-1)}
          style={{ fontSize: '0.875rem' }}
        >
          Back
        </button>
      </div>
    </div>
  );
};

export default LiveCompetitionPage;
