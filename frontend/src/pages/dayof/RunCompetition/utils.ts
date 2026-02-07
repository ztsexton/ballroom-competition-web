import { Event, ScheduledHeat } from '../../../types';

export function formatTime(isoString?: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function statusColor(status: string): string {
  switch (status) {
    case 'pending': return '#e2e8f0';
    case 'scoring': return '#fefcbf';
    case 'completed': return '#c6f6d5';
    default: return '#e2e8f0';
  }
}

export function statusIcon(status: string): string {
  switch (status) {
    case 'pending': return '\u25cb';
    case 'scoring': return '\u25d1';
    case 'completed': return '\u25cf';
    default: return '\u25cb';
  }
}

export function getHeatLabel(heat: ScheduledHeat, events: Record<number, Event>): string {
  if (heat.isBreak) return heat.breakLabel || 'Break';
  const labels = heat.entries.map(entry => {
    const event = events[entry.eventId];
    return event ? event.name : 'Unknown';
  });
  if (labels.length === 1) return labels[0];
  return labels.join(' + ');
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
