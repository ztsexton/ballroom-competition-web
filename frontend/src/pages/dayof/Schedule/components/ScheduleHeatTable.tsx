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
            ? getMergeIncompatibilityReason(sourceHeatObj, scheduledHeat, events)
            : null;
          const isMergeCompatible = isMergeTarget && incompatibilityReason === null;

          return (
            <React.Fragment key={scheduledHeat.id + '-' + idx}>
              <tr
                draggable={!mergeSource}
                onDragStart={() => onDragStart(idx)}
                onDragOver={(e) => onDragOver(e, idx)}
                onDragEnd={onDragEnd}
                onClick={mergeSource && isMergeCompatible ? () => onToggleMergeSelection(scheduledHeat.id) : undefined}
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
                        onChange={(e) => { e.stopPropagation(); onToggleMergeSelection(scheduledHeat.id); }}
                        style={{ cursor: isMergeCompatible ? 'pointer' : 'not-allowed' }}
                        title={incompatibilityReason || undefined}
                      />
                    )
                  ) : (
                    '\u2630'
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
                    <td style={{ textTransform: 'capitalize', verticalAlign: 'top' }}>{getHeatRound(scheduledHeat)}</td>
                    <td style={{ verticalAlign: 'top' }}>{getHeatStyle(scheduledHeat, events)}</td>
                    <td style={{ verticalAlign: 'top' }}>{getHeatLevel(scheduledHeat, events)}</td>
                    <td style={{ verticalAlign: 'top', fontSize: '0.8125rem', color: '#4a5568', whiteSpace: 'nowrap' }}>
                      {scheduledHeat.estimatedStartTime ? formatTime(scheduledHeat.estimatedStartTime) : ''}
                    </td>
                  </>
                )}
                <td style={{ verticalAlign: 'top' }}>{statusBadge(status)}</td>
                <td style={{ verticalAlign: 'top' }}>
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
                        onClick={() => onSplitEntry(scheduledHeat.id, entry.eventId, entry.round)}
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
    <div style={{ borderLeft: '3px solid #805ad5', paddingLeft: '0.625rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
        <span
          onClick={(e) => { e.stopPropagation(); onToggleExpanded(scheduledHeat.id); }}
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
          const event = getEventById(events, entry.eventId);
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
      );
    }
    if (isMergeChecked) {
      return (
        <span style={{ fontSize: '0.75rem', color: '#276749', fontWeight: 600 }}>
          ✓ selected
        </span>
      );
    }
    if (incompatibilityReason) {
      return (
        <span style={{ fontSize: '0.6875rem', color: '#a0aec0', fontStyle: 'italic' }}>
          {incompatibilityReason}
        </span>
      );
    }
    return null;
  }

  return (
    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
      <button
        onClick={() => onMoveEvent(idx, idx - 1)}
        disabled={idx === 0}
        style={{ padding: '0.125rem 0.375rem', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1 }}
      >
        ▲
      </button>
      <button
        onClick={() => onMoveEvent(idx, idx + 1)}
        disabled={idx === totalHeats - 1}
        style={{ padding: '0.125rem 0.375rem', cursor: idx === totalHeats - 1 ? 'default' : 'pointer', opacity: idx === totalHeats - 1 ? 0.3 : 1 }}
      >
        ▼
      </button>
      {isBreak && (
        <button
          onClick={() => onRemoveBreak(idx)}
          style={{ padding: '0.125rem 0.375rem', color: '#e53e3e', cursor: 'pointer' }}
          title="Remove break"
        >
          ✕
        </button>
      )}
      {!isBreak && (
        <button
          onClick={() => onStartMerge(scheduledHeat.id, idx)}
          style={{ padding: '0.125rem 0.375rem', fontSize: '0.75rem', cursor: 'pointer' }}
          title="Merge this heat with others"
        >
          Merge
        </button>
      )}
      {isMultiEntry && (
        <button
          onClick={() => onToggleExpanded(scheduledHeat.id)}
          style={{ padding: '0.125rem 0.375rem', fontSize: '0.75rem', cursor: 'pointer' }}
          title={isExpanded ? 'Collapse entries' : 'Expand to view/split entries'}
        >
          {isExpanded ? 'Collapse' : 'Edit'}
        </button>
      )}
    </div>
  );
}
