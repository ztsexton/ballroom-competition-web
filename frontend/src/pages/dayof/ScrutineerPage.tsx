import { useEffect, useState } from 'react';
import { eventsApi, couplesApi, scrutineerApi } from '../../api/client';
import { Event, Couple, EventResult } from '../../types';
import { useCompetition } from '../../context/CompetitionContext';
import { useAuth } from '../../context/AuthContext';
import { InputMethod, CoupleInfo } from './JudgeScoring/types';
import InputMethodToggle from './JudgeScoring/components/InputMethodToggle';
import RecallForm from './JudgeScoring/components/RecallForm';
import RankingForm from './JudgeScoring/components/RankingForm';
import TapToRankForm from './JudgeScoring/components/TapToRankForm';
import PickerRankForm from './JudgeScoring/components/PickerRankForm';
import ProficiencyForm from './JudgeScoring/components/ProficiencyForm';
import QuickScoreForm from './JudgeScoring/components/QuickScoreForm';
import { JudgeGrid } from '../../components/results/JudgeGrid';
import { SkatingBreakdown } from '../../components/results/SkatingBreakdown';
import { MultiDanceSummary } from '../../components/results/MultiDanceSummary';
import { Skeleton } from '../../components/Skeleton';

const STYLE_SECTIONS = ['Smooth', 'Standard', 'Rhythm', 'Latin', 'Night Club', 'Country'];

type ScrutineerInputMode = 'grid' | 'per-judge';

interface JudgeInfo {
  id: number;
  name: string;
  judgeNumber: number;
  isChairman?: boolean;
}

