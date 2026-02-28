import { Event, CompetitionSchedule, ScheduledHeat } from '../../../../types';
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
    <div className="bg-blue-50 border border-blue-400 rounded-lg px-4 py-3 mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm">
          <strong>Merging:</strong> {sourceLabel} ({sourceCouples} couple{sourceCouples !== 1 ? 's' : ''})
        </span>
        <button
          className="px-2 py-1 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-xs font-medium transition-colors hover:bg-gray-200"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[0.8125rem] text-gray-600">
          Select heats below to merge with this one.
          {' '}
          <span className={`font-semibold ${overLimit ? 'text-amber-700' : 'text-green-800'}`}>
            Total: {totalCouples} / {maxCouplesPerHeat} couples
          </span>
        </span>
        <button
          className="px-3 py-1 bg-primary-500 text-white rounded border-none cursor-pointer text-xs font-medium transition-colors hover:bg-primary-600 disabled:opacity-50"
          disabled={mergeSelected.size === 0}
          onClick={onMerge}
        >
          Merge {mergeSelected.size > 0 ? `(${mergeSelected.size})` : ''}
        </button>
      </div>
      {overLimit && (
        <div className="bg-amber-50 border border-amber-400 rounded px-3 py-2 mt-2 text-[0.8125rem] text-amber-800">
          <strong>Warning:</strong> Total couples ({totalCouples}) exceeds the configured maximum ({maxCouplesPerHeat}).
          Merge will proceed with admin override.
        </div>
      )}
      {hasDanceDifferences && (
        <div className="bg-amber-50 border border-amber-500 rounded-md px-3 py-2 mt-2 text-[0.8125rem]">
          <strong className="text-amber-800">Different dance lists</strong>
          <span className="text-amber-900"> — combined heat dances: {fullDanceOrder.join(', ')}</span>
          {earlyExits.length > 0 && (
            <ul className="mt-1 mb-0 pl-5 text-amber-800">
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
