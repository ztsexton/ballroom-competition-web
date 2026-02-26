import React from 'react';
import { Event, CompetitionSchedule, ScheduledHeat } from '../../../../types';
import {
  getEventById,
  getHeatLabel,
  getHeatRound,
  getHeatStyle,
  getHeatLevel,
  getMergeIncompatibilityReason,
  formatTime,
  statusBadge,
} from '../utils';

interface ScheduleHeatTableProps {
  schedule: CompetitionSchedule;
  events: Event[];
  mergeSource: { heatId: string; idx: number } | null;
  mergeSelected: Set<string>;
  expandedHeats: Record<string, boolean>;
  dragIndex: number | null;
  dragOverIndex: number | null;
  onDragStart: (idx: number) => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDragEnd: () => void;
  onToggleExpanded: (heatId: string) => void;
  onToggleMergeSelection: (heatId: string) => void;
  onMoveEvent: (fromIndex: number, toIndex: number) => void;
  onRemoveBreak: (heatIndex: number) => void;
  onSplitEntry: (heatId: string, eventId: number, round: string) => void;
  onStartMerge: (heatId: string, idx: number) => void;
}

export default function ScheduleHeatTable({
  schedule,
  events,
  mergeSource,
  mergeSelected,
  expandedHeats,
  dragIndex,
  dragOverIndex,
  onDragStart,
  onDragOver,
  onDragEnd,
  onToggleExpanded,
  onToggleMergeSelection,
  onMoveEvent,
  onRemoveBreak,
  onSplitEntry,
  onStartMerge,
}: ScheduleHeatTableProps) {
  return (
    <table className="mt-4">
      <thead>
        <tr>
          <th className="w-8"></th>
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
            ? getMergeIncompatibilityReason(sourceHeatObj, scheduledHeat, events)
            : null;
          const isMergeCompatible = isMergeTarget && incompatibilityReason === null;

          const rowBg = isBreak
            ? (isDragOver ? 'bg-gray-200' : 'bg-yellow-50')
            : isMergeSource
              ? 'bg-blue-50'
              : isMergeChecked
                ? 'bg-green-50'
                : isDragOver
                  ? 'bg-gray-200'
                  : isCurrent
                    ? 'bg-blue-50'
                    : '';

          const rowOpacity = isDragging
            ? 'opacity-40'
            : (mergeSource && !isMergeTarget && !isMergeSource)
              ? 'opacity-40'
              : '';

          return (
            <React.Fragment key={scheduledHeat.id + '-' + idx}>
              <tr
                draggable={!mergeSource}
                onDragStart={() => onDragStart(idx)}
                onDragOver={(e) => onDragOver(e, idx)}
                onDragEnd={onDragEnd}
                onClick={mergeSource && isMergeCompatible ? () => onToggleMergeSelection(scheduledHeat.id) : undefined}
                className={[
                  'transition-[background,opacity] duration-150',
                  rowBg,
                  rowOpacity,
                  isBreak ? 'italic' : '',
                  mergeSource && isMergeTarget ? 'cursor-pointer' : '',
                ].filter(Boolean).join(' ')}
                style={{
                  borderLeft: isMergeSource ? '3px solid var(--color-blue-500, #4299e1)' : undefined,
                  borderTop: isDragOver && dragIndex !== null && idx < dragIndex ? '2px solid var(--color-primary-500, #667eea)' : undefined,
                  borderBottom: isDragOver && dragIndex !== null && idx > dragIndex ? '2px solid var(--color-primary-500, #667eea)' : undefined,
                }}
              >
                <td className={`${mergeSource ? 'cursor-default' : 'cursor-grab'} text-center text-gray-400 select-none align-top`}>
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
                <td className="align-top"><strong>{idx + 1}</strong></td>
                {isBreak ? (
                  <td colSpan={5}>
                    <span>
                      {scheduledHeat.breakLabel || 'Break'}
                      {scheduledHeat.breakDuration && (
                        <span className="text-gray-400 ml-2">
                          ({scheduledHeat.breakDuration} min)
                        </span>
                      )}
                      {scheduledHeat.estimatedStartTime && (
                        <span className="text-gray-500 ml-3 text-[0.8125rem]">
                          {formatTime(scheduledHeat.estimatedStartTime)}
                        </span>
                      )}
                    </span>
                  </td>
                ) : (
                  <>
                    <td className="align-top">
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
                    <td className="capitalize align-top">{getHeatRound(scheduledHeat)}</td>
                    <td className="align-top">{getHeatStyle(scheduledHeat, events)}</td>
                    <td className="align-top">{getHeatLevel(scheduledHeat, events)}</td>
                    <td className="align-top text-[0.8125rem] text-gray-600 whitespace-nowrap">
                      {scheduledHeat.estimatedStartTime ? formatTime(scheduledHeat.estimatedStartTime) : ''}
                    </td>
                  </>
                )}
                <td className="align-top">{statusBadge(status)}</td>
                <td className="align-top">
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
                    className="bg-gray-50"
                  >
                    <td></td>
                    <td></td>
                    <td className="pl-7 text-sm">
                      {event?.name || `Event #${entry.eventId}`}
                      <span className="text-gray-400 ml-2">
                        ({coupleCount} couple{coupleCount !== 1 ? 's' : ''})
                      </span>
                    </td>
                    <td className="capitalize text-sm">{entry.round}</td>
                    <td className="text-sm">{event?.style || '\u2014'}</td>
                    <td className="text-sm">{event?.level || '\u2014'}</td>
                    <td></td>
                    <td></td>
                    <td>
                      <button
                        onClick={() => onSplitEntry(scheduledHeat.id, entry.eventId, entry.round)}
                        className="py-0.5 px-2 text-xs cursor-pointer text-red-700 border border-red-200 rounded bg-red-50"
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
        <span className="text-gray-400 ml-2 text-[0.8125rem]">
          ({coupleCount} couple{coupleCount !== 1 ? 's' : ''})
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
  onMoveEvent: (fromIndex: number, toIndex: number) => void;
  onRemoveBreak: (heatIndex: number) => void;
  onStartMerge: (heatId: string, idx: number) => void;
  onToggleExpanded: (heatId: string) => void;
}) {
  if (mergeSource) {
    if (isMergeSource) {
      return (
        <span className="py-0.5 px-1.5 rounded text-[0.6875rem] font-bold bg-blue-200 text-blue-700 tracking-wide">
          SOURCE
        </span>
      );
    }
    if (isMergeChecked) {
      return (
        <span className="text-xs text-green-800 font-semibold">
          ✓ selected
        </span>
      );
    }
    if (incompatibilityReason) {
      return (
        <span className="text-[0.6875rem] text-gray-400 italic">
          {incompatibilityReason}
        </span>
      );
    }
    return null;
  }

  return (
    <div className="flex gap-1 flex-wrap">
      <button
        onClick={() => onMoveEvent(idx, idx - 1)}
        disabled={idx === 0}
        className={`py-0.5 px-1.5 ${idx === 0 ? 'cursor-default opacity-30' : 'cursor-pointer'}`}
      >
        ▲
      </button>
      <button
        onClick={() => onMoveEvent(idx, idx + 1)}
        disabled={idx === totalHeats - 1}
        className={`py-0.5 px-1.5 ${idx === totalHeats - 1 ? 'cursor-default opacity-30' : 'cursor-pointer'}`}
      >
        ▼
      </button>
      {isBreak && (
        <button
          onClick={() => onRemoveBreak(idx)}
          className="py-0.5 px-1.5 text-danger-600 cursor-pointer"
          title="Remove break"
        >
          ✕
        </button>
      )}
      {!isBreak && (
        <button
          onClick={() => onStartMerge(scheduledHeat.id, idx)}
          className="py-0.5 px-1.5 text-xs cursor-pointer"
          title="Merge this heat with others"
        >
          Merge
        </button>
      )}
      {isMultiEntry && (
        <button
          onClick={() => onToggleExpanded(scheduledHeat.id)}
          className="py-0.5 px-1.5 text-xs cursor-pointer"
          title={isExpanded ? 'Collapse entries' : 'Expand to view/split entries'}
        >
          {isExpanded ? 'Collapse' : 'Edit'}
        </button>
      )}
    </div>
  );
}
