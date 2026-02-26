import React from 'react';
import { Event, ScheduledHeat } from '../../../types';

export function getEventById(events: Event[], eventId: number): Event | undefined {
  return events.find(e => e.id === eventId);
}

export function moveItem(list: string[], fromIdx: number, direction: 'up' | 'down'): string[] {
  const toIdx = direction === 'up' ? fromIdx - 1 : fromIdx + 1;
  if (toIdx < 0 || toIdx >= list.length) return list;
  const newList = [...list];
  [newList[fromIdx], newList[toIdx]] = [newList[toIdx], newList[fromIdx]];
  return newList;
}

export function getHeatLabel(heat: ScheduledHeat, events: Event[]): string {
  if (heat.isBreak) return heat.breakLabel || 'Break';
  return heat.entries.map(entry => {
    const event = getEventById(events, entry.eventId);
    return event?.name || 'Unknown';
  }).join(' + ');
}

export function getHeatRound(heat: ScheduledHeat): string {
  if (heat.entries.length === 0) return '';
  const entry = heat.entries[0];
  let round = entry.round;
  if (entry.totalFloorHeats && entry.totalFloorHeats > 1) {
    round += ` (Heat ${(entry.floorHeatIndex ?? 0) + 1} of ${entry.totalFloorHeats})`;
  }
  if (entry.dance) {
    round += ` — ${entry.dance}`;
  }
  return round;
}

export function getHeatStyle(heat: ScheduledHeat, events: Event[]): string {
  const styles = new Set(heat.entries.map(e => getEventById(events, e.eventId)?.style).filter(Boolean));
  return styles.size > 0 ? [...styles].join(', ') : '\u2014';
}

export function getHeatLevel(heat: ScheduledHeat, events: Event[]): string {
  const levels = heat.entries.map(e => getEventById(events, e.eventId)?.level).filter(Boolean);
  if (levels.length === 0) return '\u2014';
  if (new Set(levels).size === 1) return levels[0]!;
  return levels.join(', ');
}

export function formatTime(isoString?: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function getHeatCoupleCount(heat: ScheduledHeat, events: Event[]): number {
  let total = 0;
  for (const entry of heat.entries) {
    if (entry.bibSubset) {
      total += entry.bibSubset.length;
    } else {
      const event = getEventById(events, entry.eventId);
      if (event) {
        const allBibs = new Set<number>();
        event.heats.forEach(h => h.bibs.forEach(b => allBibs.add(b)));
        total += allBibs.size;
      }
    }
  }
  return total;
}

export function getHeatScoringType(heat: ScheduledHeat, events: Event[]): string | null {
  for (const entry of heat.entries) {
    const event = getEventById(events, entry.eventId);
    if (event) return event.scoringType || 'standard';
  }
  return null;
}

export function getHeatPrimaryStyle(heat: ScheduledHeat, events: Event[]): string | null {
  for (const entry of heat.entries) {
    const event = getEventById(events, entry.eventId);
    if (event?.style) return event.style;
  }
  return null;
}

export function getMergeIncompatibilityReason(
  sourceHeat: ScheduledHeat,
  targetHeat: ScheduledHeat,
  events: Event[],
): string | null {
  const srcType = getHeatScoringType(sourceHeat, events);
  const tgtType = getHeatScoringType(targetHeat, events);
  if (srcType !== tgtType) return 'Different scoring type';

  const srcStyle = getHeatPrimaryStyle(sourceHeat, events);
  const tgtStyle = getHeatPrimaryStyle(targetHeat, events);
  if (srcStyle && tgtStyle && srcStyle !== tgtStyle) return `Different style (${tgtStyle})`;

  return null;
}

export function statusBadge(status: string) {
  const styles: Record<string, string> = {
    pending: 'bg-gray-200 text-gray-700',
    scoring: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
  };
  const cls = styles[status] || styles.pending;
  return React.createElement('span', {
    className: `inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`,
  }, status);
}
