import { useEffect, useState } from 'react';
import { eventsApi, couplesApi, scrutineerApi } from '../api/client';
import { Event, Couple, EventResult } from '../types';
import { useCompetition } from '../context/CompetitionContext';
import { useAuth } from '../context/AuthContext';
import { InputMethod, CoupleInfo } from './JudgeScoring/types';
import InputMethodToggle from './JudgeScoring/components/InputMethodToggle';
import RecallForm from './JudgeScoring/components/RecallForm';
import RankingForm from './JudgeScoring/components/RankingForm';
import TapToRankForm from './JudgeScoring/components/TapToRankForm';
import PickerRankForm from './JudgeScoring/components/PickerRankForm';
import ProficiencyForm from './JudgeScoring/components/ProficiencyForm';
import QuickScoreForm from './JudgeScoring/components/QuickScoreForm';

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

  if (authLoading || loading) return <div className="loading">Loading...</div>;
  if (!isAdmin) {
    return (
      <div className="container"><div className="card">
        <h2>Access Denied</h2>
        <p>You must be an admin to access the scrutineer view.</p>
      </div></div>
    );
  }
  if (!activeCompetition) {
    return <div className="container"><div className="card"><p>No competition selected.</p></div></div>;
  }

  // ─── Scoring Grid View ───
  if (selectedEvent && selectedRound) {
    const isProficiency = scoringType === 'proficiency';

    return (
      <div className="container">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <button onClick={closeScoringGrid} className="btn btn-secondary" style={{ marginRight: '1rem', fontSize: '0.875rem' }}>
                &larr; Back to Events
              </button>
              <span style={{ fontWeight: 600, fontSize: '1.125rem' }}>{selectedEvent.name}</span>
            </div>
          </div>

          {/* Round tabs */}
          <div style={{
            display: 'flex', gap: '0.25rem', marginBottom: '1rem',
            borderBottom: '2px solid #e2e8f0', paddingBottom: '0',
          }}>
            {selectedEvent.heats.map(heat => (
              <button
                key={heat.round}
                onClick={() => { if (heat.round !== selectedRound) openScoringGrid(selectedEvent!, heat.round); }}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  cursor: heat.round === selectedRound ? 'default' : 'pointer',
                  fontWeight: heat.round === selectedRound ? 600 : 400,
                  color: heat.round === selectedRound ? '#667eea' : '#4a5568',
                  borderBottom: heat.round === selectedRound ? '3px solid #667eea' : '3px solid transparent',
                  marginBottom: '-2px',
                  textTransform: 'capitalize',
                  fontSize: '0.9375rem',
                  transition: 'color 0.15s, border-color 0.15s',
                }}
              >
                {heat.round}
              </button>
            ))}
          </div>

          {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

          {/* Scoring type info */}
          <div style={{
            background: isProficiency ? '#f0fff4' : isRecallRound ? '#fef3c7' : '#e6f7ff',
            border: `1px solid ${isProficiency ? '#38a169' : isRecallRound ? '#f59e0b' : '#1890ff'}`,
            padding: '0.75rem 1rem',
            borderRadius: '4px',
            marginBottom: '1rem',
            fontSize: '0.875rem',
          }}>
            <strong>
              {isProficiency ? 'Proficiency Scoring' : isRecallRound ? 'Recall Round' : 'Final Round'}
            </strong>
            <span style={{ marginLeft: '0.5rem', color: '#4a5568' }}>
              {isProficiency
                ? '— Enter scores 0-100 for each couple.'
                : isRecallRound
                  ? '— Check couples to recall to the next round.'
                  : '— Enter rankings (1 = best).'}
            </span>
          </div>

          {/* Entry mode toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            {/* Multi-dance tabs */}
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {gridDances.length > 0 && gridDances.map(dance => (
                <button
                  key={dance}
                  onClick={() => setActiveDance(dance)}
                  className={`btn ${activeDance === dance ? '' : 'btn-secondary'}`}
                  style={{ fontSize: '0.875rem', textTransform: 'capitalize' }}
                >
                  {dance}
                </button>
              ))}
            </div>

            {/* Grid / Per-Judge toggle */}
            <div style={{
              display: 'flex', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden',
            }}>
              {([['grid', 'Grid'], ['per-judge', 'Per-Judge']] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => handleInputModeChange(mode)}
                  style={{
                    padding: '0.375rem 0.75rem',
                    border: 'none',
                    background: inputMode === mode ? '#667eea' : 'transparent',
                    color: inputMode === mode ? 'white' : '#4a5568',
                    fontWeight: inputMode === mode ? 700 : 500,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {gridLoading ? (
            <div className="loading">Loading scores...</div>
          ) : gridBibs.length === 0 ? (
            <p style={{ color: '#718096', textAlign: 'center', padding: '2rem' }}>No couples in this round.</p>
          ) : inputMode === 'per-judge' ? (
            /* ── Per-Judge Mode ── */
            <>
              {/* Judge selector tabs */}
              <div style={{
                display: 'flex', gap: '0.25rem', marginBottom: '0.75rem',
                overflowX: 'auto', WebkitOverflowScrolling: 'touch',
              }}>
                {gridJudges.map(judge => {
                  const active = activeJudgeId === judge.id;
                  return (
                    <button
                      key={judge.id}
                      onClick={() => setActiveJudgeId(judge.id)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        border: active ? '2px solid #667eea' : '1px solid #e2e8f0',
                        borderRadius: '6px',
                        background: active ? '#eef2ff' : 'white',
                        color: active ? '#667eea' : '#4a5568',
                        fontWeight: active ? 600 : 400,
                        fontSize: '0.8125rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s',
                      }}
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

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                      <button onClick={() => handleSaveJudge(activeJudgeId)} disabled={saving} className="btn btn-secondary">
                        {saving ? 'Saving...' : `Save Judge #${gridJudges.find(j => j.id === activeJudgeId)?.judgeNumber || ''}`}
                      </button>
                      <button onClick={handleSaveAll} disabled={saving} className="btn btn-secondary">
                        {saving ? 'Saving...' : 'Save All Judges'}
                      </button>
                      <button onClick={handleCompile} disabled={compiling || saving} className="btn">
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
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Bib</th>
                      <th>Leader</th>
                      <th>Follower</th>
                      {gridJudges.map(judge => (
                        <th key={judge.id} style={{ textAlign: 'center', minWidth: '80px' }}>
                          <div>#{judge.judgeNumber}: {judge.name}{judge.isChairman ? ' \u2605' : ''}</div>
                          <button
                            onClick={() => handleSaveJudge(judge.id)}
                            disabled={saving}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.6875rem', padding: '0.125rem 0.5rem', marginTop: '0.25rem' }}
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
                              <td key={judge.id} style={{ textAlign: 'center' }}>
                                {isProficiency ? (
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={scores[key] ?? ''}
                                    onChange={e => handleScoreChange(judge.id, bib, e.target.value)}
                                    style={{ width: '60px', textAlign: 'center' }}
                                  />
                                ) : isRecallRound ? (
                                  <input
                                    type="checkbox"
                                    checked={scores[key] === 1}
                                    onChange={() => handleScoreChange(judge.id, bib, '')}
                                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                  />
                                ) : (
                                  <input
                                    type="number"
                                    min="1"
                                    max={gridBibs.length}
                                    value={scores[key] ?? ''}
                                    onChange={e => handleScoreChange(judge.id, bib, e.target.value)}
                                    style={{ width: '50px', textAlign: 'center' }}
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

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                <button onClick={handleSaveAll} disabled={saving} className="btn btn-secondary">
                  {saving ? 'Saving...' : 'Save All'}
                </button>
                <button onClick={handleCompile} disabled={compiling || saving} className="btn">
                  {compiling ? 'Compiling...' : 'Compile & Calculate Results'}
                </button>
              </div>
            </>
          )}

          {/* Inline results after compilation */}
          {results && results.length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              <h3 style={{ marginBottom: '0.75rem' }}>Results — {selectedEvent.name} ({selectedRound})</h3>
              <table>
                <thead>
                  <tr>
                    <th>Place</th>
                    <th>Bib</th>
                    <th>Leader</th>
                    <th>Follower</th>
                    {isRecallRound ? <th>Marks</th> : isProficiency ? <th>Score</th> : <th>Rank</th>}
                    <th>Scores</th>
                    {isRecallRound && <th>Recalled</th>}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, idx) => (
                    <tr key={r.bib} style={{ background: r.isRecall ? '#f0fff4' : undefined }}>
                      <td><strong>{idx + 1}</strong></td>
                      <td>#{r.bib}</td>
                      <td>{r.leaderName}</td>
                      <td>{r.followerName}</td>
                      {isRecallRound
                        ? <td>{r.totalMarks}</td>
                        : isProficiency
                          ? <td>{r.totalScore?.toFixed(1)}</td>
                          : <td>{r.totalRank}</td>}
                      <td>{r.scores.join(', ')}</td>
                      {isRecallRound && <td>{r.isRecall ? 'Yes' : 'No'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Event Browser View ───
  return (
    <div className="container">
      <div className="card">
        <h2>Scrutineer — {activeCompetition.name}</h2>
        <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Select an event and round to enter scores from paper judging sheets.
        </p>

        {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

        {events.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>No events created yet.</p>
        ) : (
          sectionOrder.filter(s => groupedEvents[s]?.length > 0).map(style => {
            const sectionEvents = groupedEvents[style];
            const collapsed = collapsedSections[style];
            return (
              <div key={style} style={{ marginBottom: '1rem' }}>
                <div
                  onClick={() => setCollapsedSections(prev => ({ ...prev, [style]: !prev[style] }))}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.625rem 0.75rem',
                    background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '6px',
                    cursor: 'pointer', userSelect: 'none',
                  }}
                >
                  <strong>{style}</strong>
                  <span style={{ color: '#718096', fontSize: '0.875rem' }}>
                    {sectionEvents.length} event{sectionEvents.length !== 1 ? 's' : ''} {collapsed ? '▸' : '▾'}
                  </span>
                </div>

                {!collapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.375rem' }}>
                    {sectionEvents.map(evt => {
                      const bibCount = evt.heats[0]?.bibs.length || 0;
                      const defaultRound = evt.heats[evt.heats.length - 1]?.round;
                      return (
                        <div
                          key={evt.id}
                          onClick={() => defaultRound && openScoringGrid(evt, defaultRound)}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '0.625rem 0.75rem',
                            border: '1px solid #e2e8f0', borderRadius: '4px',
                            background: 'white',
                            cursor: 'pointer',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f7fafc')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                        >
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 500 }}>{evt.name}</span>
                            <span style={{ color: '#a0aec0', fontSize: '0.8125rem', marginLeft: '0.5rem' }}>
                              {bibCount} couple{bibCount !== 1 ? 's' : ''}
                              {evt.dances && evt.dances.length > 1 && ` · ${evt.dances.length} dances`}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.375rem' }}>
                            {evt.heats.map(heat => (
                              <button
                                key={heat.round}
                                onClick={e => { e.stopPropagation(); openScoringGrid(evt, heat.round); }}
                                className="btn btn-secondary"
                                style={{ fontSize: '0.8125rem', padding: '0.25rem 0.625rem', textTransform: 'capitalize' }}
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
