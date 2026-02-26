import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { judgingApi } from '../../api/client';
import { CompetitionSchedule, Event, Competition, ScheduledHeat } from '../../types';
import { useCompetitionSSE } from '../../hooks/useCompetitionSSE';
import { Skeleton } from '../../components/Skeleton';

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

  if (loading) return <Skeleton variant="card" />;

  if (error || !schedule) {
    return (
      <div className="max-w-[600px] mx-auto p-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h2>Live Competition</h2>
          <p>{error || 'No schedule found.'}</p>
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200 mt-4" onClick={() => navigate(-1)}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const currentHeat = schedule.heatOrder[schedule.currentHeatIndex];
  const currentStatus = currentHeat ? (schedule.heatStatuses[currentHeat.id] || 'pending') : 'pending';

  const completedCount = Object.values(schedule.heatStatuses).filter(s => s === 'completed').length;
  const totalCount = schedule.heatOrder.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const nextHeat = schedule.heatOrder[schedule.currentHeatIndex + 1];
  const laterHeats = schedule.heatOrder.slice(schedule.currentHeatIndex + 2, schedule.currentHeatIndex + 6);

  const formatTime = (isoString?: string): string => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const statusBadge = (status: string, large?: boolean) => {
    const colorClasses: Record<string, string> = {
      pending: 'bg-gray-200 text-gray-600',
      scoring: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
    };
    const c = colorClasses[status] || colorClasses.pending;
    const sizeClasses = large ? 'px-4 py-1.5 text-base' : 'px-3 py-1 text-xs';
    return (
      <span className={`${sizeClasses} rounded-full font-bold uppercase tracking-wider ${c}`}>
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

  const getHeatCoupleCount = (heat: ScheduledHeat): number => {
    let count = 0;
    for (const entry of heat.entries) {
      if (entry.bibSubset) {
        count += entry.bibSubset.length;
      } else {
        const event = events[entry.eventId];
        if (!event) continue;
        const h = event.heats.find(h => h.round === entry.round);
        count += h?.bibs.length || 0;
      }
    }
    return count;
  };

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

  return (
    <div className="max-w-[600px] mx-auto p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 px-4 py-3 bg-gray-800 rounded-lg text-white">
        <div>
          <h2 className="m-0 text-lg">{competition?.name || 'Competition'}</h2>
        </div>
        <span className="px-3 py-1 bg-red-500 rounded-full text-xs font-bold tracking-wider">
          LIVE
        </span>
      </div>

      {/* NOW */}
      <div className="bg-white rounded-xl p-5 mb-3 shadow-sm border-l-4 border-primary-500">
        <div className="text-xs font-bold text-primary-500 uppercase tracking-widest mb-2">
          Now
        </div>

        {!currentHeat ? (
          <p className="text-gray-500 text-lg m-0">Waiting to start...</p>
        ) : currentHeat.isBreak ? (
          <div>
            <p className="text-gray-400 m-0 mb-1 text-[0.8rem]">
              Heat {schedule.currentHeatIndex + 1} of {totalCount}
            </p>
            <p className="text-2xl font-bold m-0 mb-1">
              {currentHeat.breakLabel || 'Break'}
            </p>
            {currentHeat.breakDuration && (
              <p className="text-gray-500 m-0 mb-2 text-base">
                {currentHeat.breakDuration} minutes
              </p>
            )}
            {statusBadge(currentStatus, true)}
          </div>
        ) : currentHeat.entries.length > 0 ? (
          <div>
            <p className="text-gray-400 m-0 mb-1 text-[0.8rem]">
              Heat {schedule.currentHeatIndex + 1} of {totalCount}
            </p>
            {currentHeat.entries.map(entry => {
              const event = events[entry.eventId];
              if (!event) return null;
              const liveRoundLabel = formatRound(entry.round)
                + (entry.totalFloorHeats && entry.totalFloorHeats > 1 ? ` (Heat ${(entry.floorHeatIndex ?? 0) + 1} of ${entry.totalFloorHeats})` : '')
                + (entry.dance ? ` — ${entry.dance}` : '');
              return (
                <div key={`${entry.eventId}-${entry.floorHeatIndex ?? 0}-${entry.dance ?? ''}`} className="mb-1">
                  <p className="text-2xl font-bold m-0 mb-0.5 leading-tight">
                    {formatEventLabel(event)}
                  </p>
                  <p className="text-base text-gray-600 m-0">
                    {liveRoundLabel}
                  </p>
                </div>
              );
            })}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {statusBadge(currentStatus, true)}
              <span className="text-gray-500 text-sm">
                {getHeatCoupleCount(currentHeat)} couples
              </span>
              {(currentHeat.estimatedStartTime || currentHeat.actualStartTime) && (
                <span className="text-gray-400 text-[0.8125rem]">
                  {currentHeat.actualStartTime
                    ? `Started ${formatTime(currentHeat.actualStartTime)}`
                    : `Est. ${formatTime(currentHeat.estimatedStartTime)}`}
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-gray-500 m-0">Unknown event</p>
        )}
      </div>

      {/* UP NEXT */}
      {nextHeat && (
        <div className="bg-white rounded-xl px-5 py-4 mb-3 shadow-sm border-l-4 border-orange-500">
          <div className="text-xs font-bold text-orange-700 uppercase tracking-widest mb-2">
            Up Next
          </div>

          {nextHeat.isBreak ? (
            <div>
              <p className="text-lg font-semibold m-0 italic">
                <span className="not-italic text-gray-400 text-[0.8rem] mr-2">#{schedule.currentHeatIndex + 2}</span>
                {nextHeat.breakLabel || 'Break'}
                {nextHeat.breakDuration ? ` — ${nextHeat.breakDuration} min` : ''}
              </p>
            </div>
          ) : nextHeat.entries.length > 0 ? (
            <div>
              <p className="text-lg font-semibold m-0 mb-0.5">
                <span className="text-gray-400 text-[0.8rem] font-normal mr-2">#{schedule.currentHeatIndex + 2}</span>
                {getHeatLabel(nextHeat)}
              </p>
              <p className="text-gray-500 m-0 text-sm">
                {getHeatRound(nextHeat)}
                {' · '}
                {getHeatCoupleCount(nextHeat)} couples
                {nextHeat.estimatedStartTime && (
                  <span className="ml-2 text-gray-400">
                    · {formatTime(nextHeat.estimatedStartTime)}
                  </span>
                )}
              </p>
            </div>
          ) : (
            <p className="text-gray-500 m-0">Unknown event</p>
          )}
        </div>
      )}

      {/* COMING UP */}
      {laterHeats.length > 0 && (
        <div className="bg-white rounded-xl px-5 py-4 mb-3 shadow-sm">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
            Coming Up
          </div>
          <div className="flex flex-col gap-2">
            {laterHeats.map((heat, idx) => {
              const heatNum = schedule.currentHeatIndex + 3 + idx;

              if (heat.isBreak) {
                return (
                  <div key={heat.id + '-' + idx} className={`py-2 italic text-gray-500${idx < laterHeats.length - 1 ? ' border-b border-gray-100' : ''}`}>
                    <span className="not-italic text-gray-400 text-[0.8rem] mr-2">#{heatNum}</span>
                    {heat.breakLabel || 'Break'}
                    {heat.breakDuration ? ` — ${heat.breakDuration} min` : ''}
                    {heat.estimatedStartTime && (
                      <span className="not-italic text-gray-400 ml-2 text-[0.8rem]">
                        {formatTime(heat.estimatedStartTime)}
                      </span>
                    )}
                  </div>
                );
              }

              const coupleCount = getHeatCoupleCount(heat);

              return (
                <div key={heat.id + '-' + idx} className={`py-2${idx < laterHeats.length - 1 ? ' border-b border-gray-100' : ''}`}>
                  <span className="text-gray-400 text-[0.8rem] mr-2">#{heatNum}</span>
                  <span className="font-medium">{getHeatLabel(heat)}</span>
                  <span className="text-gray-400 ml-2 text-sm">
                    {getHeatRound(heat)}
                    {coupleCount > 0 && ` · ${coupleCount}`}
                    {heat.estimatedStartTime && ` · ${formatTime(heat.estimatedStartTime)}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="bg-white rounded-xl px-5 py-4 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-500">Progress</span>
          <span className="text-sm font-semibold">
            {completedCount} of {totalCount} heats
            {(() => {
              const lastHeat = schedule.heatOrder[schedule.heatOrder.length - 1];
              if (lastHeat?.estimatedStartTime && lastHeat?.estimatedDurationSeconds) {
                const finish = new Date(new Date(lastHeat.estimatedStartTime).getTime() + lastHeat.estimatedDurationSeconds * 1000);
                return <span className="font-normal text-gray-400 ml-2">· Est. finish {formatTime(finish.toISOString())}</span>;
              }
              return null;
            })()}
          </span>
        </div>
        <div className="bg-gray-200 rounded h-2 overflow-hidden">
          <div
            className="bg-primary-500 rounded h-full transition-[width] duration-300 ease-in-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

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

export default LiveCompetitionPage;
