import React, { useRef, useEffect, useState } from 'react';
import { Event, CompetitionSchedule, ScheduledHeat, Judge } from '../../../../types';
import JudgeAssignmentModal from './JudgeAssignmentModal';
import {
  getEventById,
  getHeatLabel,
  getHeatRound,
  getHeatStyle,
  getHeatLevel,
  getHeatCoupleCount,
  getMergeIncompatibilityReason,
  getMergeWarnings,
  formatTime,
  statusBadge,
} from '../utils';

interface ScheduleHeatTableProps {
  schedule: CompetitionSchedule;
  events: Event[];
  judges?: Judge[];
  eventsMap?: Record<number, Event>;
  competitionId?: number;
  mergeSource: { heatId: string; idx: number } | null;
  mergeSelected: Set<string>;
  expandedHeats: Record<string, boolean>;
  dragIndex: number | null;
  dragOverIndex: number | null;
  movedHeat: { id: string; key: number } | null;
  maxCouplesPerHeat: number;
  onDragStart: (idx: number) => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDragEnd: () => void;
  onToggleExpanded: (heatId: string) => void;
  onToggleMergeSelection: (heatId: string) => void;
  onMoveEvent: (fromIndex: number, toIndex: number) => void;
  onRemoveBreak: (heatIndex: number) => void;
  onSplitEntry: (heatId: string, eventId: number, round: string) => void;
  onStartMerge: (heatId: string, idx: number) => void;
  onEventsUpdated?: (events: Record<number, Event>) => void;
}