const ScrutineerPage = () => {
  const { activeCompetition } = useCompetition();
  const { isAdmin, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [couples, setCouples] = useState<Couple[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Scoring grid state
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedRound, setSelectedRound] = useState<string | null>(null);
  const [activeDance, setActiveDance] = useState<string | undefined>(undefined);
  const [gridBibs, setGridBibs] = useState<number[]>([]);
  const [gridJudges, setGridJudges] = useState<JudgeInfo[]>([]);
  const [gridDances, setGridDances] = useState<string[]>([]);
  const [isRecallRound, setIsRecallRound] = useState(false);
  const [scoringType, setScoringType] = useState<'standard' | 'proficiency'>('standard');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [gridLoading, setGridLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<EventResult[] | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Input mode preferences (persisted in localStorage)
  const [inputMode, setInputMode] = useState<ScrutineerInputMode>(() => {
    const saved = localStorage.getItem('scrutineer-input-mode');
    return (saved === 'per-judge' ? 'per-judge' : 'grid') as ScrutineerInputMode;
  });
  const [activeJudgeId, setActiveJudgeId] = useState<number | null>(null);
  const [inputMethod, setInputMethod] = useState<InputMethod>(() => {
    const saved = localStorage.getItem('scrutineer-input-method');
    return (['tap', 'picker', 'keyboard', 'quickscore'].includes(saved || '') ? saved : 'keyboard') as InputMethod;
  });

  useEffect(() => {
    if (activeCompetition) loadData();
  }, [activeCompetition]);

  const loadData = async () => {
    if (!activeCompetition) return;
    try {
      const [eventsRes, couplesRes] = await Promise.all([
        eventsApi.getAll(activeCompetition.id),
        couplesApi.getAll(activeCompetition.id),
      ]);
      setEvents(Object.values(eventsRes.data));
      setCouples(couplesRes.data);
    } catch {
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const openScoringGrid = async (event: Event, round: string) => {
    setSelectedEvent(event);
    setSelectedRound(round);
    setResults(null);
    setError(null);
    setGridLoading(true);

    try {
      const res = await scrutineerApi.getJudgeScores(event.id, round);
      const data = res.data;
      setGridBibs(data.bibs);
      setGridJudges(data.judges);
      setGridDances(data.dances);
      setIsRecallRound(data.isRecallRound);
      setScoringType(data.scoringType);

      if (data.dances.length > 0) {
        setActiveDance(data.dances[0]);
      } else {
        setActiveDance(undefined);
      }

      // Load existing scores into local state
      const loaded: Record<string, number> = {};
      if (data.dances.length > 0 && data.danceScoresByBib) {
        for (const dance of data.dances) {
          const danceScores = data.danceScoresByBib[dance] || {};
          for (const [bib, judgeMap] of Object.entries(danceScores)) {
            for (const [judgeId, score] of Object.entries(judgeMap)) {
              loaded[`${judgeId}-${dance}-${bib}`] = score as number;
            }
          }
        }
      } else {
        for (const [bib, judgeMap] of Object.entries(data.scoresByBib)) {
          for (const [judgeId, score] of Object.entries(judgeMap)) {
            loaded[`${judgeId}-${bib}`] = score as number;
          }
        }
      }
      setScores(loaded);
      // Set initial active judge for per-judge mode
      if (data.judges.length > 0) {
        setActiveJudgeId(prev => {
          // Keep current judge if they're still in the list
          if (prev && data.judges.some(j => j.id === prev)) return prev;
          return data.judges[0].id;
        });
      }
    } catch {
      setError('Failed to load scores for this round');
    } finally {
      setGridLoading(false);
    }
  };

  const handleInputModeChange = (mode: ScrutineerInputMode) => {
    setInputMode(mode);
    localStorage.setItem('scrutineer-input-mode', mode);
  };

  const handleInputMethodChange = (method: InputMethod) => {
    setInputMethod(method);
    localStorage.setItem('scrutineer-input-method', method);
  };

  // Extract scores for a single judge as Record<bib, score> (for form components)
  const getJudgeScoresMap = (judgeId: number): Record<number, number> => {
    const map: Record<number, number> = {};
    for (const bib of gridBibs) {
      const key = activeDance ? `${judgeId}-${activeDance}-${bib}` : `${judgeId}-${bib}`;
      if (scores[key] !== undefined) {
        map[bib] = scores[key];
      }
    }
    return map;
  };

  // Build CoupleInfo[] for form components
  const getCoupleInfoList = (): CoupleInfo[] =>
    gridBibs.map(bib => {
      const couple = getCoupleForBib(bib);
      return { bib, leaderName: couple?.leaderName || '—', followerName: couple?.followerName || '—' };
    });

  // Handle score updates from per-judge form components
  const handlePerJudgeChange = (judgeId: number, bib: number, value: string) => {
    handleScoreChange(judgeId, bib, value);
  };

  const handlePerJudgeScoresChange = (judgeId: number, newScores: Record<number, number>) => {
    setScores(prev => {
      const updated = { ...prev };
      for (const bib of gridBibs) {
        const key = activeDance ? `${judgeId}-${activeDance}-${bib}` : `${judgeId}-${bib}`;
        if (newScores[bib] !== undefined) {
          updated[key] = newScores[bib];
        } else {
          delete updated[key];
        }
      }
      return updated;
    });
  };

  const handlePerJudgeToggle = (judgeId: number, bib: number) => {
    const key = activeDance ? `${judgeId}-${activeDance}-${bib}` : `${judgeId}-${bib}`;
    setScores(prev => ({ ...prev, [key]: prev[key] === 1 ? 0 : 1 }));
  };

  const closeScoringGrid = () => {
    setSelectedEvent(null);
    setSelectedRound(null);
    setScores({});
    setResults(null);
    setGridBibs([]);
    setGridJudges([]);
    setGridDances([]);
  };

  const scoreKey = (judgeId: number, bib: number) =>
    activeDance ? `${judgeId}-${activeDance}-${bib}` : `${judgeId}-${bib}`;

  const handleScoreChange = (judgeId: number, bib: number, value: string) => {
    const key = scoreKey(judgeId, bib);
    const isProficiency = scoringType === 'proficiency';

    if (isRecallRound && !isProficiency) {
      setScores(prev => ({ ...prev, [key]: prev[key] === 1 ? 0 : 1 }));
    } else if (isProficiency) {
      const num = parseInt(value) || 0;
      setScores(prev => ({ ...prev, [key]: Math.min(100, Math.max(0, num)) }));
    } else {
      setScores(prev => ({ ...prev, [key]: parseInt(value) || 0 }));
    }
  };

  const handleSaveJudge = async (judgeId: number) => {
    if (!selectedEvent || !selectedRound) return;
    const judgeScores: Array<{ bib: number; score: number }> = [];
    for (const bib of gridBibs) {
      const key = scoreKey(judgeId, bib);
      const val = scores[key];
      if (val !== undefined) {
        judgeScores.push({ bib, score: val });
      }
    }
    if (judgeScores.length === 0) return;

    setSaving(true);
    try {
      await scrutineerApi.submitJudgeScores(
        selectedEvent.id, selectedRound, judgeId, judgeScores, activeDance
      );
    } catch {
      setError('Failed to save scores for judge');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    if (!selectedEvent || !selectedRound) return;
    setSaving(true);
    setError(null);
    try {
      const dancesToSave = gridDances.length > 0 ? gridDances : [undefined];
      for (const dance of dancesToSave) {
        for (const judge of gridJudges) {
          const judgeScores: Array<{ bib: number; score: number }> = [];
          for (const bib of gridBibs) {
            const key = dance ? `${judge.id}-${dance}-${bib}` : `${judge.id}-${bib}`;
            const val = scores[key];
            if (val !== undefined) {
              judgeScores.push({ bib, score: val });
            }
          }
          if (judgeScores.length > 0) {
            await scrutineerApi.submitJudgeScores(
              selectedEvent.id, selectedRound, judge.id, judgeScores, dance
            );
          }
        }
      }
    } catch {
      setError('Failed to save some scores');
    } finally {
      setSaving(false);
    }
  };

  const handleCompile = async () => {
    if (!selectedEvent || !selectedRound) return;
    setCompiling(true);
    setError(null);
    try {
      // Save all first
      await handleSaveAll();
      const res = await scrutineerApi.compileScores(selectedEvent.id, selectedRound);
      if (res.data.success) {
        setResults(res.data.results);
        // Reload event data to reflect advancement
        loadData();
      }
    } catch {
      setError('Failed to compile scores');
    } finally {
      setCompiling(false);
    }
  };

  const getCoupleForBib = (bib: number) => couples.find(c => c.bib === bib);

  // Group events by style
  const groupedEvents: Record<string, Event[]> = {};
  for (const evt of events) {
    const style = evt.style || 'Other';
    if (!groupedEvents[style]) groupedEvents[style] = [];
    groupedEvents[style].push(evt);
  }
  const sectionOrder = [...STYLE_SECTIONS, ...Object.keys(groupedEvents).filter(s => !STYLE_SECTIONS.includes(s))];

  if (authLoading || loading) return <Skeleton variant="card" />;
  if (!isAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-8"><div className="bg-white rounded-lg shadow p-6">
        <h2>Access Denied</h2>
        <p>You must be an admin to access the scrutineer view.</p>
      </div></div>
    );
  }
  if (!activeCompetition) {
    return <div className="max-w-7xl mx-auto p-8"><div className="bg-white rounded-lg shadow p-6"><p>No competition selected.</p></div></div>;
  }

  // ─── Scoring Grid View ───
  if (selectedEvent && selectedRound) {
    const isProficiency = scoringType === 'proficiency';

    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-3">
            <div>
              <button onClick={closeScoringGrid} className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200 mr-4">
                &larr; Back to Events
              </button>
              <span className="font-semibold text-lg">{selectedEvent.name}</span>
            </div>
          </div>

          {/* Round tabs */}
          <div className="flex gap-1 mb-4 border-b-2 border-gray-200 pb-0">
            {selectedEvent.heats.map(heat => {
              const active = heat.round === selectedRound;
              return (
                <button
                  key={heat.round}
                  onClick={() => { if (heat.round !== selectedRound) openScoringGrid(selectedEvent!, heat.round); }}
                  className={`${active ? 'text-primary-600 font-semibold border-b-[3px] border-primary-500' : 'text-gray-600 border-b-[3px] border-transparent'} px-4 py-2 border-none bg-transparent cursor-pointer capitalize text-sm transition-colors -mb-0.5`}
                >
                  {heat.round}
                </button>
              );
            })}
          </div>

          {error && <div className="px-4 py-3 bg-red-100 text-red-700 rounded text-sm mb-4">{error}</div>}

          {/* Scoring type info */}
          <div className={`px-4 py-3 rounded mb-4 text-sm border ${
            isProficiency
              ? 'bg-green-50 border-green-500'
              : isRecallRound
                ? 'bg-amber-50 border-amber-500'
                : 'bg-blue-50 border-blue-500'
          }`}>
            <strong>
              {isProficiency ? 'Proficiency Scoring' : isRecallRound ? 'Recall Round' : 'Final Round'}
            </strong>
            <span className="ml-2 text-gray-600">
              {isProficiency
                ? '— Enter scores 0-100 for each couple.'
                : isRecallRound
                  ? '— Check couples to recall to the next round.'
                  : '— Enter rankings (1 = best).'}
            </span>
          </div>

          {/* Entry mode toggle */}
          <div className="flex justify-between items-center mb-4">
            {/* Multi-dance tabs */}
            <div className="flex gap-1">
              {gridDances.length > 0 && gridDances.map(dance => (
                <button
                  key={dance}
                  className={activeDance === dance
                    ? 'px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 capitalize'
                    : 'px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200 capitalize'}
                  onClick={() => setActiveDance(dance)}
                >
                  {dance}
                </button>
              ))}
            </div>

            {/* Grid / Per-Judge toggle */}
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              {([['grid', 'Grid'], ['per-judge', 'Per-Judge']] as const).map(([mode, label]) => {
                const active = inputMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => handleInputModeChange(mode)}
                    className={`${active ? 'bg-primary-500 text-white font-bold' : 'bg-transparent text-gray-600 font-medium'} px-3 py-1.5 border-none text-[0.8125rem] cursor-pointer transition-all`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {gridLoading ? (
            <Skeleton variant="card" />
          ) : gridBibs.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No couples in this round.</p>
          ) : inputMode === 'per-judge' ? (
            /* ── Per-Judge Mode ── */
            <>
              {/* Judge selector tabs */}
              <div className="flex gap-1 mb-3 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                {gridJudges.map(judge => {
                  const active = activeJudgeId === judge.id;
                  return (
                    <button
                      key={judge.id}
                      onClick={() => setActiveJudgeId(judge.id)}
                      className={`${active ? 'border-2 border-primary-500 bg-primary-50 text-primary-500 font-semibold' : 'border border-gray-200 bg-white text-gray-600'} px-3 py-2 rounded-md text-[0.8125rem] cursor-pointer whitespace-nowrap transition-all`}
                    >
                      #{judge.judgeNumber}: {judge.name}{judge.isChairman ? ' \u2605' : ''}
                    </button>
                  );
                })}
              </div>

              {activeJudgeId && (() => {
                const judgeScoresMap = getJudgeScoresMap(activeJudgeId);
                const coupleInfoList = getCoupleInfoList();

                // Determine effective input method for this scoring type
                const effectiveMethod = (() => {
                  if (isRecallRound && !isProficiency) return 'recall' as const;
                  if (isProficiency) {
                    return (['quickscore', 'keyboard'].includes(inputMethod) ? inputMethod : 'keyboard');
                  }
                  return (['tap', 'picker', 'keyboard'].includes(inputMethod) ? inputMethod : 'keyboard');
                })();

                return (
                  <>
                    {/* Input method toggle (not for recall) */}
                    {!(isRecallRound && !isProficiency) && (
                      <InputMethodToggle
                        mode={isProficiency ? 'proficiency' : 'ranking'}
                        selectedMethod={effectiveMethod}
                        onMethodChange={handleInputMethodChange}
                      />
                    )}

                    {/* Render the appropriate form */}
                    {isRecallRound && !isProficiency ? (
                      <RecallForm
                        couples={coupleInfoList}
                        scores={judgeScoresMap}
                        onToggle={(bib) => handlePerJudgeToggle(activeJudgeId, bib)}
                      />
                    ) : isProficiency ? (
                      effectiveMethod === 'quickscore' ? (
                        <QuickScoreForm
                          couples={coupleInfoList}
                          scores={judgeScoresMap}
                          onChange={(bib, val) => handlePerJudgeChange(activeJudgeId, bib, val)}
                        />
                      ) : (
                        <ProficiencyForm
                          couples={coupleInfoList}
                          scores={judgeScoresMap}
                          onChange={(bib, val) => handlePerJudgeChange(activeJudgeId, bib, val)}
                        />
                      )
                    ) : effectiveMethod === 'tap' ? (
                      <TapToRankForm
                        couples={coupleInfoList}
                        scores={judgeScoresMap}
                        onScoresChange={(s) => handlePerJudgeScoresChange(activeJudgeId, s)}
                      />
                    ) : effectiveMethod === 'picker' ? (
                      <PickerRankForm
                        couples={coupleInfoList}
                        scores={judgeScoresMap}
                        onScoresChange={(s) => handlePerJudgeScoresChange(activeJudgeId, s)}
                      />
                    ) : (
                      <RankingForm
                        couples={coupleInfoList}
                        scores={judgeScoresMap}
                        onChange={(bib, val) => handlePerJudgeChange(activeJudgeId, bib, val)}
                      />
                    )}

                    <div className="flex gap-2 mt-4 flex-wrap">
                      <button onClick={() => handleSaveJudge(activeJudgeId)} disabled={saving} className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200">
                        {saving ? 'Saving...' : `Save Judge #${gridJudges.find(j => j.id === activeJudgeId)?.judgeNumber || ''}`}
                      </button>
                      <button onClick={handleSaveAll} disabled={saving} className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200">
                        {saving ? 'Saving...' : 'Save All Judges'}
                      </button>
                      <button onClick={handleCompile} disabled={compiling || saving} className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600">
                        {compiling ? 'Compiling...' : 'Compile & Calculate Results'}
                      </button>
                    </div>
                  </>
                );
              })()}
            </>
          ) : (
            /* ── Grid Mode ── */
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th>Bib</th>
                      <th>Leader</th>
                      <th>Follower</th>
                      {gridJudges.map(judge => (
                        <th key={judge.id} className="text-center min-w-[80px]">
                          <div>#{judge.judgeNumber}: {judge.name}{judge.isChairman ? ' \u2605' : ''}</div>
                          <button
                            onClick={() => handleSaveJudge(judge.id)}
                            disabled={saving}
                            className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-[0.6875rem] font-medium transition-colors hover:bg-gray-200 mt-1"
                          >
                            Save
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gridBibs.map(bib => {
                      const couple = getCoupleForBib(bib);
                      return (
                        <tr key={bib}>
                          <td><strong>#{bib}</strong></td>
                          <td>{couple?.leaderName || '—'}</td>
                          <td>{couple?.followerName || '—'}</td>
                          {gridJudges.map(judge => {
                            const key = scoreKey(judge.id, bib);
                            return (
                              <td key={judge.id} className="text-center">
                                {isProficiency ? (
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={scores[key] ?? ''}
                                    onChange={e => handleScoreChange(judge.id, bib, e.target.value)}
                                    className="w-[60px] text-center"
                                  />
                                ) : isRecallRound ? (
                                  <input
                                    type="checkbox"
                                    checked={scores[key] === 1}
                                    onChange={() => handleScoreChange(judge.id, bib, '')}
                                    className="w-5 h-5 cursor-pointer"
                                  />
                                ) : (
                                  <input
                                    type="number"
                                    min="1"
                                    max={gridBibs.length}
                                    value={scores[key] ?? ''}
                                    onChange={e => handleScoreChange(judge.id, bib, e.target.value)}
                                    className="w-[50px] text-center"
                                  />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2 mt-6 flex-wrap">
                <button onClick={handleSaveAll} disabled={saving} className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200">
                  {saving ? 'Saving...' : 'Save All'}
                </button>
                <button onClick={handleCompile} disabled={compiling || saving} className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600">
                  {compiling ? 'Compiling...' : 'Compile & Calculate Results'}
                </button>
              </div>
            </>
          )}

          {/* Inline results after compilation */}
          {results && results.length > 0 && (
            <div className="mt-8 flex flex-col gap-5">
              <h3 className="mb-0">Results — {selectedEvent.name} ({selectedRound})</h3>

              {/* Judge Grid */}
              {gridJudges.length > 0 && (
                gridDances.length > 1 ? (
                  gridDances.map(dance => (
                    <div key={dance}>
                      <h4 className="text-sm mb-1.5 capitalize">{dance}</h4>
                      <JudgeGrid results={results} judges={gridJudges} isRecall={isRecallRound} dance={dance} />
                    </div>
                  ))
                ) : (
                  <JudgeGrid results={results} judges={gridJudges} isRecall={isRecallRound} />
                )
              )}

              {/* Skating breakdown for standard finals */}
              {!isRecallRound && !isProficiency && results.some(r => r.skatingDetail) && gridDances.length <= 1 && (
                <div>
                  <h4 className="text-sm mb-1.5">Skating System Breakdown</h4>
                  <SkatingBreakdown results={results} numJudges={gridJudges.length} />
                </div>
              )}

              {/* Per-dance skating for multi-dance finals */}
              {!isRecallRound && !isProficiency && gridDances.length > 1 && results.some(r => r.danceDetails?.some(d => d.skatingDetail)) && (
                gridDances.map(dance => {
                  const danceResults = results.map(r => {
                    const dd = r.danceDetails?.find(d => d.dance === dance);
                    if (!dd?.skatingDetail) return null;
                    return { ...r, skatingDetail: dd.skatingDetail, place: dd.placement };
                  }).filter(Boolean) as EventResult[];
                  if (danceResults.length === 0) return null;
                  return (
                    <div key={`skating-${dance}`}>
                      <h4 className="text-sm mb-1.5 capitalize">Skating: {dance}</h4>
                      <SkatingBreakdown results={danceResults} numJudges={gridJudges.length} />
                    </div>
                  );
                })
              )}

              {/* Multi-dance summary */}
              {gridDances.length > 1 && !isRecallRound && (
                <div>
                  <h4 className="text-sm mb-1.5">Overall Placement</h4>
                  <MultiDanceSummary results={results} dances={gridDances} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Event Browser View ───
  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h2>Scrutineer — {activeCompetition.name}</h2>
        <p className="text-gray-500 text-sm mb-6">
          Select an event and round to enter scores from paper judging sheets.
        </p>

        {error && <div className="px-4 py-3 bg-red-100 text-red-700 rounded text-sm mb-4">{error}</div>}

        {events.length === 0 ? (
          <p className="text-center py-8 text-gray-500">No events created yet.</p>
        ) : (
          sectionOrder.filter(s => groupedEvents[s]?.length > 0).map(style => {
            const sectionEvents = groupedEvents[style];
            const collapsed = collapsedSections[style];
            return (
              <div key={style} className="mb-4">
                <div
                  onClick={() => setCollapsedSections(prev => ({ ...prev, [style]: !prev[style] }))}
                  className="flex justify-between items-center px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-md cursor-pointer select-none"
                >
                  <strong>{style}</strong>
                  <span className="text-gray-500 text-sm">
                    {sectionEvents.length} event{sectionEvents.length !== 1 ? 's' : ''} {collapsed ? '\u25B8' : '\u25BE'}
                  </span>
                </div>

                {!collapsed && (
                  <div className="flex flex-col gap-1.5 mt-1.5">
                    {sectionEvents.map(evt => {
                      const bibCount = evt.heats[0]?.bibs.length || 0;
                      const defaultRound = evt.heats[evt.heats.length - 1]?.round;
                      return (
                        <div
                          key={evt.id}
                          onClick={() => defaultRound && openScoringGrid(evt, defaultRound)}
                          className="flex justify-between items-center px-3 py-2.5 border border-gray-200 rounded bg-white cursor-pointer transition-colors hover:bg-gray-50"
                        >
                          <div className="flex-1">
                            <span className="font-medium">{evt.name}</span>
                            <span className="text-gray-400 text-[0.8125rem] ml-2">
                              {bibCount} couple{bibCount !== 1 ? 's' : ''}
                              {evt.dances && evt.dances.length > 1 && ` \u00B7 ${evt.dances.length} dances`}
                            </span>
                          </div>
                          <div className="flex gap-1.5">
                            {evt.heats.map(heat => (
                              <button
                                key={heat.round}
                                onClick={e => { e.stopPropagation(); openScoringGrid(evt, heat.round); }}
                                className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-[0.8125rem] font-medium transition-colors hover:bg-gray-200 capitalize"
                              >
                                {heat.round}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ScrutineerPage;
