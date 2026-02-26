import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { judgingApi } from '../../api/client';
import { CompetitionSchedule, Event, Couple, Competition, ScheduledHeat } from '../../types';
import { useCompetitionSSE } from '../../hooks/useCompetitionSSE';
import { Skeleton } from '../../components/Skeleton';

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

  if (loading) return <Skeleton variant="card" />;

  if (error || !schedule) {
    return (
      <div className="max-w-[900px] mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2>On-Deck Captain</h2>
          <p>{error || 'No schedule found.'}</p>
          <button
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200 mt-4"
            onClick={() => navigate(-1)}
          >
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
    const classes: Record<string, string> = {
      pending: 'bg-gray-200 text-gray-600',
      scoring: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
    };
    const c = classes[status] || classes.pending;
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-semibold uppercase ${c}`}>
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

  const renderCoupleList = (heat: ScheduledHeat, chipBg: string = 'bg-gray-50') => {
    const entryCouples = getHeatCouples(heat);
    const multiEntry = heat.entries.length > 1;
    const totalCouples = entryCouples.reduce((sum, e) => sum + e.couples.length, 0);

    if (totalCouples === 0) {
      return <p className="text-gray-400 text-sm m-0">Couples TBD</p>;
    }

    return (
      <div>
        {entryCouples.map((ec, idx) => (
          <div key={idx} className={idx < entryCouples.length - 1 ? 'mb-2' : ''}>
            {multiEntry && (
              <strong className="text-xs text-gray-500 block mb-1">
                {ec.eventName} ({ec.couples.length}):
              </strong>
            )}
            {!multiEntry && (
              <strong className="text-sm text-gray-500">
                Couples ({ec.couples.length}):
              </strong>
            )}
            <div className="flex flex-wrap gap-2 mt-1">
              {ec.couples.map(c => (
                <span key={c.bib} className={`px-2 py-1 ${chipBg} border border-gray-200 rounded text-sm`}>
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
    <div className="max-w-[900px] mx-auto p-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h2 className="m-0">On-Deck Captain</h2>
          <span className="text-gray-500">
            Heat {schedule.currentHeatIndex + 1} of {totalCount} ({completedCount} completed)
          </span>
        </div>
        {competition && (
          <p className="text-gray-600 mt-2 mb-0">{competition.name}</p>
        )}
      </div>

      {/* NOW ON FLOOR */}
      <div className="bg-white rounded-lg shadow p-6 mb-4 border-l-4 border-primary-500">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <h3 className="m-0 text-primary-500">NOW ON FLOOR</h3>
            {currentHeat?.estimatedStartTime && (
              <span className="text-[0.8125rem] text-gray-500">
                {currentHeat.actualStartTime
                  ? `Started ${formatTime(currentHeat.actualStartTime)}`
                  : `Est. ${formatTime(currentHeat.estimatedStartTime)}`}
              </span>
            )}
          </div>
          {statusBadge(currentStatus)}
        </div>

        {!currentHeat ? (
          <p className="text-gray-500">No current heat</p>
        ) : currentHeat.isBreak ? (
          <div>
            <p className="text-xl font-semibold mb-1 mt-0">
              {currentHeat.breakLabel || 'Break'}
            </p>
            {currentHeat.breakDuration && (
              <p className="text-gray-500 m-0">{currentHeat.breakDuration} minutes</p>
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
                <div key={`${entry.eventId}-${entry.floorHeatIndex ?? 0}-${entry.dance ?? ''}`} className="mb-1">
                  <p className="text-xl font-semibold mt-0 mb-0.5">
                    {formatEventLabel(event)}
                  </p>
                  <p className="text-gray-600 m-0">
                    {roundLabel}
                  </p>
                </div>
              );
            })}
            <div className="mt-3">
              {renderCoupleList(currentHeat)}
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Event not found</p>
        )}
      </div>

      {/* ON DECK */}
      {nextHeat && (
        <div className="bg-white rounded-lg shadow p-6 mb-4 border-l-4 border-orange-500 bg-orange-50">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="m-0 text-orange-700">ON DECK — Get Ready!</h3>
            {nextHeat.estimatedStartTime && (
              <span className="text-[0.8125rem] text-gray-500">
                Est. {formatTime(nextHeat.estimatedStartTime)}
              </span>
            )}
          </div>

          {nextHeat.isBreak ? (
            <div>
              <p className="text-lg font-semibold mb-1 mt-0 italic">
                {nextHeat.breakLabel || 'Break'}
              </p>
              {nextHeat.breakDuration && (
                <p className="text-gray-500 m-0">{nextHeat.breakDuration} minutes</p>
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
                  <div key={`${entry.eventId}-${entry.floorHeatIndex ?? 0}-${entry.dance ?? ''}`} className="mb-1">
                    <p className="text-lg font-semibold mt-0 mb-0.5">
                      {formatEventLabel(event)}
                    </p>
                    <p className="text-gray-600 m-0">
                      {nextRoundLabel}
                    </p>
                  </div>
                );
              })}
              <div className="mt-3">
                {renderCoupleList(nextHeat, 'bg-white')}
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Event not found</p>
          )}
        </div>
      )}

      {/* COMING UP */}
      {upcomingHeats.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h3 className="mt-0 mb-3 text-gray-600">COMING UP</h3>
          <div className="flex flex-col gap-2">
            {upcomingHeats.map((heat, idx) => {
              const heatIdx = schedule.currentHeatIndex + 2 + idx;
              const status = schedule.heatStatuses[heat.id] || 'pending';

              if (heat.isBreak) {
                return (
                  <div key={heat.id + '-' + heatIdx} className="px-3 py-2 bg-yellow-50 rounded flex justify-between items-center italic">
                    <span>
                      <strong>{heatIdx + 1}.</strong>{' '}
                      {heat.breakLabel || 'Break'}
                      {heat.breakDuration ? ` — ${heat.breakDuration} min` : ''}
                      {heat.estimatedStartTime && (
                        <span className="text-gray-400 ml-2 text-[0.8125rem]">
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
                <div key={heat.id + '-' + heatIdx} className="px-3 py-2 bg-gray-50 rounded flex justify-between items-center">
                  <span>
                    <strong>{heatIdx + 1}.</strong>{' '}
                    {getHeatLabel(heat)} ({getHeatRound(heat)})
                    {coupleCount > 0 && <span className="text-gray-500"> — {coupleCount} couples</span>}
                    {heat.estimatedStartTime && (
                      <span className="text-gray-400 ml-2 text-[0.8125rem]">
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

      <div className="text-center mt-4">
        <button
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
      </div>
    </div>
  );
};

export default OnDeckPage;
