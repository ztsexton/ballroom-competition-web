import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsApi, schedulesApi, competitionsApi } from '../api/client';
import { Event, CompetitionSchedule, Competition, JudgeSettings } from '../types';
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

  // Drag-and-drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // New event insertion state
  const [unscheduledEvents, setUnscheduledEvents] = useState<Event[]>([]);
  const [suggestedPositions, setSuggestedPositions] = useState<Record<number, number>>({});
  const [customPositions, setCustomPositions] = useState<Record<number, number>>({});

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
      const eventList = Object.values(eventsRes.data);
      setEvents(eventList);

      try {
        const schedRes = await schedulesApi.get(competitionId);
        setSchedule(schedRes.data);
        setStyleOrder(schedRes.data.styleOrder);
        setLevelOrder(schedRes.data.levelOrder);

        // Detect events not in the schedule
        const scheduledIds = new Set(schedRes.data.heatOrder.map((h: { eventId: number }) => h.eventId));
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
      const res = await schedulesApi.generate(competitionId, styleOrder, levelOrder, judgeSettings);
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

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      pending: { bg: '#e2e8f0', color: '#4a5568' },
      announced: { bg: '#bee3f8', color: '#2b6cb0' },
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
                    const afterEvent = afterHeat ? getEventById(afterHeat.eventId) : undefined;
                    return `Position ${pos + 1} (after ${afterEvent?.name || `#${pos}`} ${afterHeat?.round || ''})`;
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

            <table style={{ marginTop: '1rem' }}>
              <thead>
                <tr>
                  <th style={{ width: '2rem' }}></th>
                  <th>#</th>
                  <th>Event Name</th>
                  <th>Round</th>
                  <th>Style</th>
                  <th>Level</th>
                  <th>Status</th>
                  <th>Reorder</th>
                </tr>
              </thead>
              <tbody>
                {schedule.heatOrder.map((scheduledHeat, idx) => {
                  const isBreak = scheduledHeat.isBreak;
                  const event = isBreak ? null : getEventById(scheduledHeat.eventId);
                  if (!isBreak && !event) return null;
                  const heatKey = `${scheduledHeat.eventId}:${scheduledHeat.round}`;
                  const isCurrent = idx === schedule.currentHeatIndex;
                  const isDragging = dragIndex === idx;
                  const isDragOver = dragOverIndex === idx;
                  return (
                    <tr
                      key={heatKey + '-' + idx}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      style={{
                        background: isBreak
                          ? (isDragOver ? '#e2e8f0' : '#fefce8')
                          : (isDragOver ? '#e2e8f0' : isCurrent ? '#ebf8ff' : undefined),
                        opacity: isDragging ? 0.4 : 1,
                        borderTop: isDragOver && dragIndex !== null && idx < dragIndex ? '2px solid #667eea' : undefined,
                        borderBottom: isDragOver && dragIndex !== null && idx > dragIndex ? '2px solid #667eea' : undefined,
                        transition: 'background 0.15s, opacity 0.15s',
                        fontStyle: isBreak ? 'italic' : undefined,
                      }}
                    >
                      <td style={{ cursor: 'grab', textAlign: 'center', color: '#a0aec0', userSelect: 'none' }}>
                        ☰
                      </td>
                      <td><strong>{idx + 1}</strong></td>
                      {isBreak ? (
                        <td colSpan={4}>
                          <span>
                            {scheduledHeat.breakLabel || 'Break'}
                            {scheduledHeat.breakDuration && (
                              <span style={{ color: '#a0aec0', marginLeft: '0.5rem' }}>
                                ({scheduledHeat.breakDuration} min)
                              </span>
                            )}
                          </span>
                        </td>
                      ) : (
                        <>
                          <td>{event!.name}</td>
                          <td style={{ textTransform: 'capitalize' }}>{scheduledHeat.round}</td>
                          <td>{event!.style || '\u2014'}</td>
                          <td>{event!.level || '\u2014'}</td>
                        </>
                      )}
                      <td>{statusBadge(schedule.heatStatuses[heatKey] || 'pending')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
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
                        </div>
                      </td>
                    </tr>
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
