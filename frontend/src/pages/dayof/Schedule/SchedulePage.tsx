import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsApi, schedulesApi, competitionsApi, judgesApi, couplesApi } from '../../../api/client';
import { Event, CompetitionSchedule, Competition, JudgeSettings, TimingSettings, HeatEntry, ScheduleDayConfig, AutoBreaksConfig, LevelCombiningConfig, Judge, Couple, ScheduleVariant } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { DEFAULT_LEVELS } from '../../../constants/levels';
import { DEFAULT_STYLE_ORDER, DEFAULT_DANCE_ORDER } from '../../../constants/dances';
import { formatTime } from './utils';
import { Skeleton } from '../../../components/Skeleton';
import ScheduleConfigForm from './components/ScheduleConfigForm';
import UnscheduledEventsBanner from './components/UnscheduledEventsBanner';
import BreakForm from './components/BreakForm';
import MergePanel from './components/MergePanel';
import ScheduleHeatTable from './components/ScheduleHeatTable';
import ScheduleOptimizer from './components/ScheduleOptimizer';
import JudgeScheduleView from './components/JudgeScheduleView';
import ConsolidationPreview from './components/ConsolidationPreview';
import ScheduleVariantPicker from './components/ScheduleVariantPicker';

const SchedulePage = () => {
  const { id } = useParams<{ id: string }>();
  const { isAnyAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const competitionId = parseInt(id || '0');

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [schedule, setSchedule] = useState<CompetitionSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [styleOrder, setStyleOrder] = useState<string[]>(DEFAULT_STYLE_ORDER);
  const [levelOrder, setLevelOrder] = useState<string[]>(DEFAULT_LEVELS);
  const [danceOrder, setDanceOrder] = useState<Record<string, string[]>>(DEFAULT_DANCE_ORDER);
  const [autoBreaks, setAutoBreaks] = useState<AutoBreaksConfig>({ enabled: false });
  const [deferFinals, setDeferFinals] = useState(false);
  const [eventTypeOrder, setEventTypeOrder] = useState<string[]>(['single', 'multi', 'scholarship']);
  const [levelCombining, setLevelCombining] = useState<LevelCombiningConfig>({ mode: 'any' });
  const [judgeSettings, setJudgeSettings] = useState<JudgeSettings>({ defaultCount: 3, levelOverrides: {} });
  const [timingSettings, setTimingSettings] = useState<TimingSettings>({
    defaultDanceDurationSeconds: 75,
    betweenDanceSeconds: 35,
    betweenHeatSeconds: 45,
  });
  const [dayConfigs, setDayConfigs] = useState<ScheduleDayConfig[]>([
    { day: 1, startTime: '08:00', endTime: '17:00' },
  ]);

  const [confirmAction, setConfirmAction] = useState<{title: string; message: string; action: () => void} | null>(null);

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

  // Move animation state
  const [movedHeat, setMovedHeat] = useState<{ id: string; key: number } | null>(null);
  const moveCounterRef = useRef(0);
  const movedTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Judges
  const [judges, setJudges] = useState<Judge[]>([]);
  const [eventsMap, setEventsMap] = useState<Record<number, Event>>({});
  const [scheduleView, setScheduleView] = useState<'heats' | 'judges'>('heats');

  // Break insertion state
  const [showBreakForm, setShowBreakForm] = useState(false);
  const [breakLabel, setBreakLabel] = useState('');
  const [breakDuration, setBreakDuration] = useState<number | ''>('');
  const [breakPosition, setBreakPosition] = useState<number>(0);

  // Couples for heat entry display
  const [couples, setCouples] = useState<Couple[]>([]);

  // Variant selection for main/fill-in mode
  const [variants, setVariants] = useState<ScheduleVariant[] | null>(null);
  const [applyingVariant, setApplyingVariant] = useState(false);

  // Back-to-back highlighting
  const [showBackToBack, setShowBackToBack] = useState(false);
  const [excludePros, setExcludePros] = useState(false);
  const [backToBackHeatIds, setBackToBackHeatIds] = useState<Set<string>>(new Set());
  const [backToBackCount, setBackToBackCount] = useState(0);
  const [backToBackConflicts, setBackToBackConflicts] = useState<Array<{
    personId?: number; personName?: string;
    bib?: number; leaderName?: string; followerName?: string;
    heatIndex1: number; heatIndex2: number;
    heatId1: string; heatId2: string;
    eventName1: string; eventName2: string;
  }>>([]);

  const loadData = useCallback(async () => {
    if (!competitionId) return;

    try {
      const [compRes, eventsRes, judgesRes, couplesRes] = await Promise.all([
        competitionsApi.getById(competitionId),
        eventsApi.getAll(competitionId),
        judgesApi.getAll(competitionId),
        couplesApi.getAll(competitionId),
      ]);
      setCompetition(compRes.data);
      setJudges(judgesRes.data);
      setEventsMap(eventsRes.data);
      setCouples(couplesRes.data);
      if (compRes.data.levels && compRes.data.levels.length > 0) {
        setLevelOrder(compRes.data.levels);
      }
      if (compRes.data.judgeSettings) {
        setJudgeSettings(compRes.data.judgeSettings);
      }
      if (compRes.data.timingSettings) {
        setTimingSettings(prev => ({ ...prev, ...compRes.data.timingSettings }));
      }
      if (compRes.data.scheduleDayConfigs && compRes.data.scheduleDayConfigs.length > 0) {
        setDayConfigs(compRes.data.scheduleDayConfigs);
      }
      if (compRes.data.danceOrder) {
        setDanceOrder(compRes.data.danceOrder);
        // Sync styleOrder with any custom styles from danceOrder
        const customStyles = Object.keys(compRes.data.danceOrder).filter(
          s => !DEFAULT_STYLE_ORDER.includes(s)
        );
        if (customStyles.length > 0) {
          setStyleOrder(prev => {
            const missing = customStyles.filter(s => !prev.includes(s));
            return missing.length > 0 ? [...prev, ...missing] : prev;
          });
        }
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

  // Fetch back-to-back conflicts when highlighting is enabled
  useEffect(() => {
    if (!showBackToBack || !competitionId || !schedule) {
      setBackToBackHeatIds(new Set());
      setBackToBackCount(0);
      setBackToBackConflicts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await schedulesApi.getBackToBack(competitionId, { level: 'person', excludePros });
        if (!cancelled) {
          setBackToBackHeatIds(new Set(res.data.conflictHeatIds));
          setBackToBackCount(res.data.count);
          setBackToBackConflicts(res.data.conflicts);
        }
      } catch {
        if (!cancelled) {
          setBackToBackHeatIds(new Set());
          setBackToBackCount(0);
          setBackToBackConflicts([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [showBackToBack, excludePros, competitionId, schedule]);

  const handleGenerate = async (overrides?: { timingSettings?: TimingSettings; levelCombining?: LevelCombiningConfig }) => {
    if (!competitionId) return;
    setGenerating(true);
    setVariants(null);
    try {
      // Save day configs and dance order to competition
      const compUpdate = {
        numberOfDays: dayConfigs.length,
        scheduleDayConfigs: dayConfigs,
        danceOrder,
      };
      await competitionsApi.update(competitionId, compUpdate);
      // Update local competition state so overflow detection works immediately
      setCompetition(prev => prev ? { ...prev, ...compUpdate } : prev);
      const baseTiming = overrides?.timingSettings ?? timingSettings;
      // Always derive start time from day configs (the source of truth for timing window)
      const effectiveTiming = { ...baseTiming };
      if (dayConfigs[0]?.startTime && competition?.date) {
        const [h, m] = dayConfigs[0].startTime.split(':').map(Number);
        const d = new Date(competition.date + 'T00:00:00');
        d.setHours(h, m, 0, 0);
        effectiveTiming.startTime = d.toISOString();
      }
      const effectiveLevelCombining = overrides?.levelCombining ?? levelCombining;
      const res = await schedulesApi.generate(competitionId, styleOrder, levelOrder, judgeSettings, effectiveTiming, danceOrder, autoBreaks, deferFinals, eventTypeOrder, effectiveLevelCombining);
      setSchedule(res.data);
      setUnscheduledEvents([]);
      setError('');

      // If main/fill-in mode, auto-generate variants
      if (judgeSettings.breakConfig?.mode === 'main-fillin') {
        try {
          const varRes = await schedulesApi.generateVariants(competitionId, judgeSettings, effectiveTiming);
          if (varRes.data.variants.length > 0) {
            setVariants(varRes.data.variants);
          }
        } catch {
          // Non-fatal - user can still use the base schedule
          console.warn('Failed to generate schedule variants');
        }
      }
    } catch {
      setError('Failed to generate schedule');
    } finally {
      setGenerating(false);
    }
  };

  const handleApplyVariant = async (variantId: string) => {
    if (!competitionId) return;
    setApplyingVariant(true);
    try {
      const res = await schedulesApi.applyVariant(competitionId, variantId);
      setSchedule(res.data);
      setVariants(null);
      setError('');
    } catch {
      setError('Failed to apply schedule variant');
    } finally {
      setApplyingVariant(false);
    }
  };

  const handleRegenerate = () => {
    setConfirmAction({
      title: 'Regenerate Schedule',
      message: 'This will regenerate the schedule from scratch, clearing any custom ordering and run progress. Continue?',
      action: () => handleGenerate(),
    });
  };

  const handleMoveEvent = async (fromIndex: number, toIndex: number) => {
    if (!competitionId || !schedule) return;
    if (toIndex < 0 || toIndex >= schedule.heatOrder.length) return;

    // Optimistic update: swap locally for instant feedback
    const prevSchedule = schedule;
    const newHeatOrder = [...schedule.heatOrder];
    [newHeatOrder[fromIndex], newHeatOrder[toIndex]] = [newHeatOrder[toIndex], newHeatOrder[fromIndex]];
    const optimistic = { ...schedule, heatOrder: newHeatOrder };
    setSchedule(optimistic);

    const movedHeatId = newHeatOrder[toIndex].id;
    moveCounterRef.current++;
    clearTimeout(movedTimerRef.current);
    setMovedHeat({ id: movedHeatId, key: moveCounterRef.current });
    movedTimerRef.current = setTimeout(() => setMovedHeat(null), 900);

    try {
      const res = await schedulesApi.reorder(competitionId, fromIndex, toIndex);
      setSchedule(res.data);
    } catch {
      setSchedule(prevSchedule);
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

  const handleDelete = () => {
    if (!competitionId) return;
    setConfirmAction({
      title: 'Delete Schedule',
      message: 'Delete the schedule? This will reset all run progress.',
      action: async () => {
        try {
          await schedulesApi.delete(competitionId);
          setSchedule(null);
          setUnscheduledEvents([]);
          setError('');
        } catch {
          setError('Failed to delete schedule');
        }
      },
    });
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

    // Compute total couples to determine if override is needed
    let totalCouples = 0;
    for (const entry of allEntries) {
      const event = events.find(e => e.id === entry.eventId);
      if (event) {
        const allBibs = new Set<number>();
        event.heats.forEach(h => h.bibs.forEach(b => allBibs.add(b)));
        totalCouples += allBibs.size;
      }
    }
    const needsOverride = totalCouples > maxCouplesPerHeat;

    try {
      const res = await schedulesApi.updateHeatEntries(competitionId, mergeSource.heatId, allEntries, needsOverride || undefined);
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

  if (loading || authLoading) return <div className="max-w-7xl mx-auto p-8"><Skeleton variant="card" /></div>;

  if (!isAnyAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2>Access Denied</h2>
          <p>You must be an admin to manage schedules.</p>
        </div>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2>Competition not found</h2>
          <button
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200 mt-4"
            onClick={() => navigate('/competitions')}
          >
            Back to Competitions
          </button>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2>Competition Schedule - {competition.name}</h2>
          <div className="text-center p-8 text-gray-500">
            <h3>No events created yet</h3>
            <p>Create events first before generating a schedule.</p>
          </div>
          <button
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200"
            onClick={() => navigate(`/competitions/${competitionId}`)}
          >
            Back to Competition
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h2>Competition Schedule - {competition.name}</h2>
        <p className="text-gray-500 mt-2">
          Configure the event order for your competition, then run it from the announcer interface.
        </p>

        {error && <div className="px-4 py-3 bg-red-100 text-red-700 rounded text-sm">{error}</div>}

        {generating && schedule && (
          <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
            <svg className="animate-spin h-5 w-5 text-blue-600 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Regenerating schedule... This may take a moment.</span>
          </div>
        )}

        {!schedule ? (
          <ScheduleConfigForm
            styleOrder={styleOrder}
            levelOrder={levelOrder}
            danceOrder={danceOrder}
            judgeSettings={judgeSettings}
            timingSettings={timingSettings}
            eventCount={events.length}
            dayConfigs={dayConfigs}
            hardStopTime={competition?.hardStopTime}
            generating={generating}
            autoBreaks={autoBreaks}
            deferFinals={deferFinals}
            eventTypeOrder={eventTypeOrder}
            levelCombining={levelCombining}
            onStyleOrderChange={setStyleOrder}
            onLevelOrderChange={setLevelOrder}
            onDanceOrderChange={setDanceOrder}
            onJudgeSettingsChange={setJudgeSettings}
            onTimingSettingsChange={setTimingSettings}
            onAutoBreaksChange={setAutoBreaks}
            onDeferFinalsChange={setDeferFinals}
            onEventTypeOrderChange={setEventTypeOrder}
            onLevelCombiningChange={setLevelCombining}
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

            <div className="flex gap-2 mt-4 flex-wrap">
              <button
                className="px-4 py-2 bg-success-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-success-600"
                onClick={() => navigate(`/competitions/${competitionId}/run`)}
              >
                Run Competition
              </button>
              <button
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 text-sm font-medium transition-colors hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                onClick={handleRegenerate}
                disabled={generating}
              >
                {generating && (
                  <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {generating ? 'Regenerating...' : 'Regenerate Schedule'}
              </button>
              <button
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                  if (schedule) setBreakPosition(schedule.heatOrder.length);
                  setShowBreakForm(!showBreakForm);
                }}
                disabled={generating}
              >
                {showBreakForm ? 'Cancel Break' : 'Add Break'}
              </button>
              <button
                className="px-4 py-2 bg-danger-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-danger-600 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleDelete}
                disabled={generating}
              >
                Delete Schedule
              </button>
            </div>

            {variants && variants.length > 0 && (
              <ScheduleVariantPicker
                variants={variants}
                applying={applyingVariant}
                onSelect={handleApplyVariant}
                onCancel={() => setVariants(null)}
              />
            )}

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

            {competition?.scheduleDayConfigs && competition.scheduleDayConfigs.length > 0 && (
              <ScheduleOptimizer
                competitionId={competitionId}
                onScheduleUpdated={setSchedule}
              />
            )}

            {schedule.heatOrder.length > 0 && schedule.heatOrder[0].estimatedStartTime && (() => {
              const lastHeat = schedule.heatOrder[schedule.heatOrder.length - 1];
              const finishTime = lastHeat?.estimatedStartTime && lastHeat?.estimatedDurationSeconds
                ? new Date(new Date(lastHeat.estimatedStartTime).getTime() + lastHeat.estimatedDurationSeconds * 1000)
                : null;
              const startMs = new Date(schedule.heatOrder[0].estimatedStartTime!).getTime();
              const estimatedMinutes = finishTime ? Math.round((finishTime.getTime() - startMs) / 60000) : null;

              // Calculate available minutes from day configs
              let availableMinutes: number | null = null;
              if (competition?.scheduleDayConfigs && competition.scheduleDayConfigs.length > 0) {
                availableMinutes = 0;
                for (const dc of competition.scheduleDayConfigs) {
                  const [sh, sm] = dc.startTime.split(':').map(Number);
                  const [eh, em] = dc.endTime.split(':').map(Number);
                  availableMinutes += (eh * 60 + em) - (sh * 60 + sm);
                }
              }

              const overflows = availableMinutes !== null && estimatedMinutes !== null && estimatedMinutes > availableMinutes;
              const overflowMinutes = overflows ? estimatedMinutes! - availableMinutes! : 0;

              // Hard stop check
              let exceedsHardStop = false;
              let hardStopOverflow = 0;
              if (competition?.hardStopTime && finishTime) {
                const [hh, mmm] = competition.hardStopTime.split(':').map(Number);
                const hardStopDate = new Date(new Date(schedule.heatOrder[0].estimatedStartTime!));
                hardStopDate.setHours(hh, mmm, 0, 0);
                if (finishTime.getTime() > hardStopDate.getTime()) {
                  exceedsHardStop = true;
                  hardStopOverflow = Math.ceil((finishTime.getTime() - hardStopDate.getTime()) / 60000);
                }
              }

              const borderColor = exceedsHardStop ? 'border-red-400' : overflows ? 'border-amber-400' : 'border-green-200';
              const bgColor = exceedsHardStop ? 'bg-red-50' : overflows ? 'bg-amber-50' : 'bg-green-50';
              const textColor = exceedsHardStop ? 'text-red-900' : overflows ? 'text-amber-900' : 'text-green-800';

              return (
                <div className={`mt-4 px-3 py-2 ${bgColor} border ${borderColor} rounded-md text-sm ${textColor}`}>
                  Estimated start: <strong>{formatTime(schedule.heatOrder[0].estimatedStartTime!)}</strong>
                  {finishTime && (
                    <span className="ml-4">
                      Estimated finish: <strong>{formatTime(finishTime.toISOString())}</strong>
                    </span>
                  )}
                  <span className="ml-4">
                    ({schedule.heatOrder.length} heats)
                  </span>
                  {estimatedMinutes !== null && (
                    <span className="ml-4">
                      Duration: <strong>{Math.floor(estimatedMinutes / 60)}h {estimatedMinutes % 60}m</strong>
                    </span>
                  )}
                  {availableMinutes !== null && (
                    <span className="ml-4">
                      Available: <strong>{Math.floor(availableMinutes / 60)}h {availableMinutes % 60}m</strong>
                    </span>
                  )}
                  {overflows && (
                    <div className="mt-1 font-semibold text-amber-800">
                      Schedule exceeds available time by {overflowMinutes} minutes
                    </div>
                  )}
                  {exceedsHardStop && (
                    <div className="mt-1 font-semibold text-red-800">
                      Exceeds hard stop ({competition?.hardStopTime}) by {hardStopOverflow} minutes
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Consolidation preview — always available, flagged when overflowing */}
            {(() => {
              let availableMinutes: number | null = null;
              let windowStartStr: string | undefined;
              let windowEndStr: string | undefined;
              if (competition?.scheduleDayConfigs && competition.scheduleDayConfigs.length > 0) {
                availableMinutes = 0;
                windowStartStr = competition.scheduleDayConfigs[0].startTime;
                windowEndStr = competition.scheduleDayConfigs[competition.scheduleDayConfigs.length - 1].endTime;
                for (const dc of competition.scheduleDayConfigs) {
                  const [sh, sm] = dc.startTime.split(':').map(Number);
                  const [eh, em] = dc.endTime.split(':').map(Number);
                  availableMinutes += (eh * 60 + em) - (sh * 60 + sm);
                }
              }
              let estimatedMinutes: number | null = null;
              let estStart: string | undefined;
              let estEnd: string | undefined;
              if (schedule.heatOrder.length > 0 && schedule.heatOrder[0].estimatedStartTime) {
                estStart = schedule.heatOrder[0].estimatedStartTime;
                const lastHeat = schedule.heatOrder[schedule.heatOrder.length - 1];
                const finishTime = lastHeat?.estimatedStartTime && lastHeat?.estimatedDurationSeconds
                  ? new Date(new Date(lastHeat.estimatedStartTime).getTime() + lastHeat.estimatedDurationSeconds * 1000)
                  : null;
                if (finishTime) estEnd = finishTime.toISOString();
                const startMs = new Date(estStart).getTime();
                estimatedMinutes = finishTime ? Math.round((finishTime.getTime() - startMs) / 60000) : null;
              }
              const overflows = availableMinutes !== null && estimatedMinutes !== null && estimatedMinutes > availableMinutes;
              const overflowMinutes = overflows ? estimatedMinutes! - availableMinutes! : 0;

              return (
                <ConsolidationPreview
                  competitionId={competitionId}
                  overflowMinutes={overflowMinutes}
                  isOverflowing={overflows}
                  estimatedStartTime={estStart}
                  estimatedEndTime={estEnd}
                  windowStart={windowStartStr}
                  windowEnd={windowEndStr}
                  onApplyStrategy={async (changes) => {
                    // Apply structural changes to competition
                    const compUpdate: Record<string, unknown> = {};
                    if (changes.maxCouplesPerHeat) {
                      compUpdate.maxCouplesPerHeat = changes.maxCouplesPerHeat;
                    }
                    if (Object.keys(compUpdate).length > 0) {
                      await competitionsApi.update(competitionId, compUpdate);
                      setCompetition(prev => prev ? { ...prev, ...compUpdate } as typeof prev : prev);
                    }

                    // Build effective level combining
                    const effectiveLevelCombining = changes.levelCombining ?? levelCombining;
                    if (changes.levelCombining) {
                      setLevelCombining(changes.levelCombining);
                    }

                    // Build effective timing with changes applied
                    const effectiveTiming = { ...timingSettings };
                    if (changes.defaultDanceDurationSeconds !== undefined) {
                      effectiveTiming.defaultDanceDurationSeconds = changes.defaultDanceDurationSeconds;
                    }
                    if (changes.scholarshipDurationSeconds !== undefined) {
                      effectiveTiming.scholarshipDurationSeconds = changes.scholarshipDurationSeconds;
                    }
                    if (changes.betweenHeatSeconds !== undefined) {
                      effectiveTiming.betweenHeatSeconds = changes.betweenHeatSeconds;
                    }
                    if (changes.betweenDanceSeconds !== undefined) {
                      effectiveTiming.betweenDanceSeconds = changes.betweenDanceSeconds;
                    }
                    // Update state for future renders
                    setTimingSettings(effectiveTiming);

                    // Regenerate with overrides to avoid stale state
                    handleGenerate({ timingSettings: effectiveTiming, levelCombining: effectiveLevelCombining });
                  }}
                />
              );
            })()}

            {/* Back-to-back highlighting controls */}
            <div className="mt-4 flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showBackToBack}
                  onChange={(e) => setShowBackToBack(e.target.checked)}
                  className="rounded"
                />
                <span>Highlight back-to-back</span>
              </label>
              {showBackToBack && (
                <>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={excludePros}
                      onChange={(e) => setExcludePros(e.target.checked)}
                      className="rounded"
                    />
                    <span>Exclude pros</span>
                  </label>
                  {backToBackCount > 0 && (
                    <span className="text-orange-700 font-medium">
                      {backToBackCount} conflict{backToBackCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {backToBackCount === 0 && backToBackHeatIds.size === 0 && (
                    <span className="text-green-700 font-medium">No conflicts</span>
                  )}
                </>
              )}
            </div>

            {/* View toggle */}
            <div className="mt-4 flex gap-1 border-b border-gray-200">
              <button
                onClick={() => setScheduleView('heats')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  scheduleView === 'heats'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Heat Order
              </button>
              <button
                onClick={() => setScheduleView('judges')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  scheduleView === 'judges'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Judge Schedule
              </button>
            </div>

            {scheduleView === 'heats' ? (
              <ScheduleHeatTable
                schedule={schedule}
                events={events}
                couples={couples}
                judges={judges}
                eventsMap={eventsMap}
                competitionId={competitionId}
                mergeSource={mergeSource}
                mergeSelected={mergeSelected}
                expandedHeats={expandedHeats}
                dragIndex={dragIndex}
                dragOverIndex={dragOverIndex}
                movedHeat={movedHeat}
                maxCouplesPerHeat={maxCouplesPerHeat}
                backToBackHeatIds={showBackToBack ? backToBackHeatIds : undefined}
                backToBackConflicts={showBackToBack ? backToBackConflicts : undefined}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onToggleExpanded={toggleExpanded}
                onToggleMergeSelection={toggleMergeSelection}
                onMoveEvent={handleMoveEvent}
                onRemoveBreak={handleRemoveBreak}
                onSplitEntry={handleSplitEntry}
                onStartMerge={(heatId, idx) => { setMergeSource({ heatId, idx }); setMergeSelected(new Set()); }}
                onEventsUpdated={(updated) => {
                  setEventsMap(updated);
                  setEvents(Object.values(updated));
                }}
              />
            ) : (
              <JudgeScheduleView competitionId={competitionId} />
            )}
          </>
        )}

        <div className="mt-6">
          <button
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200"
            onClick={() => navigate(`/competitions/${competitionId}`)}
          >
            Back to Competition
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        confirmLabel="Continue"
        variant="warning"
        onConfirm={() => { confirmAction?.action(); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};

export default SchedulePage;
