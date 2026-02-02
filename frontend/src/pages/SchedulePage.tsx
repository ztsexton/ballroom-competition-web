import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsApi, schedulesApi, competitionsApi } from '../api/client';
import { Event, CompetitionSchedule, Competition, JudgeSettings, TimingSettings, ScheduledHeat, HeatEntry } from '../types';
import { useAuth } from '../context/AuthContext';

import { DEFAULT_LEVELS } from '../constants/levels';

const DEFAULT_STYLE_ORDER = ['Smooth', 'Rhythm', 'Standard', 'Latin'];

const SchedulePage = () => {
  const { id } = useParams<{ id: string }>();
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const competitionId = parseInt(id || '0');

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [schedule, setSchedule] = useState<CompetitionSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [styleOrder, setStyleOrder] = useState<string[]>(DEFAULT_STYLE_ORDER);
  const [levelOrder, setLevelOrder] = useState<string[]>(DEFAULT_LEVELS);
  const [judgeSettings, setJudgeSettings] = useState<JudgeSettings>({ defaultCount: 3, levelOverrides: {} });
  const [timingSettings, setTimingSettings] = useState<TimingSettings>({
    defaultDanceDurationSeconds: 75,
    betweenDanceSeconds: 35,
    betweenHeatSeconds: 45,
  });

  // Drag-and-drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // New event insertion state
  const [unscheduledEvents, setUnscheduledEvents] = useState<Event[]>([]);
  const [suggestedPositions, setSuggestedPositions] = useState<Record<number, number>>({});
  const [customPositions, setCustomPositions] = useState<Record<number, number>>({});

  // Expanded heats for viewing/editing entries
  const [expandedHeats, setExpandedHeats] = useState<Record<string, boolean>>({});
  // Merge mode: which heat is being merged and into which target
  const [mergeSource, setMergeSource] = useState<{ heatId: string; idx: number } | null>(null);
  const [mergeSelected, setMergeSelected] = useState<Set<string>>(new Set());

  // Break insertion state
  const [showBreakForm, setShowBreakForm] = useState(false);
  const [breakLabel, setBreakLabel] = useState('');
  const [breakDuration, setBreakDuration] = useState<number | ''>('');
  const [breakPosition, setBreakPosition] = useState<number>(0);

  const loadData = useCallback(async () => {
    if (!competitionId) return;

    try {
      const [compRes, eventsRes] = await Promise.all([
        competitionsApi.getById(competitionId),
        eventsApi.getAll(competitionId),
      ]);
      setCompetition(compRes.data);
      if (compRes.data.levels && compRes.data.levels.length > 0) {
        setLevelOrder(compRes.data.levels);
      }
      if (compRes.data.judgeSettings) {
        setJudgeSettings(compRes.data.judgeSettings);
      }
      if (compRes.data.timingSettings) {
        setTimingSettings(prev => ({ ...prev, ...compRes.data.timingSettings }));
      }
      const eventList = Object.values(eventsRes.data);
      setEvents(eventList);

      try {
        const schedRes = await schedulesApi.get(competitionId);
        setSchedule(schedRes.data);
        setStyleOrder(schedRes.data.styleOrder);
        setLevelOrder(schedRes.data.levelOrder);

        // Detect events not in the schedule
        const scheduledIds = new Set<number>();
        for (const heat of schedRes.data.heatOrder) {
          for (const entry of heat.entries) {
            scheduledIds.add(entry.eventId);
          }
        }
        const unscheduled = eventList.filter(e => !scheduledIds.has(e.id));
        setUnscheduledEvents(unscheduled);

        // Get suggested positions for unscheduled events
        if (unscheduled.length > 0) {
          const suggestions: Record<number, number> = {};
          const defaults: Record<number, number> = {};
          for (const event of unscheduled) {
            try {
              const suggestRes = await schedulesApi.suggestPosition(competitionId, event.id);
              suggestions[event.id] = suggestRes.data.position;
              defaults[event.id] = suggestRes.data.position;
            } catch {
              suggestions[event.id] = schedRes.data.heatOrder.length;
              defaults[event.id] = schedRes.data.heatOrder.length;
            }
          }
          setSuggestedPositions(suggestions);
          setCustomPositions(defaults);
        }
      } catch {
        setSchedule(null);
        setUnscheduledEvents([]);
      }

      setError('');
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  useEffect(() => {
    if (competitionId) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [competitionId, loadData]);

  const handleGenerate = async () => {
    if (!competitionId) return;

    try {
      const res = await schedulesApi.generate(competitionId, styleOrder, levelOrder, judgeSettings, timingSettings);
      setSchedule(res.data);
      setUnscheduledEvents([]);
      setError('');
    } catch {
      setError('Failed to generate schedule');
    }
  };

  const handleRegenerate = async () => {
    if (!window.confirm(
      'This will regenerate the schedule from scratch, clearing any custom ordering and run progress. Continue?'
    )) return;
    await handleGenerate();
  };

  const handleMoveEvent = async (fromIndex: number, toIndex: number) => {
    if (!competitionId || !schedule) return;

    try {
      const res = await schedulesApi.reorder(competitionId, fromIndex, toIndex);
      setSchedule(res.data);
    } catch {
      setError('Failed to reorder event');
    }
  };

  const handleInsertEvent = async (eventId: number, position: number) => {
    if (!competitionId) return;

    try {
      const res = await schedulesApi.insert(competitionId, eventId, position);
      setSchedule(res.data);
      setUnscheduledEvents(prev => prev.filter(e => e.id !== eventId));
      setError('');
    } catch {
      setError('Failed to insert event');
    }
  };

  const handleDelete = async () => {
    if (!competitionId) return;
    if (!window.confirm('Delete the schedule? This will reset all run progress.')) return;

    try {
      await schedulesApi.delete(competitionId);
      setSchedule(null);
      setUnscheduledEvents([]);
      setError('');
    } catch {
      setError('Failed to delete schedule');
    }
  };

  const handleAddBreak = async () => {
    if (!competitionId || !breakLabel.trim()) return;
    try {
      const res = await schedulesApi.addBreak(
        competitionId,
        breakLabel.trim(),
        breakDuration || undefined,
        breakPosition,
      );
      setSchedule(res.data);
      setBreakLabel('');
      setBreakDuration('');
      setShowBreakForm(false);
      setError('');
    } catch {
      setError('Failed to add break');
    }
  };

  const handleRemoveBreak = async (heatIndex: number) => {
    if (!competitionId) return;
    try {
      const res = await schedulesApi.removeBreak(competitionId, heatIndex);
      setSchedule(res.data);
    } catch {
      setError('Failed to remove break');
    }
  };

  const toggleExpanded = (heatId: string) => {
    setExpandedHeats(prev => ({ ...prev, [heatId]: !prev[heatId] }));
  };

  const handleSplitEntry = async (heatId: string, eventId: number, round: string) => {
    if (!competitionId) return;
    try {
      const res = await schedulesApi.splitHeatEntry(competitionId, heatId, eventId, round);
      setSchedule(res.data);
      setError('');
    } catch {
      setError('Failed to split entry from heat');
    }
  };

  const toggleMergeSelection = (heatId: string) => {
    setMergeSelected(prev => {
      const next = new Set(prev);
      if (next.has(heatId)) {
        next.delete(heatId);
      } else {
        next.add(heatId);
      }
      return next;
    });
  };

  const handleMergeSelected = async () => {
    if (!competitionId || !schedule || !mergeSource || mergeSelected.size === 0) return;
    const sourceHeat = schedule.heatOrder.find(h => h.id === mergeSource.heatId);
    if (!sourceHeat) return;

    // Collect all entries: source + all selected heats
    const allEntries: HeatEntry[] = [...sourceHeat.entries];
    for (const selectedId of mergeSelected) {
      const selectedHeat = schedule.heatOrder.find(h => h.id === selectedId);
      if (selectedHeat) {
        allEntries.push(...selectedHeat.entries);
      }
    }

    try {
      const res = await schedulesApi.updateHeatEntries(competitionId, mergeSource.heatId, allEntries);
      setSchedule(res.data);
      setMergeSource(null);
      setMergeSelected(new Set());
      setError('');
    } catch {
      setError('Failed to merge heats — entries may be incompatible or exceed max couples per heat');
    }
  };

  const moveItem = (list: string[], fromIdx: number, direction: 'up' | 'down'): string[] => {
    const toIdx = direction === 'up' ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= list.length) return list;
    const newList = [...list];
    [newList[fromIdx], newList[toIdx]] = [newList[toIdx], newList[fromIdx]];
    return newList;
  };

  const handleDragStart = (idx: number) => {
    setDragIndex(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIndex !== null && idx !== dragIndex) {
      setDragOverIndex(idx);
    }
  };

  const handleDragEnd = () => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      handleMoveEvent(dragIndex, dragOverIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const getEventById = (eventId: number) => events.find(e => e.id === eventId);

  const getHeatCoupleCount = (heat: ScheduledHeat): number => {
    let total = 0;
    for (const entry of heat.entries) {
      const event = getEventById(entry.eventId);
      if (event) {
        const allBibs = new Set<number>();
        event.heats.forEach(h => h.bibs.forEach(b => allBibs.add(b)));
        total += allBibs.size;
      }
    }
    return total;
  };

  const getHeatScoringType = (heat: ScheduledHeat): string | null => {
    for (const entry of heat.entries) {
      const event = getEventById(entry.eventId);
      if (event) return event.scoringType || 'standard';
    }
    return null;
  };

  const getHeatPrimaryStyle = (heat: ScheduledHeat): string | null => {
    for (const entry of heat.entries) {
      const event = getEventById(entry.eventId);
      if (event?.style) return event.style;
    }
    return null;
  };

  /** Returns why a heat can't be merged with the source, or null if compatible */
  const getMergeIncompatibilityReason = (sourceHeat: ScheduledHeat, targetHeat: ScheduledHeat): string | null => {
    const srcType = getHeatScoringType(sourceHeat);
    const tgtType = getHeatScoringType(targetHeat);
    if (srcType !== tgtType) return 'Different scoring type';

    const srcStyle = getHeatPrimaryStyle(sourceHeat);
    const tgtStyle = getHeatPrimaryStyle(targetHeat);
    if (srcStyle && tgtStyle && srcStyle !== tgtStyle) return `Different style (${tgtStyle})`;

    return null;
  };

  const maxCouplesPerHeat = competition?.maxCouplesPerHeat ?? 6;

  const getHeatLabel = (heat: ScheduledHeat): string => {
    if (heat.isBreak) return heat.breakLabel || 'Break';
    return heat.entries.map(entry => {
      const event = getEventById(entry.eventId);
      return event?.name || 'Unknown';
    }).join(' + ');
  };

  const getHeatRound = (heat: ScheduledHeat): string => {
    if (heat.entries.length === 0) return '';
    return heat.entries[0].round;
  };

  const getHeatStyle = (heat: ScheduledHeat): string => {
    const styles = new Set(heat.entries.map(e => getEventById(e.eventId)?.style).filter(Boolean));
    return styles.size > 0 ? [...styles].join(', ') : '\u2014';
  };

  const getHeatLevel = (heat: ScheduledHeat): string => {
    const levels = heat.entries.map(e => getEventById(e.eventId)?.level).filter(Boolean);
    if (levels.length === 0) return '\u2014';
    if (new Set(levels).size === 1) return levels[0]!;
    return levels.join(', ');
  };

  const formatTime = (isoString?: string): string => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      pending: { bg: '#e2e8f0', color: '#4a5568' },
      scoring: { bg: '#fefcbf', color: '#975a16' },
      completed: { bg: '#c6f6d5', color: '#276749' },
    };
    const c = colors[status] || colors.pending;
    return (
      <span style={{
        padding: '0.125rem 0.5rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: c.bg,
        color: c.color,
      }}>
        {status}
      </span>
    );
  };

  if (loading || authLoading) return <div className="loading">Loading...</div>;

  if (!isAdmin) {
    return (
      <div className="container">
        <div className="card">
          <h2>Access Denied</h2>
          <p>You must be an admin to manage schedules.</p>
        </div>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="container">
        <div className="card">
          <h2>Competition not found</h2>
          <button className="btn btn-secondary" onClick={() => navigate('/competitions')} style={{ marginTop: '1rem' }}>
            Back to Competitions
          </button>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="container">
        <div className="card">
          <h2>Competition Schedule - {competition.name}</h2>
          <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
            <h3>No events created yet</h3>
            <p>Create events first before generating a schedule.</p>
          </div>
          <button className="btn btn-secondary" onClick={() => navigate(`/competitions/${competitionId}`)}>
            Back to Competition
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <h2>Competition Schedule - {competition.name}</h2>
        <p style={{ color: '#718096', marginTop: '0.5rem' }}>
          Configure the event order for your competition, then run it from the announcer interface.
        </p>

        {error && <div className="error">{error}</div>}

        {!schedule ? (
          <>
            <div style={{ marginTop: '1.5rem' }}>
              <h3>Style Order</h3>
              <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Events are grouped by style first. Use arrows to set priority.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '300px' }}>
                {styleOrder.map((style, idx) => (
                  <div key={style} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem',
                    background: '#f7fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                  }}>
                    <span style={{ fontWeight: 600, minWidth: '1.5rem' }}>{idx + 1}.</span>
                    <span style={{ flex: 1 }}>{style}</span>
                    <button
                      onClick={() => setStyleOrder(moveItem(styleOrder, idx, 'up'))}
                      disabled={idx === 0}
                      style={{ padding: '0.125rem 0.375rem', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1 }}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => setStyleOrder(moveItem(styleOrder, idx, 'down'))}
                      disabled={idx === styleOrder.length - 1}
                      style={{ padding: '0.125rem 0.375rem', cursor: idx === styleOrder.length - 1 ? 'default' : 'pointer', opacity: idx === styleOrder.length - 1 ? 0.3 : 1 }}
                    >
                      ▼
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <h3>Level Order</h3>
              <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Within each style, events are sorted by level.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '300px' }}>
                {levelOrder.map((level, idx) => (
                  <div key={level} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem',
                    background: '#f7fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                  }}>
                    <span style={{ fontWeight: 600, minWidth: '1.5rem' }}>{idx + 1}.</span>
                    <span style={{ flex: 1 }}>{level}</span>
                    <button
                      onClick={() => setLevelOrder(moveItem(levelOrder, idx, 'up'))}
                      disabled={idx === 0}
                      style={{ padding: '0.125rem 0.375rem', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1 }}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => setLevelOrder(moveItem(levelOrder, idx, 'down'))}
                      disabled={idx === levelOrder.length - 1}
                      style={{ padding: '0.125rem 0.375rem', cursor: idx === levelOrder.length - 1 ? 'default' : 'pointer', opacity: idx === levelOrder.length - 1 ? 0.3 : 1 }}
                    >
                      ▼
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <h3>Judge Assignment</h3>
              <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Judges are automatically rotated across heats. Set the number required per level.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '300px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <label style={{ flex: 1, fontWeight: 600 }}>Default count</label>
                  <input
                    type="number"
                    min={1}
                    value={judgeSettings.defaultCount}
                    onChange={(e) => setJudgeSettings(prev => ({ ...prev, defaultCount: Math.max(1, parseInt(e.target.value) || 1) }))}
                    style={{ width: '4rem', padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0', textAlign: 'center' }}
                  />
                </div>
                {levelOrder.map(level => (
                  <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <label style={{ flex: 1, color: '#4a5568' }}>{level}</label>
                    <input
                      type="number"
                      min={1}
                      placeholder={String(judgeSettings.defaultCount)}
                      value={judgeSettings.levelOverrides[level] ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setJudgeSettings(prev => {
                          const overrides = { ...prev.levelOverrides };
                          if (val === '' || parseInt(val) === prev.defaultCount) {
                            delete overrides[level];
                          } else {
                            overrides[level] = Math.max(1, parseInt(val) || 1);
                          }
                          return { ...prev, levelOverrides: overrides };
                        });
                      }}
                      style={{ width: '4rem', padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0', textAlign: 'center' }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <h3>Timing Settings</h3>
              <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Configure dance durations and transition times to estimate the schedule timeline.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '400px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <label style={{ flex: 1, fontWeight: 600 }}>Start time</label>
                  <input
                    type="datetime-local"
                    value={timingSettings.startTime || ''}
                    onChange={(e) => setTimingSettings(prev => ({ ...prev, startTime: e.target.value || undefined }))}
                    style={{ padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <label style={{ flex: 1, fontWeight: 600 }}>Default dance duration (sec)</label>
                  <input
                    type="number"
                    min={1}
                    value={timingSettings.defaultDanceDurationSeconds}
                    onChange={(e) => setTimingSettings(prev => ({ ...prev, defaultDanceDurationSeconds: Math.max(1, parseInt(e.target.value) || 75) }))}
                    style={{ width: '5rem', padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0', textAlign: 'center' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <label style={{ flex: 1, fontWeight: 600 }}>Scholarship duration (sec)</label>
                  <input
                    type="number"
                    min={1}
                    placeholder="90"
                    value={timingSettings.scholarshipDurationSeconds ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTimingSettings(prev => ({
                        ...prev,
                        scholarshipDurationSeconds: val === '' ? undefined : Math.max(1, parseInt(val) || 90),
                      }));
                    }}
                    style={{ width: '5rem', padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0', textAlign: 'center' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <label style={{ flex: 1, fontWeight: 600 }}>Between dances (sec)</label>
                  <input
                    type="number"
                    min={0}
                    value={timingSettings.betweenDanceSeconds}
                    onChange={(e) => setTimingSettings(prev => ({ ...prev, betweenDanceSeconds: Math.max(0, parseInt(e.target.value) || 0) }))}
                    style={{ width: '5rem', padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0', textAlign: 'center' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <label style={{ flex: 1, fontWeight: 600 }}>Between heats (sec)</label>
                  <input
                    type="number"
                    min={0}
                    value={timingSettings.betweenHeatSeconds}
                    onChange={(e) => setTimingSettings(prev => ({ ...prev, betweenHeatSeconds: Math.max(0, parseInt(e.target.value) || 0) }))}
                    style={{ width: '5rem', padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0', textAlign: 'center' }}
                  />
                </div>
                <div style={{ marginTop: '0.25rem' }}>
                  <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.375rem' }}>Duration overrides by level (sec)</label>
                  {levelOrder.map(level => (
                    <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                      <label style={{ flex: 1, color: '#4a5568' }}>{level}</label>
                      <input
                        type="number"
                        min={1}
                        placeholder={String(timingSettings.defaultDanceDurationSeconds)}
                        value={timingSettings.levelDurationOverrides?.[level] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTimingSettings(prev => {
                            const overrides = { ...prev.levelDurationOverrides };
                            if (val === '' || parseInt(val) === prev.defaultDanceDurationSeconds) {
                              delete overrides[level];
                            } else {
                              overrides[level] = Math.max(1, parseInt(val) || 1);
                            }
                            return { ...prev, levelDurationOverrides: Object.keys(overrides).length > 0 ? overrides : undefined };
                          });
                        }}
                        style={{ width: '5rem', padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0', textAlign: 'center' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <button className="btn" onClick={handleGenerate}>
                Generate Schedule ({events.length} events)
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Unscheduled events banner */}
            {unscheduledEvents.length > 0 && (
              <div style={{
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '8px',
                padding: '1rem',
                marginTop: '1rem',
              }}>
                <h3 style={{ marginBottom: '0.5rem', color: '#92400e' }}>
                  {unscheduledEvents.length} New Event{unscheduledEvents.length > 1 ? 's' : ''} Not in Schedule
                </h3>
                <p style={{ color: '#78350f', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                  These events were added after the schedule was generated. Choose where to insert each one.
                </p>
                {unscheduledEvents.map(event => {
                  const suggested = suggestedPositions[event.id] ?? schedule.heatOrder.length;
                  const current = customPositions[event.id] ?? suggested;
                  const positionLabel = (pos: number) => {
                    if (pos === 0) return 'At the beginning';
                    if (pos >= schedule.heatOrder.length) return 'At the end';
                    const afterHeat = schedule.heatOrder[pos - 1];
                    const afterLabel = getHeatLabel(afterHeat);
                    const afterRound = getHeatRound(afterHeat);
                    return `Position ${pos + 1} (after ${afterLabel} ${afterRound})`;
                  };

                  return (
                    <div key={event.id} style={{
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <strong>{event.name}</strong>
                          <span style={{ color: '#718096', fontSize: '0.875rem', marginLeft: '0.5rem' }}>
                            {[event.style, event.level].filter(Boolean).join(' - ')}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <select
                            value={current}
                            onChange={(e) => setCustomPositions(prev => ({
                              ...prev,
                              [event.id]: parseInt(e.target.value),
                            }))}
                            style={{ padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                          >
                            {Array.from({ length: schedule.heatOrder.length + 1 }, (_, i) => (
                              <option key={i} value={i}>
                                {positionLabel(i)}{i === suggested ? ' (suggested)' : ''}
                              </option>
                            ))}
                          </select>
                          <button
                            className="btn"
                            style={{ fontSize: '0.875rem', padding: '0.375rem 0.75rem' }}
                            onClick={() => handleInsertEvent(event.id, current)}
                          >
                            Insert
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button
                className="btn btn-success"
                onClick={() => navigate(`/competitions/${competitionId}/run`)}
              >
                Run Competition
              </button>
              <button className="btn btn-secondary" onClick={handleRegenerate}>
                Regenerate Schedule
              </button>
              <button className="btn btn-secondary" onClick={() => {
                if (schedule) setBreakPosition(schedule.heatOrder.length);
                setShowBreakForm(!showBreakForm);
              }}>
                {showBreakForm ? 'Cancel Break' : 'Add Break'}
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                Delete Schedule
              </button>
            </div>

            {showBreakForm && schedule && (
              <div style={{
                background: '#f7fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '1rem',
                marginTop: '0.75rem',
              }}>
                <h4 style={{ marginBottom: '0.5rem', marginTop: 0 }}>Add Break</h4>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Label *</label>
                    <input
                      type="text"
                      value={breakLabel}
                      onChange={(e) => setBreakLabel(e.target.value)}
                      placeholder="e.g. Lunch Break"
                      style={{ padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Duration (min)</label>
                    <input
                      type="number"
                      value={breakDuration}
                      onChange={(e) => setBreakDuration(e.target.value ? parseInt(e.target.value) : '')}
                      placeholder="Optional"
                      min={1}
                      style={{ width: '5rem', padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Position</label>
                    <select
                      value={breakPosition}
                      onChange={(e) => setBreakPosition(parseInt(e.target.value))}
                      style={{ padding: '0.375rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                    >
                      {Array.from({ length: schedule.heatOrder.length + 1 }, (_, i) => (
                        <option key={i} value={i}>
                          {i === 0 ? 'At the beginning' : i >= schedule.heatOrder.length ? 'At the end' : `Position ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button className="btn" onClick={handleAddBreak} disabled={!breakLabel.trim()}>
                    Insert Break
                  </button>
                </div>
              </div>
            )}

            {mergeSource && (() => {
              const sourceHeat = schedule.heatOrder.find(h => h.id === mergeSource.heatId);
              const sourceCouples = sourceHeat ? getHeatCoupleCount(sourceHeat) : 0;
              const sourceLabel = sourceHeat ? sourceHeat.entries.map(e => {
                const ev = getEventById(e.eventId);
                return ev?.name || `Event #${e.eventId}`;
              }).join(' + ') : '';

              let selectedCouples = 0;
              for (const selectedId of mergeSelected) {
                const h = schedule.heatOrder.find(x => x.id === selectedId);
                if (h) selectedCouples += getHeatCoupleCount(h);
              }
              const totalCouples = sourceCouples + selectedCouples;
              const overLimit = totalCouples > maxCouplesPerHeat;

              // Compute dance overlap info for all involved heats
              type DanceInfo = { name: string; dances: string[] };
              const allInvolvedEvents: DanceInfo[] = [];
              const collectEvents = (heat: ScheduledHeat) => {
                for (const entry of heat.entries) {
                  const ev = getEventById(entry.eventId);
                  if (ev) allInvolvedEvents.push({ name: ev.name, dances: ev.dances || [] });
                }
              };
              if (sourceHeat) collectEvents(sourceHeat);
              for (const selectedId of mergeSelected) {
                const h = schedule.heatOrder.find(x => x.id === selectedId);
                if (h) collectEvents(h);
              }

              // Build the full dance order (union) and find early exits
              const allDanceLists = allInvolvedEvents.map(e => e.dances).filter(d => d.length > 0);
              const longestList = allDanceLists.reduce((a, b) => a.length >= b.length ? a : b, [] as string[]);
              const fullDanceOrder = [...longestList];
              for (const list of allDanceLists) {
                for (const d of list) {
                  if (!fullDanceOrder.includes(d)) fullDanceOrder.push(d);
                }
              }

              const hasDanceDifferences = mergeSelected.size > 0 && allDanceLists.length > 1 &&
                !allDanceLists.every(list =>
                  list.length === allDanceLists[0].length &&
                  list.every((d, i) => d === allDanceLists[0][i])
                );

              // Find which events exit early (have fewer dances than the max)
              const earlyExits: { name: string; exitAfter: string }[] = [];
              if (hasDanceDifferences) {
                const maxDanceCount = Math.max(...allDanceLists.map(d => d.length));
                for (const ev of allInvolvedEvents) {
                  if (ev.dances.length > 0 && ev.dances.length < maxDanceCount) {
                    earlyExits.push({
                      name: ev.name,
                      exitAfter: ev.dances[ev.dances.length - 1],
                    });
                  }
                }
              }

              return (
                <div style={{
                  background: '#ebf8ff',
                  border: '1px solid #63b3ed',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  marginTop: '1rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem' }}>
                      <strong>Merging:</strong> {sourceLabel} ({sourceCouples} couple{sourceCouples !== 1 ? 's' : ''})
                    </span>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => { setMergeSource(null); setMergeSelected(new Set()); }}
                    >
                      Cancel
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#4a5568' }}>
                      Select heats below to merge with this one.
                      {' '}
                      <span style={{
                        fontWeight: 600,
                        color: overLimit ? '#c53030' : '#276749',
                      }}>
                        Total: {totalCouples} / {maxCouplesPerHeat} couples
                      </span>
                    </span>
                    <button
                      className="btn"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}
                      disabled={mergeSelected.size === 0 || overLimit}
                      onClick={handleMergeSelected}
                    >
                      Merge {mergeSelected.size > 0 ? `(${mergeSelected.size})` : ''}
                    </button>
                  </div>
                  {hasDanceDifferences && (
                    <div style={{
                      background: '#fffbeb',
                      border: '1px solid #f59e0b',
                      borderRadius: '6px',
                      padding: '0.5rem 0.75rem',
                      marginTop: '0.5rem',
                      fontSize: '0.8125rem',
                    }}>
                      <strong style={{ color: '#92400e' }}>Different dance lists</strong>
                      <span style={{ color: '#78350f' }}> — combined heat dances: {fullDanceOrder.join(', ')}</span>
                      {earlyExits.length > 0 && (
                        <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem', color: '#92400e' }}>
                          {earlyExits.map(({ name, exitAfter }) => (
                            <li key={name}>
                              <strong>{name}</strong> couples exit the floor after the {exitAfter}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {schedule.heatOrder.length > 0 && schedule.heatOrder[0].estimatedStartTime && (
              <div style={{
                marginTop: '1rem',
                padding: '0.5rem 0.75rem',
                background: '#f0fff4',
                border: '1px solid #c6f6d5',
                borderRadius: '6px',
                fontSize: '0.875rem',
                color: '#276749',
              }}>
                Estimated start: <strong>{formatTime(schedule.heatOrder[0].estimatedStartTime)}</strong>
                {(() => {
                  const lastHeat = schedule.heatOrder[schedule.heatOrder.length - 1];
                  if (lastHeat?.estimatedStartTime && lastHeat?.estimatedDurationSeconds) {
                    const finish = new Date(new Date(lastHeat.estimatedStartTime).getTime() + lastHeat.estimatedDurationSeconds * 1000);
                    return (
                      <span style={{ marginLeft: '1rem' }}>
                        Estimated finish: <strong>{formatTime(finish.toISOString())}</strong>
                      </span>
                    );
                  }
                  return null;
                })()}
                <span style={{ marginLeft: '1rem' }}>
                  ({schedule.heatOrder.length} heats)
                </span>
              </div>
            )}

            <table style={{ marginTop: '1rem' }}>
              <thead>
                <tr>
                  <th style={{ width: '2rem' }}></th>
                  <th>#</th>
                  <th>Event Name</th>
                  <th>Round</th>
                  <th>Style</th>
                  <th>Level</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedule.heatOrder.map((scheduledHeat, idx) => {
                  const isBreak = scheduledHeat.isBreak;
                  const isCurrent = idx === schedule.currentHeatIndex;
                  const isDragging = dragIndex === idx;
                  const isDragOver = dragOverIndex === idx;
                  const status = schedule.heatStatuses[scheduledHeat.id] || 'pending';
                  const isMultiEntry = !isBreak && scheduledHeat.entries.length > 1;
                  const isExpanded = !!expandedHeats[scheduledHeat.id];
                  const isMergeTarget = mergeSource !== null && mergeSource.heatId !== scheduledHeat.id && !isBreak;
                  const isMergeSource = mergeSource !== null && mergeSource.heatId === scheduledHeat.id;
                  const isMergeChecked = mergeSelected.has(scheduledHeat.id);
                  const sourceHeatObj = mergeSource ? schedule.heatOrder.find(h => h.id === mergeSource.heatId) : null;
                  const incompatibilityReason = isMergeTarget && sourceHeatObj
                    ? getMergeIncompatibilityReason(sourceHeatObj, scheduledHeat)
                    : null;
                  const isMergeCompatible = isMergeTarget && incompatibilityReason === null;

                  return (
                    <React.Fragment key={scheduledHeat.id + '-' + idx}>
                      <tr
                        draggable={!mergeSource}
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragEnd={handleDragEnd}
                        onClick={mergeSource && isMergeCompatible ? () => toggleMergeSelection(scheduledHeat.id) : undefined}
                        style={{
                          background: isBreak
                            ? (isDragOver ? '#e2e8f0' : '#fefce8')
                            : isMergeSource
                              ? '#ebf8ff'
                              : isMergeChecked
                                ? '#f0fff4'
                                : (isDragOver ? '#e2e8f0' : isCurrent ? '#ebf8ff' : undefined),
                          opacity: isDragging ? 0.4 : (mergeSource && !isMergeTarget && !isMergeSource ? 0.4 : 1),
                          borderLeft: isMergeSource ? '3px solid #4299e1' : undefined,
                          borderTop: isDragOver && dragIndex !== null && idx < dragIndex ? '2px solid #667eea' : undefined,
                          borderBottom: isDragOver && dragIndex !== null && idx > dragIndex ? '2px solid #667eea' : undefined,
                          transition: 'background 0.15s, opacity 0.15s',
                          fontStyle: isBreak ? 'italic' : undefined,
                          cursor: mergeSource && isMergeTarget ? 'pointer' : undefined,
                        }}
                      >
                        <td style={{ cursor: mergeSource ? 'default' : 'grab', textAlign: 'center', color: '#a0aec0', userSelect: 'none', verticalAlign: 'top' }}>
                          {mergeSource && !isBreak ? (
                            isMergeSource ? null : (
                              <input
                                type="checkbox"
                                checked={isMergeChecked}
                                disabled={!isMergeCompatible}
                                onChange={(e) => { e.stopPropagation(); toggleMergeSelection(scheduledHeat.id); }}
                                style={{ cursor: isMergeCompatible ? 'pointer' : 'not-allowed' }}
                                title={incompatibilityReason || undefined}
                              />
                            )
                          ) : (
                            '☰'
                          )}
                        </td>
                        <td style={{ verticalAlign: 'top' }}><strong>{idx + 1}</strong></td>
                        {isBreak ? (
                          <td colSpan={5}>
                            <span>
                              {scheduledHeat.breakLabel || 'Break'}
                              {scheduledHeat.breakDuration && (
                                <span style={{ color: '#a0aec0', marginLeft: '0.5rem' }}>
                                  ({scheduledHeat.breakDuration} min)
                                </span>
                              )}
                              {scheduledHeat.estimatedStartTime && (
                                <span style={{ color: '#718096', marginLeft: '0.75rem', fontSize: '0.8125rem' }}>
                                  {formatTime(scheduledHeat.estimatedStartTime)}
                                </span>
                              )}
                            </span>
                          </td>
                        ) : (
                          <>
                            <td style={{ verticalAlign: 'top' }}>
                              {isMultiEntry ? (
                                <div style={{ borderLeft: '3px solid #805ad5', paddingLeft: '0.625rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
                                    <span
                                      onClick={(e) => { e.stopPropagation(); toggleExpanded(scheduledHeat.id); }}
                                      style={{ cursor: 'pointer', fontSize: '0.625rem', userSelect: 'none', width: '0.75rem' }}
                                    >
                                      {isExpanded ? '\u25bc' : '\u25b6'}
                                    </span>
                                    <span style={{
                                      padding: '0.125rem 0.375rem',
                                      borderRadius: '9999px',
                                      fontSize: '0.6875rem',
                                      fontWeight: 600,
                                      background: '#e9d8fd',
                                      color: '#553c9a',
                                    }}>
                                      {scheduledHeat.entries.length} combined
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    {scheduledHeat.entries.map((entry) => {
                                      const event = getEventById(entry.eventId);
                                      return (
                                        <div key={`${entry.eventId}-${entry.round}`} style={{
                                          display: 'flex',
                                          alignItems: 'baseline',
                                          gap: '0.5rem',
                                          fontSize: '0.875rem',
                                          lineHeight: '1.3',
                                        }}>
                                          <span style={{
                                            flexShrink: 0,
                                            width: '6px',
                                            height: '6px',
                                            borderRadius: '50%',
                                            background: '#805ad5',
                                            display: 'inline-block',
                                            position: 'relative',
                                            top: '-1px',
                                          }} />
                                          <span>
                                            {event?.name || `Event #${entry.eventId}`}
                                            {mergeSource && event?.dances && event.dances.length > 0 && (
                                              <span style={{ color: '#a0aec0', marginLeft: '0.375rem', fontSize: '0.75rem' }}>
                                                ({event.dances.join(', ')})
                                              </span>
                                            )}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (() => {
                                const entry = scheduledHeat.entries[0];
                                const event = entry ? getEventById(entry.eventId) : undefined;
                                const allBibs = new Set<number>();
                                event?.heats.forEach(h => h.bibs.forEach(b => allBibs.add(b)));
                                const coupleCount = allBibs.size;
                                return (
                                  <div>
                                    <span>
                                      {getHeatLabel(scheduledHeat)}
                                      <span style={{ color: '#a0aec0', marginLeft: '0.5rem', fontSize: '0.8125rem' }}>
                                        ({coupleCount} couple{coupleCount !== 1 ? 's' : ''})
                                      </span>
                                    </span>
                                    {mergeSource && event?.dances && event.dances.length > 0 && (
                                      <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.125rem' }}>
                                        {event.dances.join(', ')}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td style={{ textTransform: 'capitalize', verticalAlign: 'top' }}>{getHeatRound(scheduledHeat)}</td>
                            <td style={{ verticalAlign: 'top' }}>{getHeatStyle(scheduledHeat)}</td>
                            <td style={{ verticalAlign: 'top' }}>{getHeatLevel(scheduledHeat)}</td>
                            <td style={{ verticalAlign: 'top', fontSize: '0.8125rem', color: '#4a5568', whiteSpace: 'nowrap' }}>
                              {scheduledHeat.estimatedStartTime ? formatTime(scheduledHeat.estimatedStartTime) : ''}
                            </td>
                          </>
                        )}
                        <td style={{ verticalAlign: 'top' }}>{statusBadge(status)}</td>
                        <td style={{ verticalAlign: 'top' }}>
                          {mergeSource ? (
                            isMergeSource ? (
                              <span style={{
                                padding: '0.125rem 0.375rem',
                                borderRadius: '4px',
                                fontSize: '0.6875rem',
                                fontWeight: 700,
                                background: '#bee3f8',
                                color: '#2b6cb0',
                                letterSpacing: '0.025em',
                              }}>
                                SOURCE
                              </span>
                            ) : isMergeChecked ? (
                              <span style={{ fontSize: '0.75rem', color: '#276749', fontWeight: 600 }}>
                                ✓ selected
                              </span>
                            ) : incompatibilityReason ? (
                              <span style={{ fontSize: '0.6875rem', color: '#a0aec0', fontStyle: 'italic' }}>
                                {incompatibilityReason}
                              </span>
                            ) : null
                          ) : (
                            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => handleMoveEvent(idx, idx - 1)}
                                disabled={idx === 0}
                                style={{ padding: '0.125rem 0.375rem', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1 }}
                              >
                                ▲
                              </button>
                              <button
                                onClick={() => handleMoveEvent(idx, idx + 1)}
                                disabled={idx === schedule.heatOrder.length - 1}
                                style={{ padding: '0.125rem 0.375rem', cursor: idx === schedule.heatOrder.length - 1 ? 'default' : 'pointer', opacity: idx === schedule.heatOrder.length - 1 ? 0.3 : 1 }}
                              >
                                ▼
                              </button>
                              {isBreak && (
                                <button
                                  onClick={() => handleRemoveBreak(idx)}
                                  style={{ padding: '0.125rem 0.375rem', color: '#e53e3e', cursor: 'pointer' }}
                                  title="Remove break"
                                >
                                  ✕
                                </button>
                              )}
                              {!isBreak && (
                                <button
                                  onClick={() => { setMergeSource({ heatId: scheduledHeat.id, idx }); setMergeSelected(new Set()); }}
                                  style={{ padding: '0.125rem 0.375rem', fontSize: '0.75rem', cursor: 'pointer' }}
                                  title="Merge this heat with others"
                                >
                                  Merge
                                </button>
                              )}
                              {isMultiEntry && (
                                <button
                                  onClick={() => toggleExpanded(scheduledHeat.id)}
                                  style={{ padding: '0.125rem 0.375rem', fontSize: '0.75rem', cursor: 'pointer' }}
                                  title={isExpanded ? 'Collapse entries' : 'Expand to view/split entries'}
                                >
                                  {isExpanded ? 'Collapse' : 'Edit'}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                      {/* Expanded sub-rows for multi-entry heats */}
                      {isMultiEntry && isExpanded && !mergeSource && scheduledHeat.entries.map(entry => {
                        const event = getEventById(entry.eventId);
                        // Aggregate bibs across all heats — later rounds have empty bibs until scored
                        const allBibs = new Set<number>();
                        event?.heats.forEach(h => h.bibs.forEach(b => allBibs.add(b)));
                        const coupleCount = allBibs.size;
                        return (
                          <tr
                            key={`${scheduledHeat.id}-${entry.eventId}-${entry.round}`}
                            style={{ background: '#f7fafc' }}
                          >
                            <td></td>
                            <td></td>
                            <td style={{ paddingLeft: '1.75rem', fontSize: '0.875rem' }}>
                              {event?.name || `Event #${entry.eventId}`}
                              <span style={{ color: '#a0aec0', marginLeft: '0.5rem' }}>
                                ({coupleCount} couple{coupleCount !== 1 ? 's' : ''})
                              </span>
                            </td>
                            <td style={{ textTransform: 'capitalize', fontSize: '0.875rem' }}>{entry.round}</td>
                            <td style={{ fontSize: '0.875rem' }}>{event?.style || '\u2014'}</td>
                            <td style={{ fontSize: '0.875rem' }}>{event?.level || '\u2014'}</td>
                            <td></td>
                            <td></td>
                            <td>
                              <button
                                onClick={() => handleSplitEntry(scheduledHeat.id, entry.eventId, entry.round)}
                                style={{
                                  padding: '0.125rem 0.5rem',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  color: '#c53030',
                                  border: '1px solid #feb2b2',
                                  borderRadius: '4px',
                                  background: '#fff5f5',
                                }}
                                title="Split this entry into its own heat"
                              >
                                Split out
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        <div style={{ marginTop: '1.5rem' }}>
          <button className="btn btn-secondary" onClick={() => navigate(`/competitions/${competitionId}`)}>
            Back to Competition
          </button>
        </div>
      </div>
    </div>
  );
};

export default SchedulePage;