export default function ScheduleHeatTable({
  schedule,
  events,
  judges,
  eventsMap,
  competitionId,
  mergeSource,
  mergeSelected,
  expandedHeats,
  dragIndex,
  dragOverIndex,
  movedHeat,
  maxCouplesPerHeat,
  onDragStart,
  onDragOver,
  onDragEnd,
  onToggleExpanded,
  onToggleMergeSelection,
  onMoveEvent,
  onRemoveBreak,
  onSplitEntry,
  onStartMerge,
  onEventsUpdated,
}: ScheduleHeatTableProps) {
  const movedRowRef = useRef<HTMLTableRowElement | null>(null);
  const [judgeModalHeat, setJudgeModalHeat] = useState<ScheduledHeat | null>(null);

  // Build a map of judge id → judge for quick lookup
  const judgeMap = new Map<number, Judge>();
  if (judges) {
    for (const j of judges) judgeMap.set(j.id, j);
  }

  // Get judge numbers for a heat
  const getHeatJudgeNumbers = (heat: ScheduledHeat): number[] => {
    if (!eventsMap) return [];
    const judgeIds = new Set<number>();
    for (const entry of heat.entries) {
      const event = eventsMap[entry.eventId];
      if (!event) continue;
      const eventHeat = event.heats.find(h => h.round === entry.round);
      if (eventHeat) {
        for (const jId of eventHeat.judges) judgeIds.add(jId);
      }
    }
    return [...judgeIds]
      .map(id => judgeMap.get(id)?.judgeNumber ?? 0)
      .filter(n => n > 0)
      .sort((a, b) => a - b);
  };

  useEffect(() => {
    if (movedHeat && movedRowRef.current) {
      const el = movedRowRef.current;
      el.classList.remove('row-flash');
      void el.offsetWidth; // force reflow to re-trigger animation
      el.classList.add('row-flash');
      const cleanup = () => el.classList.remove('row-flash');
      el.addEventListener('animationend', cleanup, { once: true });
      return () => el.removeEventListener('animationend', cleanup);
    }
  }, [movedHeat]);

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
      <style>{`
        @keyframes row-flash-anim {
          0%, 15% { background-color: rgb(253 224 71); box-shadow: inset 0 0 0 1px rgb(234 179 8); }
          100% { background-color: transparent; box-shadow: none; }
        }
        .row-flash { animation: row-flash-anim 800ms ease-out; }
      `}</style>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="w-8 px-2 py-2.5"></th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-10">#</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Event</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Round</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Style</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Level</th>
            {judges && judges.length > 0 && (
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Judges</th>
            )}
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Time</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Status</th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
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
              ? getMergeIncompatibilityReason(sourceHeatObj, scheduledHeat, events, maxCouplesPerHeat, schedule.heatStatuses)
              : null;
            const mergeWarnings = isMergeTarget && sourceHeatObj && incompatibilityReason === null
              ? getMergeWarnings(sourceHeatObj, scheduledHeat, events, maxCouplesPerHeat)
              : [];
            const isMergeCompatible = isMergeTarget && incompatibilityReason === null;

            const rowBg = isBreak
              ? (isDragOver ? 'bg-gray-200' : 'bg-amber-50/60')
              : isMergeSource
                ? 'bg-blue-50'
                : isMergeChecked
                  ? 'bg-green-50'
                  : isDragOver
                    ? 'bg-gray-200'
                    : isCurrent
                      ? 'bg-blue-50'
                      : idx % 2 === 1
                        ? 'bg-gray-50/50'
                        : 'bg-white';

            const rowOpacity = isDragging
              ? 'opacity-40'
              : (mergeSource && !isMergeTarget && !isMergeSource)
                ? 'opacity-40'
                : '';

            return (
              <React.Fragment key={scheduledHeat.id + '-' + idx}>
                <tr
                  ref={scheduledHeat.id === movedHeat?.id ? movedRowRef : undefined}
                  draggable={!mergeSource}
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={(e) => onDragOver(e, idx)}
                  onDragEnd={onDragEnd}
                  onClick={mergeSource && isMergeCompatible ? () => onToggleMergeSelection(scheduledHeat.id) : undefined}
                  className={[
                    'group transition-colors duration-100',
                    rowBg,
                    rowOpacity,
                    isBreak ? 'italic border-y border-dashed border-amber-200' : 'hover:bg-blue-50/40',
                    isCurrent && !isBreak ? 'border-l-[3px] border-l-blue-500' : '',
                    mergeSource && isMergeTarget ? 'cursor-pointer' : '',
                  ].filter(Boolean).join(' ')}
                  style={{
                    borderLeft: isMergeSource ? '3px solid var(--color-blue-500, #4299e1)' : undefined,
                    borderTop: isDragOver && dragIndex !== null && idx < dragIndex ? '2px solid var(--color-primary-500, #667eea)' : undefined,
                    borderBottom: isDragOver && dragIndex !== null && idx > dragIndex ? '2px solid var(--color-primary-500, #667eea)' : undefined,
                  }}
                >
                  <td className={`${mergeSource ? 'cursor-default' : 'cursor-grab'} px-2 py-2 text-center text-gray-400 select-none align-top`}>
                    {mergeSource && !isBreak ? (
                      isMergeSource ? null : (
                        <input
                          type="checkbox"
                          checked={isMergeChecked}
                          disabled={!isMergeCompatible}
                          onChange={(e) => { e.stopPropagation(); onToggleMergeSelection(scheduledHeat.id); }}
                          className={isMergeCompatible ? 'cursor-pointer' : 'cursor-not-allowed'}
                          title={incompatibilityReason || undefined}
                        />
                      )
                    ) : (
                      '\u2630'
                    )}
                  </td>
                  <td className="px-3 py-2 align-top"><strong>{idx + 1}</strong></td>
                  {isBreak ? (
                    <td colSpan={judges && judges.length > 0 ? 6 : 5} className="px-3 py-2">
                      <span className="text-amber-800">
                        {scheduledHeat.breakLabel || 'Break'}
                        {scheduledHeat.breakDuration && (
                          <span className="text-amber-600 ml-2">
                            ({scheduledHeat.breakDuration} min)
                          </span>
                        )}
                        {scheduledHeat.estimatedStartTime && (
                          <span className="text-amber-700/70 ml-3 text-[0.8125rem]">
                            {formatTime(scheduledHeat.estimatedStartTime)}
                          </span>
                        )}
                      </span>
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-2 align-top">
                        {isMultiEntry ? (
                          <MultiEntryCell
                            scheduledHeat={scheduledHeat}
                            events={events}
                            isExpanded={isExpanded}
                            mergeSource={mergeSource}
                            onToggleExpanded={onToggleExpanded}
                          />
                        ) : (
                          <SingleEntryCell
                            scheduledHeat={scheduledHeat}
                            events={events}
                            mergeSource={mergeSource}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 capitalize align-top">{getHeatRound(scheduledHeat)}</td>
                      <td className="px-3 py-2 align-top">{getHeatStyle(scheduledHeat, events)}</td>
                      <td className="px-3 py-2 align-top">{getHeatLevel(scheduledHeat, events)}</td>
                      {judges && judges.length > 0 && (
                        <td className="px-3 py-2 align-top">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-600">
                              {getHeatJudgeNumbers(scheduledHeat).map(n => `J${n}`).join(', ') || '\u2014'}
                            </span>
                            {eventsMap && competitionId && !mergeSource && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setJudgeModalHeat(scheduledHeat); }}
                                className="ml-1 text-xs text-primary-500 hover:text-primary-700 cursor-pointer"
                                title="Edit judge assignments"
                              >
                                ✎
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                      <td className="px-3 py-2 align-top text-[0.8125rem] text-gray-600 whitespace-nowrap">
                        {scheduledHeat.estimatedStartTime ? formatTime(scheduledHeat.estimatedStartTime) : ''}
                      </td>
                    </>
                  )}
                  <td className="px-3 py-2 align-top">{statusBadge(status)}</td>
                  <td className="px-3 py-2 align-top">
                    <HeatActions
                      idx={idx}
                      scheduledHeat={scheduledHeat}
                      totalHeats={schedule.heatOrder.length}
                      isBreak={!!isBreak}
                      isMultiEntry={isMultiEntry}
                      isExpanded={isExpanded}
                      mergeSource={mergeSource}
                      isMergeSource={isMergeSource}
                      isMergeChecked={isMergeChecked}
                      incompatibilityReason={incompatibilityReason}
                      mergeWarnings={mergeWarnings}
                      onMoveEvent={onMoveEvent}
                      onRemoveBreak={onRemoveBreak}
                      onStartMerge={onStartMerge}
                      onToggleExpanded={onToggleExpanded}
                    />
                  </td>
                </tr>
                {/* Expanded sub-rows for multi-entry heats */}
                {isMultiEntry && isExpanded && !mergeSource && scheduledHeat.entries.map(entry => {
                  const event = getEventById(events, entry.eventId);
                  const allBibs = new Set<number>();
                  event?.heats.forEach(h => h.bibs.forEach(b => allBibs.add(b)));
                  const coupleCount = allBibs.size;
                  return (
                    <tr
                      key={`${scheduledHeat.id}-${entry.eventId}-${entry.round}`}
                      className="bg-gray-50/80 border-l-2 border-l-purple-300"
                    >
                      <td className="px-2 py-2"></td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 pl-7 text-sm">
                        {event?.name || `Event #${entry.eventId}`}
                        <span className="inline-flex items-center ml-2 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                          {coupleCount} couple{coupleCount !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="px-3 py-2 capitalize text-sm">{entry.round}</td>
                      <td className="px-3 py-2 text-sm">{event?.style || '\u2014'}</td>
                      <td className="px-3 py-2 text-sm">{event?.level || '\u2014'}</td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end">
                          <button
                            onClick={() => onSplitEntry(scheduledHeat.id, entry.eventId, entry.round)}
                            className="px-2 py-0.5 text-xs cursor-pointer text-red-700 border border-red-200 rounded bg-red-50 hover:bg-red-100"
                            title="Split this entry into its own heat"
                          >
                            Split out
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {judgeModalHeat && judges && eventsMap && competitionId && (
        <JudgeAssignmentModal
          heat={judgeModalHeat}
          judges={judges}
          events={eventsMap}
          competitionId={competitionId}
          onClose={() => setJudgeModalHeat(null)}
          onSaved={(updated) => {
            setJudgeModalHeat(null);
            if (onEventsUpdated) onEventsUpdated(updated);
          }}
        />
      )}
    </div>
  );
}

function MultiEntryCell({
  scheduledHeat,
  events,
  isExpanded,
  mergeSource,
  onToggleExpanded,
}: {
  scheduledHeat: ScheduledHeat;
  events: Event[];
  isExpanded: boolean;
  mergeSource: { heatId: string; idx: number } | null;
  onToggleExpanded: (heatId: string) => void;
}) {
  return (
    <div className="border-l-[3px] border-l-purple-600 pl-2.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          onClick={(e) => { e.stopPropagation(); onToggleExpanded(scheduledHeat.id); }}
          className="cursor-pointer text-[0.625rem] select-none w-3"
        >
          {isExpanded ? '\u25bc' : '\u25b6'}
        </span>
        <span className="py-0.5 px-1.5 rounded-full text-[0.6875rem] font-semibold bg-purple-200 text-purple-800">
          {scheduledHeat.entries.length} combined
        </span>
        <span className="py-0.5 px-1.5 rounded-full text-[0.6875rem] font-semibold bg-blue-100 text-blue-700">
          {getHeatCoupleCount(scheduledHeat, events)} couples
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {scheduledHeat.entries.map((entry) => {
          const event = getEventById(events, entry.eventId);
          return (
            <div key={`${entry.eventId}-${entry.round}`} className="flex items-baseline gap-2 text-sm leading-[1.3]">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-purple-600 inline-block relative -top-px" />
              <span>
                {event?.name || `Event #${entry.eventId}`}
                {mergeSource && event?.dances && event.dances.length > 0 && (
                  <span className="text-gray-400 ml-1.5 text-xs">
                    ({event.dances.join(', ')})
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SingleEntryCell({
  scheduledHeat,
  events,
  mergeSource,
}: {
  scheduledHeat: ScheduledHeat;
  events: Event[];
  mergeSource: { heatId: string; idx: number } | null;
}) {
  const entry = scheduledHeat.entries[0];
  const event = entry ? getEventById(events, entry.eventId) : undefined;
  const allBibs = new Set<number>();
  event?.heats.forEach(h => h.bibs.forEach(b => allBibs.add(b)));
  const coupleCount = allBibs.size;
  return (
    <div>
      <span>
        {getHeatLabel(scheduledHeat, events)}
        <span className="inline-flex items-center ml-2 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
          {coupleCount} couple{coupleCount !== 1 ? 's' : ''}
        </span>
      </span>
      {mergeSource && event?.dances && event.dances.length > 0 && (
        <div className="text-xs text-gray-500 mt-0.5">
          {event.dances.join(', ')}
        </div>
      )}
    </div>
  );
}

function HeatActions({
  idx,
  scheduledHeat,
  totalHeats,
  isBreak,
  isMultiEntry,
  isExpanded,
  mergeSource,
  isMergeSource,
  isMergeChecked,
  incompatibilityReason,
  mergeWarnings,
  onMoveEvent,
  onRemoveBreak,
  onStartMerge,
  onToggleExpanded,
}: {
  idx: number;
  scheduledHeat: ScheduledHeat;
  totalHeats: number;
  isBreak: boolean;
  isMultiEntry: boolean;
  isExpanded: boolean;
  mergeSource: { heatId: string; idx: number } | null;
  isMergeSource: boolean;
  isMergeChecked: boolean;
  incompatibilityReason: string | null;
  mergeWarnings: string[];
  onMoveEvent: (fromIndex: number, toIndex: number) => void;
  onRemoveBreak: (heatIndex: number) => void;
  onStartMerge: (heatId: string, idx: number) => void;
  onToggleExpanded: (heatId: string) => void;
}) {
  if (mergeSource) {
    if (isMergeSource) {
      return (
        <div className="flex justify-end">
          <span className="py-0.5 px-1.5 rounded text-[0.6875rem] font-bold bg-blue-200 text-blue-700 tracking-wide">
            SOURCE
          </span>
        </div>
      );
    }
    if (isMergeChecked) {
      return (
        <div className="flex justify-end">
          <span className="text-xs text-green-800 font-semibold">
            ✓ selected
          </span>
        </div>
      );
    }
    if (incompatibilityReason) {
      return (
        <div className="flex justify-end">
          <span className="text-[0.6875rem] text-gray-400 italic">
            {incompatibilityReason}
          </span>
        </div>
      );
    }
    if (mergeWarnings.length > 0) {
      return (
        <div className="flex justify-end">
          <span className="text-[0.6875rem] text-amber-600 italic">
            {mergeWarnings.join('; ')}
          </span>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 justify-end">
      <span className="inline-flex rounded border border-gray-200 divide-x divide-gray-200">
        <button
          onClick={() => onMoveEvent(idx, idx - 1)}
          disabled={idx === 0}
          className="px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 cursor-pointer disabled:cursor-default"
        >
          ▲
        </button>
        <button
          onClick={() => onMoveEvent(idx, idx + 1)}
          disabled={idx === totalHeats - 1}
          className="px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 cursor-pointer disabled:cursor-default"
        >
          ▼
        </button>
      </span>
      {isBreak && (
        <button
          onClick={() => onRemoveBreak(idx)}
          className="px-2 py-0.5 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
          title="Remove break"
        >
          ✕
        </button>
      )}
      {!isBreak && (
        <button
          onClick={() => onStartMerge(scheduledHeat.id, idx)}
          className="px-2 py-0.5 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-800 cursor-pointer"
          title="Merge this heat with others"
        >
          Merge
        </button>
      )}
      {isMultiEntry && (
        <button
          onClick={() => onToggleExpanded(scheduledHeat.id)}
          className="px-2 py-0.5 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-800 cursor-pointer"
          title={isExpanded ? 'Collapse entries' : 'Expand to view/split entries'}
        >
          {isExpanded ? 'Collapse' : 'Edit'}
        </button>
      )}
    </div>
  );
}
