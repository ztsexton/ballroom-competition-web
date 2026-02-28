import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { schedulesApi, eventsApi, couplesApi, judgesApi, judgingApi, competitionsApi } from '../../../api/client';
import { CompetitionSchedule, Competition, Event, Couple, Judge, ScoringProgress, ScheduledHeat } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { useCompetitionSSE } from '../../../hooks/useCompetitionSSE';
import { formatTime, getHeatLabel, getHeatRound } from './utils';
import { Skeleton } from '../../../components/Skeleton';
import ScoringProgressPanel from './components/ScoringProgressPanel';
import HeatSidebar from './components/HeatSidebar';
import ResetModal from './components/ResetModal';

function statusBadgeClasses(status: string): string {
  switch (status) {
    case 'pending': return 'bg-gray-200';
    case 'scoring': return 'bg-yellow-100';
    case 'completed': return 'bg-green-200';
    default: return 'bg-gray-200';
  }
}

const RunCompetitionPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const competitionId = parseInt(id || '0');

  const [schedule, setSchedule] = useState<CompetitionSchedule | null>(null);
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [events, setEvents] = useState<Record<number, Event>>({});
  const [couples, setCouples] = useState<Couple[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [scoringProgress, setScoringProgress] = useState<ScoringProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resetTargetIndex, setResetTargetIndex] = useState<number | null>(null);
  const [unsplitConfirm, setUnsplitConfirm] = useState<{ heatId: string; totalCouples: number; exceedsLimit: boolean; limitValue?: number } | null>(null);

  const loadData = useCallback(async () => {
    if (!competitionId) return;

    try {
      const [schedRes, eventsRes, couplesRes, judgesRes, compRes] = await Promise.all([
        schedulesApi.get(competitionId),
        eventsApi.getAll(competitionId),
        couplesApi.getAll(competitionId),
        judgesApi.getAll(competitionId),
        competitionsApi.getById(competitionId),
      ]);
      setSchedule(schedRes.data);
      setEvents(eventsRes.data);
      setCouples(couplesRes.data);
      setJudges(judgesRes.data);
      setCompetition(compRes.data);
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
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to advance');
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

  const handleUnsplitRequest = (heat: ScheduledHeat) => {
    const entry = heat.entries[0];
    if (!entry?.bibSubset) return;

    // Count total couples across all sibling floor heats
    const event = events[entry.eventId];
    if (!event) return;
    const heatData = event.heats.find(h => h.round === entry.round);
    const totalCouples = heatData?.bibs.length ?? 0;

    // Check floor limit
    const levelMax = competition?.maxCouplesOnFloorByLevel?.[event.level || ''];
    const floorMax = levelMax ?? competition?.maxCouplesOnFloor;
    const exceedsLimit = !!floorMax && totalCouples > floorMax;

    setUnsplitConfirm({
      heatId: heat.id,
      totalCouples,
      exceedsLimit,
      limitValue: floorMax || undefined,
    });
  };

  const handleUnsplitConfirm = async () => {
    if (!unsplitConfirm) return;
    try {
      const res = await schedulesApi.unsplitFloorHeat(competitionId, unsplitConfirm.heatId);
      setSchedule(res.data);
      setUnsplitConfirm(null);
    } catch {
      alert('Failed to unsplit heat');
      setUnsplitConfirm(null);
    }
  };

  if (loading || authLoading) return <Skeleton variant="card" />;

  if (!isAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2>Access Denied</h2>
          <p>You must be an admin to run competitions.</p>
        </div>
      </div>
    );
  }

  if (!schedule || Object.keys(events).length === 0) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2>Run Competition</h2>
          <p>{error || 'No schedule found. Generate a schedule first.'}</p>
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200 mt-4" onClick={() => navigate(`/competitions/${competitionId}/schedule`)}>
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
      const bibs = entry.bibSubset || h.bibs;
      for (const bib of bibs) {
        if (!seen.has(bib)) {
          seen.add(bib);
          const couple = couples.find(c => c.bib === bib);
          if (couple) result.push(couple);
        }
      }
    }
    return result.sort((a, b) => a.bib - b.bib);
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

  const pct = (completedCount / totalCount) * 100;

  return (
    <div className="max-w-7xl mx-auto p-8">
      {error && <div className="px-4 py-3 bg-red-100 text-red-700 rounded text-sm mb-4">{error}</div>}

      {/* Progress Bar */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-2">
          <strong>Progress</strong>
          <span>
            {allCompleted
              ? `Complete — all ${totalCount} heats done`
              : <>Heat {Math.min(schedule.currentHeatIndex + 1, totalCount)} of {totalCount} ({completedCount} completed)
                {(() => {
                  const lastHeat = schedule.heatOrder[schedule.heatOrder.length - 1];
                  if (lastHeat?.estimatedStartTime && lastHeat?.estimatedDurationSeconds) {
                    const finish = new Date(new Date(lastHeat.estimatedStartTime).getTime() + lastHeat.estimatedDurationSeconds * 1000);
                    return <span className="ml-2 text-gray-500">&middot; Est. finish {formatTime(finish.toISOString())}</span>;
                  }
                  return null;
                })()}
              </>
            }
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
          <div
            className={`h-full rounded transition-[width] duration-300 ease-in-out ${allCompleted ? 'bg-green-500' : 'bg-green-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Main Content: Current Heat + Sidebar */}
      <div className="grid grid-cols-[1fr_280px] gap-4">
        {/* Current Heat Panel */}
        <div>
          {allCompleted ? (
            <div className="bg-white rounded-lg shadow p-6 text-center py-12">
              <h2 className="text-green-800">Competition Complete!</h2>
              <p className="text-gray-500 mt-2">All {totalCount} heats have been completed.</p>
              <div className="flex gap-3 justify-center mt-4">
                <Link
                  to={`/competitions/${competitionId}/events`}
                  className="px-4 py-2 bg-primary-500 text-white rounded no-underline text-sm font-medium transition-colors hover:bg-primary-600"
                >
                  View Results
                </Link>
                <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200" onClick={() => navigate(`/competitions/${competitionId}/schedule`)}>
                  Back to Schedule
                </button>
              </div>
            </div>
          ) : isCurrentBreak ? (
            <div className="bg-white rounded-lg shadow p-6 text-center py-12">
              <h2 className="mb-2">
                {currentScheduledHeat?.breakLabel || 'Break'}
              </h2>
              {currentScheduledHeat?.breakDuration && (
                <p className="text-gray-500 text-lg mb-4">
                  Duration: {currentScheduledHeat.breakDuration} minutes
                </p>
              )}
              <p className="text-gray-400 mb-6">
                {currentStatus === 'completed' ? 'Break completed' : 'Break in progress'}
              </p>
              <div className="flex gap-2 justify-center">
                <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200" onClick={handleBack}
                  disabled={schedule.currentHeatIndex === 0 && currentStatus === 'pending'}>
                  Back
                </button>
                {currentStatus !== 'completed' ? (
                  <button className="px-4 py-2 bg-success-500 text-white rounded border-none cursor-pointer text-lg font-medium transition-colors hover:bg-success-600" onClick={handleAdvance}>
                    End Break
                  </button>
                ) : schedule.currentHeatIndex < totalCount - 1 ? (
                  <button className="px-4 py-2 bg-success-500 text-white rounded border-none cursor-pointer text-lg font-medium transition-colors hover:bg-success-600" onClick={handleAdvance}>
                    Next Heat
                  </button>
                ) : null}
              </div>
            </div>
          ) : currentScheduledHeat && currentScheduledHeat.entries.length > 0 ? (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start">
                <div>
                  {currentScheduledHeat.entries.map(entry => {
                    const event = events[entry.eventId];
                    if (!event) return null;
                    return (
                      <div key={entry.eventId} className="mb-1">
                        <h2 className="mb-0.5">
                          Event #{event.id}: {event.name}
                        </h2>
                        <p className="text-gray-500 text-sm m-0">
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
                  <p className="text-gray-600 text-base font-semibold capitalize my-1">
                    Round: {getHeatRound(currentScheduledHeat)}
                  </p>
                  {(currentScheduledHeat.estimatedStartTime || currentScheduledHeat.actualStartTime) && (
                    <p className="text-gray-500 text-sm my-0.5">
                      {currentScheduledHeat.estimatedStartTime && (
                        <span>Est. {formatTime(currentScheduledHeat.estimatedStartTime)}</span>
                      )}
                      {currentScheduledHeat.actualStartTime && (
                        <span className={currentScheduledHeat.estimatedStartTime ? 'ml-3' : ''}>
                          Started {formatTime(currentScheduledHeat.actualStartTime)}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${statusBadgeClasses(currentStatus)}`}>
                  {currentStatus}
                </span>
              </div>

              {/* State-dependent content */}
              <div className="mt-6">
                {currentStatus === 'pending' && (
                  <>
                    <h3 className="mb-3">Couples</h3>
                    {currentCouples.length > 0 ? (
                      currentScheduledHeat.entries.map(entry => {
                        const event = events[entry.eventId];
                        if (!event) return null;
                        const heat = event.heats.find(h => h.round === entry.round);
                        const isSplit = entry.totalFloorHeats && entry.totalFloorHeats > 1;

                        if (isSplit) {
                          // Find all sibling heats for this event/round
                          const siblingHeats = schedule.heatOrder.filter(h =>
                            h.entries.some(e => e.eventId === entry.eventId && e.round === entry.round
                              && e.dance === entry.dance));

                          // Group unique floor heat subsets (deduplicate across dances)
                          const floorGroups: { index: number; bibs: number[]; isCurrent: boolean }[] = [];
                          const seenIndices = new Set<number>();
                          for (const sh of siblingHeats) {
                            const e = sh.entries.find(e => e.eventId === entry.eventId && e.round === entry.round)!;
                            const idx = e.floorHeatIndex ?? 0;
                            if (seenIndices.has(idx)) continue;
                            seenIndices.add(idx);
                            floorGroups.push({
                              index: idx,
                              bibs: (e.bibSubset || []).slice().sort((a, b) => a - b),
                              isCurrent: idx === (entry.floorHeatIndex ?? 0),
                            });
                          }
                          floorGroups.sort((a, b) => a.index - b.index);

                          return (
                            <div key={`${entry.eventId}-${entry.dance ?? ''}`}>
                              {currentScheduledHeat.entries.length > 1 && (
                                <h4 className="m-0 mb-2 text-gray-600 text-sm">
                                  {event.name}
                                </h4>
                              )}
                              {floorGroups.map(group => {
                                const groupCouples = group.bibs.map(bib => couples.find(c => c.bib === bib)).filter(Boolean) as Couple[];
                                return (
                                  <div key={group.index} className={`mb-3 p-2 rounded-md ${group.isCurrent ? 'bg-green-50 border-2 border-green-400' : 'bg-gray-50 border border-gray-200'}`}>
                                    <div className="flex justify-between items-center mb-1.5">
                                      <span className={`font-bold text-sm ${group.isCurrent ? 'text-green-800' : 'text-gray-600'}`}>
                                        Heat {group.index + 1} of {entry.totalFloorHeats} ({groupCouples.length} couples)
                                      </span>
                                      {group.isCurrent && (
                                        <span className="text-xs font-semibold text-green-800 bg-green-200 px-2 py-0.5 rounded-full">
                                          Current
                                        </span>
                                      )}
                                    </div>
                                    <table>
                                      <thead>
                                        <tr>
                                          <th>Bib #</th>
                                          <th>Leader</th>
                                          <th>Follower</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {groupCouples.map(couple => (
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
                              })}
                            </div>
                          );
                        }

                        // Non-split heat: original display, sorted by bib
                        const bibs = (entry.bibSubset || heat?.bibs || []).slice().sort((a, b) => a - b);
                        const entryCouples = bibs.map(bib => couples.find(c => c.bib === bib)).filter(Boolean) as Couple[];
                        return (
                          <div key={entry.eventId} className={currentScheduledHeat.entries.length > 1 ? 'mb-4' : ''}>
                            {currentScheduledHeat.entries.length > 1 && (
                              <h4 className="m-0 mb-2 text-gray-600 text-sm">
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
                      <p className="text-gray-400">Couples TBD (previous round not yet scored)</p>
                    )}

                    {currentJudges.length > 0 && (
                      <div className="mt-4">
                        <h3 className="mb-2">Judges</h3>
                        <div className="flex gap-2 flex-wrap">
                          {currentJudges.map(judge => (
                            <span key={judge.id} className="px-3 py-1 bg-gray-100 rounded text-sm">
                              #{judge.judgeNumber}: {judge.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-center mt-6 flex gap-3 justify-center flex-wrap">
                      {/* Split Heat button -- only for single-entry, unsplit heats with >2 couples */}
                      {currentScheduledHeat.entries.length === 1
                        && !currentScheduledHeat.entries[0].bibSubset
                        && currentCouples.length > 2
                        && (
                          <button
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200"
                            onClick={async () => {
                              const groupCount = prompt(`Split into how many floor heats? (${currentCouples.length} couples total)`, '2');
                              if (!groupCount) return;
                              const n = parseInt(groupCount);
                              if (isNaN(n) || n < 2) return;
                              try {
                                const res = await schedulesApi.splitFloorHeat(competitionId, currentScheduledHeat.id, n);
                                setSchedule(res.data);
                              } catch {
                                alert('Failed to split heat');
                              }
                            }}
                          >
                            Split Heat
                          </button>
                        )}
                      {/* Merge Heats button -- only for split heats */}
                      {currentScheduledHeat.entries.length === 1
                        && currentScheduledHeat.entries[0].bibSubset
                        && (
                          <button
                            className="px-4 py-2 bg-red-600 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-red-700"
                            onClick={() => handleUnsplitRequest(currentScheduledHeat)}
                          >
                            Merge Heats
                          </button>
                        )}
                      <button className="px-4 py-2 bg-success-500 text-white rounded border-none cursor-pointer text-lg font-medium transition-colors hover:bg-success-600" onClick={handleAdvance}>
                        Begin Scoring
                      </button>
                    </div>
                  </>
                )}

                {currentStatus === 'scoring' && (
                  <>
                    {/* Dance navigation for multi-dance heats */}
                    {isMultiDanceHeat && currentDance && (
                      <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 border-2 border-indigo-400 rounded-lg mb-4">
                        <button
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200"
                          onClick={handleBackDance}
                          disabled={isFirstDance}
                        >
                          Prev Dance
                        </button>
                        <div className="text-center">
                          <p className="m-0 font-bold text-lg text-indigo-700">
                            {currentDance}
                          </p>
                          <p className="m-0 text-xs text-indigo-500">
                            Dance {currentDanceIndex + 1} of {heatDances.length}
                          </p>
                        </div>
                        <button
                          className={`px-4 py-2 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors ${isLastDance ? 'bg-gray-400' : 'bg-indigo-500 hover:bg-indigo-600'}`}
                          onClick={handleAdvanceDance}
                          disabled={isLastDance}
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
                  <div className="text-center py-8">
                    <p className="text-lg text-green-800 mb-4">Heat completed</p>
                    <div className="flex gap-2 justify-center flex-wrap">
                      {currentScheduledHeat.entries.length === 1 && (
                        <Link
                          to={`/events/${currentScheduledHeat.entries[0].eventId}/results/${currentScheduledHeat.entries[0].round}`}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200"
                        >
                          View Results
                        </Link>
                      )}
                      {schedule.currentHeatIndex < totalCount - 1 && (
                        <button className="px-4 py-2 bg-success-500 text-white rounded border-none cursor-pointer text-lg font-medium transition-colors hover:bg-success-600" onClick={handleAdvance}>
                          Next Heat
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation buttons */}
              <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
                <button
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200"
                  onClick={handleBack}
                  disabled={schedule.currentHeatIndex === 0 && currentStatus === 'pending'}
                >
                  Back
                </button>
                <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200" onClick={() => navigate(`/competitions/${competitionId}/schedule`)}>
                  Back to Schedule
                </button>
              </div>
            </div>
          ) : null}

          {/* Up Next */}
          {upcomingHeats.length > 0 && !allCompleted && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3>Up Next</h3>
              {upcomingHeats.map((scheduledHeat, idx) => {
                const isBreak = scheduledHeat.isBreak;
                const heatNum = schedule.currentHeatIndex + 2 + idx;
                return (
                  <div key={scheduledHeat.id + '-' + idx} className={`py-2 flex justify-between items-center ${idx < upcomingHeats.length - 1 ? 'border-b border-gray-200' : ''}`}>
                    <div>
                      <strong className={isBreak ? 'italic' : ''}>
                        <span className="text-gray-400 font-normal text-xs mr-2">#{heatNum}</span>
                        {isBreak ? (scheduledHeat.breakLabel || 'Break') : getHeatLabel(scheduledHeat, events)}
                      </strong>
                      <p className="text-gray-500 text-sm m-0 capitalize">
                        {isBreak
                          ? (scheduledHeat.breakDuration ? `${scheduledHeat.breakDuration} min` : 'Break')
                          : `${getHeatRound(scheduledHeat)} | ${scheduledHeat.entries.map(e => {
                              const ev = events[e.eventId];
                              return ev ? [ev.style, ev.level].filter(Boolean).join(' - ') : '';
                            }).filter(Boolean).join(', ') || 'No details'}`}
                        {scheduledHeat.estimatedStartTime && (
                          <span className="ml-2 normal-case">
                            &middot; {formatTime(scheduledHeat.estimatedStartTime)}
                          </span>
                        )}
                      </p>
                    </div>
                    {!isBreak && (
                      <span className="text-gray-400 text-sm">
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
        <HeatSidebar
          schedule={schedule}
          events={events}
          onJump={handleJump}
          onResetRequest={setResetTargetIndex}
        />
      </div>

      {/* Reset/re-run confirmation modal */}
      {resetTargetIndex !== null && (
        <ResetModal
          schedule={schedule}
          events={events}
          targetIndex={resetTargetIndex}
          onRerun={handleRerun}
          onReset={handleReset}
          onCancel={() => setResetTargetIndex(null)}
        />
      )}

      {/* Unsplit confirmation modal */}
      {unsplitConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
          <div className="bg-white rounded-lg shadow p-6 max-w-[480px] w-[90%] m-4">
            <h3 className="mb-4">Merge Heats?</h3>
            <p className="mb-3">
              This will merge all split floor heats back into a single heat with{' '}
              <strong>{unsplitConfirm.totalCouples} couples</strong> on the floor at once.
            </p>
            {unsplitConfirm.exceedsLimit && (
              <div className="px-4 py-3 bg-red-50 border-2 border-red-300 rounded-md mb-3">
                <p className="m-0 text-red-700 font-bold mb-1">
                  Warning: Exceeds Floor Limit
                </p>
                <p className="m-0 text-red-800 text-sm">
                  The configured maximum is <strong>{unsplitConfirm.limitValue}</strong> couples on the floor.
                  Merging will put <strong>{unsplitConfirm.totalCouples}</strong> couples on the floor,
                  exceeding the limit by <strong>{unsplitConfirm.totalCouples - (unsplitConfirm.limitValue || 0)}</strong>.
                </p>
              </div>
            )}
            <div className="flex gap-2 justify-end mt-4">
              <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200" onClick={() => setUnsplitConfirm(null)}>
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-red-700"
                onClick={handleUnsplitConfirm}
              >
                {unsplitConfirm.exceedsLimit ? 'Override & Merge' : 'Merge Heats'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RunCompetitionPage;
