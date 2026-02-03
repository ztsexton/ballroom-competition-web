import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsApi, schedulesApi, competitionsApi } from '../../api/client';
import { Event, CompetitionSchedule, Competition, JudgeSettings, TimingSettings, HeatEntry } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { DEFAULT_LEVELS } from '../../constants/levels';
import { formatTime } from './utils';
import ScheduleConfigForm from './components/ScheduleConfigForm';
import UnscheduledEventsBanner from './components/UnscheduledEventsBanner';
import BreakForm from './components/BreakForm';
import MergePanel from './components/MergePanel';
import ScheduleHeatTable from './components/ScheduleHeatTable';

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
  // Merge mode
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

  const toggleExpanded = (heatId: string) => {
    setExpandedHeats(prev => ({ ...prev, [heatId]: !prev[heatId] }));
  };

  const maxCouplesPerHeat = competition?.maxCouplesPerHeat ?? 6;

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
          <ScheduleConfigForm
            styleOrder={styleOrder}
            levelOrder={levelOrder}
            judgeSettings={judgeSettings}
            timingSettings={timingSettings}
            eventCount={events.length}
            onStyleOrderChange={setStyleOrder}
            onLevelOrderChange={setLevelOrder}
            onJudgeSettingsChange={setJudgeSettings}
            onTimingSettingsChange={setTimingSettings}
            onGenerate={handleGenerate}
          />
        ) : (
          <>
            <UnscheduledEventsBanner
              unscheduledEvents={unscheduledEvents}
              suggestedPositions={suggestedPositions}
              customPositions={customPositions}
              schedule={schedule}
              events={events}
              onCustomPositionChange={(eventId, position) =>
                setCustomPositions(prev => ({ ...prev, [eventId]: position }))
              }
              onInsertEvent={handleInsertEvent}
            />

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

            {showBreakForm && (
              <BreakForm
                breakLabel={breakLabel}
                breakDuration={breakDuration}
                breakPosition={breakPosition}
                heatCount={schedule.heatOrder.length}
                onLabelChange={setBreakLabel}
                onDurationChange={setBreakDuration}
                onPositionChange={setBreakPosition}
                onSubmit={handleAddBreak}
              />
            )}

            {mergeSource && (
              <MergePanel
                schedule={schedule}
                mergeSource={mergeSource}
                mergeSelected={mergeSelected}
                maxCouplesPerHeat={maxCouplesPerHeat}
                events={events}
                onCancel={() => { setMergeSource(null); setMergeSelected(new Set()); }}
                onMerge={handleMergeSelected}
              />
            )}

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

            <ScheduleHeatTable
              schedule={schedule}
              events={events}
              mergeSource={mergeSource}
              mergeSelected={mergeSelected}
              expandedHeats={expandedHeats}
              dragIndex={dragIndex}
              dragOverIndex={dragOverIndex}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onToggleExpanded={toggleExpanded}
              onToggleMergeSelection={toggleMergeSelection}
              onMoveEvent={handleMoveEvent}
              onRemoveBreak={handleRemoveBreak}
              onSplitEntry={handleSplitEntry}
              onStartMerge={(heatId, idx) => { setMergeSource({ heatId, idx }); setMergeSelected(new Set()); }}
            />
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
