import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { judgingApi, eventsApi, schedulesApi } from '../../api/client';
import { CompetitionSchedule, Event, Couple, Competition, ScheduledHeat } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCompetitionSSE } from '../../hooks/useCompetitionSSE';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Skeleton } from '../../components/Skeleton';

const OnDeckPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAnyAdmin, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const competitionId = parseInt(id || '0');

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [schedule, setSchedule] = useState<CompetitionSchedule | null>(null);
  const [events, setEvents] = useState<Record<number, Event>>({});
  const [couples, setCouples] = useState<Couple[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search / filter
  const [searchQuery, setSearchQuery] = useState('');

  // Scratch confirmation
  const [scratchConfirm, setScratchConfirm] = useState<{
    eventId: number; bib: number; coupleName: string; eventName: string;
  } | null>(null);
  const [scratching, setScratching] = useState(false);

  // Sidebar selected heat (null = follow current)
  const [selectedHeatIndex, setSelectedHeatIndex] = useState<number | null>(null);

  const sidebarRef = useRef<HTMLDivElement>(null);

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

  // Scroll sidebar to current heat on load / when current changes
  useEffect(() => {
    if (!schedule || selectedHeatIndex !== null) return;
    const el = sidebarRef.current;
    if (!el) return;
    const activeItem = el.querySelector('[data-active="true"]');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [schedule?.currentHeatIndex, selectedHeatIndex]);

  const couplesByBib = useMemo(() => {
    const map: Record<number, Couple> = {};
    couples.forEach(c => { map[c.bib] = c; });
    return map;
  }, [couples]);

  const formatTime = (isoString?: string): string => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const formatEventLabel = (event: Event) => {
    const parts: string[] = [];
    if (event.style) parts.push(event.style);
    if (event.dances?.length) parts.push(event.dances.join(', '));
    if (event.level) parts.push(event.level);
    return parts.length > 0 ? parts.join(' \u2014 ') : event.name;
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
      round += ` \u2014 ${entry.dance}`;
    }
    return round;
  };

  const getHeatCouples = (heat: ScheduledHeat): { eventId: number; eventName: string; couples: Couple[]; scratchedBibs: Set<number> }[] => {
    return heat.entries.map(entry => {
      const event = events[entry.eventId];
      if (!event) return { eventId: entry.eventId, eventName: 'Unknown', couples: [], scratchedBibs: new Set<number>() };
      const h = event.heats.find(h => h.round === entry.round);
      if (!h) return { eventId: entry.eventId, eventName: event.name, couples: [], scratchedBibs: new Set<number>() };
      const scratched = new Set(event.scratchedBibs || []);
      const bibs = (entry.bibSubset || h.bibs).slice().sort((a, b) => a - b);
      return {
        eventId: event.id,
        eventName: event.name,
        couples: bibs.filter(b => !scratched.has(b)).map(bib => couplesByBib[bib]).filter(Boolean),
        scratchedBibs: scratched,
      };
    });
  };

  const getAllHeatCoupleCount = (heat: ScheduledHeat): number => {
    let count = 0;
    for (const entry of heat.entries) {
      const event = events[entry.eventId];
      if (!event) continue;
      const h = event.heats.find(h => h.round === entry.round);
      if (!h) continue;
      const scratched = new Set(event.scratchedBibs || []);
      const bibs = entry.bibSubset || h.bibs;
      count += bibs.filter(b => !scratched.has(b)).length;
    }
    return count;
  };

  // Filter heats by search query
  const filteredHeatIndices = useMemo(() => {
    if (!schedule) return [];
    if (!searchQuery.trim()) return schedule.heatOrder.map((_, i) => i);
    const q = searchQuery.toLowerCase();
    return schedule.heatOrder
      .map((heat, i) => ({ heat, i }))
      .filter(({ heat }) => {
        if (heat.isBreak) return (heat.breakLabel || 'Break').toLowerCase().includes(q);
        return heat.entries.some(entry => {
          const event = events[entry.eventId];
          if (!event) return false;
          const text = [event.name, event.style, event.level, ...(event.dances || [])].join(' ').toLowerCase();
          return text.includes(q);
        });
      })
      .map(({ i }) => i);
  }, [schedule, events, searchQuery]);

  const handleScratch = async () => {
    if (!scratchConfirm) return;
    setScratching(true);
    try {
      await eventsApi.scratch(scratchConfirm.eventId, scratchConfirm.bib);
      showToast(`Scratched #${scratchConfirm.bib} from ${scratchConfirm.eventName}`, 'success');
      await loadData();
    } catch {
      showToast('Failed to scratch couple', 'error');
    } finally {
      setScratching(false);
      setScratchConfirm(null);
    }
  };

  const handleUnscratch = async (eventId: number, bib: number) => {
    try {
      await eventsApi.unscratch(eventId, bib);
      showToast(`Reinstated #${bib}`, 'success');
      await loadData();
    } catch {
      showToast('Failed to reinstate couple', 'error');
    }
  };

  const handleJump = async (heatIndex: number) => {
    try {
      const res = await schedulesApi.jump(competitionId, heatIndex);
      setSchedule(res.data);
      setSelectedHeatIndex(null);
      showToast(`Jumped to heat ${heatIndex + 1}`, 'info');
    } catch {
      showToast('Failed to jump to heat', 'error');
    }
  };

  if (loading || authLoading) return <Skeleton variant="card" />;

  if (!isAnyAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2>Access Denied</h2>
          <p>You must be an admin to use the deck captain view.</p>
        </div>
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="max-w-[900px] mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2>On-Deck Captain</h2>
          <p>{error || 'No schedule found.'}</p>
          <button
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200 mt-4"
            onClick={() => navigate(`/competitions/${competitionId}/schedule`)}
          >
            Go to Schedule
          </button>
        </div>
      </div>
    );
  }

  const completedCount = Object.values(schedule.heatStatuses).filter(s => s === 'completed').length;
  const totalCount = schedule.heatOrder.length;

  // The heat being viewed in detail (current or sidebar-selected)
  const viewIndex = selectedHeatIndex ?? schedule.currentHeatIndex;
  const viewHeat = schedule.heatOrder[viewIndex];
  const viewStatus = viewHeat ? (schedule.heatStatuses[viewHeat.id] || 'pending') : 'pending';
  const isViewingCurrent = viewIndex === schedule.currentHeatIndex;

  // Determine upcoming heats relative to the viewed heat
  const upcomingStart = viewIndex + 1;
  const upcomingHeats = schedule.heatOrder.slice(upcomingStart, upcomingStart + 5);

  const statusBadge = (status: string, size: 'sm' | 'lg' = 'sm') => {
    const classes: Record<string, string> = {
      pending: 'bg-gray-200 text-gray-600',
      scoring: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
    };
    const c = classes[status] || classes.pending;
    const sizeClass = size === 'lg' ? 'px-4 py-1.5 text-sm' : 'px-2 py-0.5 text-xs';
    return (
      <span className={`${sizeClass} rounded-full font-semibold uppercase ${c}`}>
        {status}
      </span>
    );
  };

  const renderCoupleTable = (heat: ScheduledHeat, showScratch: boolean) => {
    const entryCouples = getHeatCouples(heat);

    if (entryCouples.every(ec => ec.couples.length === 0)) {
      return <p className="text-gray-400 text-sm m-0">Couples TBD</p>;
    }

    return (
      <div>
        {entryCouples.map((ec, idx) => {
          const event = events[ec.eventId];
          const scratchedInEvent = ec.scratchedBibs;
          // Also find scratched couples that are still in the bib list for reinstatement
          const h = event?.heats.find(h => heat.entries.some(e => e.eventId === ec.eventId && e.round === h.round));
          const allBibs = h ? (heat.entries.find(e => e.eventId === ec.eventId)?.bibSubset || h.bibs) : [];
          const scratchedCouples = allBibs
            .filter(b => scratchedInEvent.has(b) && couplesByBib[b])
            .map(b => couplesByBib[b]);

          return (
            <div key={idx} className={idx < entryCouples.length - 1 ? 'mb-4' : ''}>
              {entryCouples.length > 1 && (
                <p className="text-sm font-semibold text-gray-500 mb-1 mt-0">{ec.eventName}</p>
              )}
              <div className="text-sm text-gray-500 mb-2">
                {ec.couples.length} couple{ec.couples.length !== 1 ? 's' : ''} on floor
                {scratchedCouples.length > 0 && (
                  <span className="text-red-500 ml-2">({scratchedCouples.length} scratched)</span>
                )}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="py-2 pr-3 font-semibold text-gray-600 w-16">Bib</th>
                    <th className="py-2 pr-3 font-semibold text-gray-600">Leader</th>
                    <th className="py-2 pr-3 font-semibold text-gray-600">Follower</th>
                    {showScratch && <th className="py-2 font-semibold text-gray-600 w-20"></th>}
                  </tr>
                </thead>
                <tbody>
                  {ec.couples.map(c => (
                    <tr key={c.bib} className="border-t border-gray-100">
                      <td className="py-2.5 pr-3 font-bold">#{c.bib}</td>
                      <td className="py-2.5 pr-3">{c.leaderName}</td>
                      <td className="py-2.5 pr-3">{c.followerName}</td>
                      {showScratch && (
                        <td className="py-2.5">
                          <button
                            className="px-3 py-1.5 bg-red-50 text-red-600 rounded border border-red-200 cursor-pointer text-xs font-medium transition-colors hover:bg-red-100 active:bg-red-200"
                            onClick={() => setScratchConfirm({
                              eventId: ec.eventId,
                              bib: c.bib,
                              coupleName: `#${c.bib} ${c.leaderName} & ${c.followerName}`,
                              eventName: ec.eventName,
                            })}
                          >
                            Scratch
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {scratchedCouples.map(c => (
                    <tr key={c.bib} className="border-t border-gray-100 bg-red-50/50">
                      <td className="py-2.5 pr-3 font-bold text-red-400 line-through">#{c.bib}</td>
                      <td className="py-2.5 pr-3 text-red-400 line-through">{c.leaderName}</td>
                      <td className="py-2.5 pr-3 text-red-400 line-through">{c.followerName}</td>
                      {showScratch && (
                        <td className="py-2.5">
                          <button
                            className="px-3 py-1.5 bg-green-50 text-green-600 rounded border border-green-200 cursor-pointer text-xs font-medium transition-colors hover:bg-green-100 active:bg-green-200"
                            onClick={() => handleUnscratch(ec.eventId, c.bib)}
                          >
                            Reinstate
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-gray-100">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="m-0 text-lg whitespace-nowrap">Deck Captain</h2>
          {competition && (
            <span className="text-gray-500 text-sm truncate hidden sm:inline">{competition.name}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 whitespace-nowrap">
            {completedCount}/{totalCount} heats
          </span>
          <button
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200"
            onClick={() => navigate(`/competitions/${competitionId}`)}
          >
            Exit
          </button>
        </div>
      </div>

      {/* Main layout: sidebar + detail */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: scrollable heat list */}
        <div className="w-72 lg:w-80 border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
          {/* Search */}
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* Heat list */}
          <div ref={sidebarRef} className="flex-1 overflow-y-auto">
            {filteredHeatIndices.map(heatIdx => {
              const heat = schedule.heatOrder[heatIdx];
              const status = schedule.heatStatuses[heat.id] || 'pending';
              const isCurrent = heatIdx === schedule.currentHeatIndex;
              const isSelected = heatIdx === viewIndex;
              const coupleCount = heat.isBreak ? 0 : getAllHeatCoupleCount(heat);

              return (
                <button
                  key={heat.id + '-' + heatIdx}
                  data-active={isCurrent ? 'true' : undefined}
                  className={`w-full text-left px-3 py-3 border-b border-gray-100 cursor-pointer transition-colors block bg-transparent border-x-0 border-t-0
                    ${isSelected ? 'bg-primary-50 border-l-4 !border-l-primary-500' : ''}
                    ${isCurrent && !isSelected ? 'bg-green-50' : ''}
                    ${!isSelected && !isCurrent ? 'hover:bg-gray-50' : ''}
                  `}
                  onClick={() => setSelectedHeatIndex(heatIdx === schedule.currentHeatIndex ? null : heatIdx)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-400 font-mono w-6 flex-shrink-0">{heatIdx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm m-0 truncate ${heat.isBreak ? 'italic text-gray-500' : 'font-medium text-gray-800'}`}>
                        {heat.isBreak ? (heat.breakLabel || 'Break') : getHeatLabel(heat)}
                      </p>
                      {!heat.isBreak && (
                        <p className="text-xs text-gray-400 m-0 truncate">
                          {getHeatRound(heat)}
                          {coupleCount > 0 && ` \u00b7 ${coupleCount}`}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-1.5">
                      {heat.estimatedStartTime && (
                        <span className="text-[0.6875rem] text-gray-400">{formatTime(heat.estimatedStartTime)}</span>
                      )}
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        status === 'completed' ? 'bg-green-400' :
                        status === 'scoring' ? 'bg-yellow-400' :
                        'bg-gray-300'
                      }`} />
                    </div>
                  </div>
                </button>
              );
            })}
            {filteredHeatIndices.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">No matching heats</p>
            )}
          </div>

          {/* Quick actions at bottom of sidebar */}
          <div className="p-3 border-t border-gray-200 flex-shrink-0">
            <button
              className="w-full px-3 py-2.5 bg-primary-500 text-white rounded-lg border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 active:bg-primary-700"
              onClick={() => { setSelectedHeatIndex(null); }}
            >
              Go to Current Heat
            </button>
          </div>
        </div>

        {/* Main detail panel */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-[800px] mx-auto">
            {/* Viewed heat detail */}
            {viewHeat ? (
              <>
                {/* Heat header */}
                <div className="bg-white rounded-lg shadow-sm p-5 mb-4 border-l-4 border-primary-500">
                  <div className="flex justify-between items-start gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {isViewingCurrent ? (
                          <span className="text-xs font-bold text-primary-500 uppercase tracking-widest">Now on Floor</span>
                        ) : (
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                            Heat {viewIndex + 1}
                            {viewStatus === 'completed' && ' (Completed)'}
                          </span>
                        )}
                      </div>

                      {viewHeat.isBreak ? (
                        <div>
                          <p className="text-xl font-bold m-0">{viewHeat.breakLabel || 'Break'}</p>
                          {viewHeat.breakDuration && (
                            <p className="text-gray-500 m-0 mt-1">{viewHeat.breakDuration} minutes</p>
                          )}
                        </div>
                      ) : (
                        <div>
                          {viewHeat.entries.map(entry => {
                            const event = events[entry.eventId];
                            if (!event) return null;
                            return (
                              <div key={`${entry.eventId}-${entry.floorHeatIndex ?? 0}-${entry.dance ?? ''}`} className="mb-1">
                                <p className="text-xl font-bold m-0">{formatEventLabel(event)}</p>
                                <p className="text-gray-500 m-0 text-sm">{getHeatRound(viewHeat)}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {statusBadge(viewStatus, 'lg')}
                      {viewHeat.estimatedStartTime && (
                        <span className="text-xs text-gray-400">
                          {viewHeat.actualStartTime
                            ? `Started ${formatTime(viewHeat.actualStartTime)}`
                            : `Est. ${formatTime(viewHeat.estimatedStartTime)}`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Jump button if not viewing current */}
                  {!isViewingCurrent && viewStatus === 'pending' && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <button
                        className="px-4 py-2.5 bg-primary-500 text-white rounded-lg border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 active:bg-primary-700"
                        onClick={() => handleJump(viewIndex)}
                      >
                        Jump to This Heat
                      </button>
                    </div>
                  )}
                </div>

                {/* Couple list for this heat (with scratch controls) */}
                {viewHeat && !viewHeat.isBreak && (
                  <div className="bg-white rounded-lg shadow-sm p-5 mb-4">
                    <h3 className="mt-0 mb-3 text-base">Couples</h3>
                    {renderCoupleTable(viewHeat, viewStatus !== 'completed')}
                  </div>
                )}

                {/* Upcoming heats after viewed heat */}
                {upcomingHeats.length > 0 && (
                  <div className="bg-white rounded-lg shadow-sm p-5 mb-4">
                    <h3 className="mt-0 mb-3 text-base text-gray-600">Coming Up Next</h3>
                    {upcomingHeats.map((heat, idx) => {
                      const heatIdx = upcomingStart + idx;
                      const heatStatus = schedule.heatStatuses[heat.id] || 'pending';
                      const showCouples = idx < 2; // Show couples for next 2 heats

                      if (heat.isBreak) {
                        return (
                          <div
                            key={heat.id + '-' + heatIdx}
                            className={`py-3 flex justify-between items-center italic text-gray-500 cursor-pointer hover:bg-gray-50 rounded px-2 -mx-2 ${idx < upcomingHeats.length - 1 ? 'border-b border-gray-100' : ''}`}
                            onClick={() => setSelectedHeatIndex(heatIdx)}
                          >
                            <span>
                              <span className="not-italic text-gray-400 text-xs mr-2">#{heatIdx + 1}</span>
                              {heat.breakLabel || 'Break'}
                              {heat.breakDuration ? ` \u2014 ${heat.breakDuration} min` : ''}
                            </span>
                            {heat.estimatedStartTime && (
                              <span className="text-xs text-gray-400">{formatTime(heat.estimatedStartTime)}</span>
                            )}
                          </div>
                        );
                      }

                      const coupleCount = getAllHeatCoupleCount(heat);
                      const heatCouples = showCouples ? getHeatCouples(heat) : [];

                      return (
                        <div
                          key={heat.id + '-' + heatIdx}
                          className={`py-3 cursor-pointer hover:bg-gray-50 rounded px-2 -mx-2 ${idx < upcomingHeats.length - 1 ? 'border-b border-gray-100' : ''}`}
                          onClick={() => setSelectedHeatIndex(heatIdx)}
                        >
                          <div className="flex justify-between items-center">
                            <div className="min-w-0 flex-1">
                              <span className="text-gray-400 text-xs mr-2">#{heatIdx + 1}</span>
                              <span className="font-medium text-sm">{getHeatLabel(heat)}</span>
                              <span className="text-gray-400 text-xs ml-2">
                                {getHeatRound(heat)} &middot; {coupleCount} couple{coupleCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {heat.estimatedStartTime && (
                                <span className="text-xs text-gray-400">{formatTime(heat.estimatedStartTime)}</span>
                              )}
                              {statusBadge(heatStatus)}
                            </div>
                          </div>
                          {showCouples && heatCouples.some(ec => ec.couples.length > 0) && (
                            <div className="mt-2 flex flex-wrap gap-1.5 pl-6">
                              {heatCouples.flatMap(ec => ec.couples).map(c => (
                                <span key={c.bib} className="px-2 py-0.5 bg-gray-50 border border-gray-200 rounded text-xs">
                                  <strong>#{c.bib}</strong> {c.leaderName} & {c.followerName}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <p className="text-gray-500 text-lg">No heat selected</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scratch confirmation dialog */}
      <ConfirmDialog
        open={!!scratchConfirm}
        title="Scratch Couple"
        message={scratchConfirm
          ? `Scratch ${scratchConfirm.coupleName} from ${scratchConfirm.eventName}? They will be removed from all remaining rounds of this event.`
          : ''
        }
        confirmLabel={scratching ? 'Scratching...' : 'Scratch'}
        variant="danger"
        onConfirm={handleScratch}
        onCancel={() => setScratchConfirm(null)}
      />
    </div>
  );
};

export default OnDeckPage;
