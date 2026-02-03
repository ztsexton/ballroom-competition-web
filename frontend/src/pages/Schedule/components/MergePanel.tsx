import React from 'react';
import { Event, CompetitionSchedule, ScheduledHeat } from '../../../types';
import { getEventById, getHeatCoupleCount } from '../utils';

interface MergePanelProps {
  schedule: CompetitionSchedule;
  mergeSource: { heatId: string; idx: number };
  mergeSelected: Set<string>;
  maxCouplesPerHeat: number;
  events: Event[];
  onCancel: () => void;
  onMerge: () => void;
}

export default function MergePanel({
  schedule,
  mergeSource,
  mergeSelected,
  maxCouplesPerHeat,
  events,
  onCancel,
  onMerge,
}: MergePanelProps) {
  const sourceHeat = schedule.heatOrder.find(h => h.id === mergeSource.heatId);
  const sourceCouples = sourceHeat ? getHeatCoupleCount(sourceHeat, events) : 0;
  const sourceLabel = sourceHeat ? sourceHeat.entries.map(e => {
    const ev = getEventById(events, e.eventId);
    return ev?.name || `Event #${e.eventId}`;
  }).join(' + ') : '';

  let selectedCouples = 0;
  for (const selectedId of mergeSelected) {
    const h = schedule.heatOrder.find(x => x.id === selectedId);
    if (h) selectedCouples += getHeatCoupleCount(h, events);
  }
  const totalCouples = sourceCouples + selectedCouples;
  const overLimit = totalCouples > maxCouplesPerHeat;

  // Compute dance overlap info for all involved heats
  type DanceInfo = { name: string; dances: string[] };
  const allInvolvedEvents: DanceInfo[] = [];
  const collectEvents = (heat: ScheduledHeat) => {
    for (const entry of heat.entries) {
      const ev = getEventById(events, entry.eventId);
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
          onClick={onCancel}
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
          onClick={onMerge}
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
}
