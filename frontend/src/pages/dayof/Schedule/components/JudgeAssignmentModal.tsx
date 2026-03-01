import { useState } from 'react';
import { Judge, Event, ScheduledHeat } from '../../../../types';
import { schedulesApi } from '../../../../api/client';

interface JudgeAssignmentModalProps {
  heat: ScheduledHeat;
  judges: Judge[];
  events: Record<number, Event>;
  competitionId: number;
  onClose: () => void;
  onSaved: (updatedEvents: Record<number, Event>) => void;
}

export default function JudgeAssignmentModal({
  heat,
  judges,
  events,
  competitionId,
  onClose,
  onSaved,
}: JudgeAssignmentModalProps) {
  // Get currently assigned judge IDs from the first entry's event heat
  const getAssignedJudgeIds = (): number[] => {
    for (const entry of heat.entries) {
      const event = events[entry.eventId];
      if (!event) continue;
      const eventHeat = event.heats.find(h => h.round === entry.round);
      if (eventHeat) return eventHeat.judges;
    }
    return [];
  };

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set(getAssignedJudgeIds()));
  const [saving, setSaving] = useState(false);

  const toggle = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await schedulesApi.updateHeatJudges(competitionId, heat.id, [...selectedIds]);
      onSaved(res.data);
      onClose();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  // Build heat label
  const entryLabels = heat.entries.map(e => {
    const event = events[e.eventId];
    return event?.name || `Event #${e.eventId}`;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-800 mb-1">Assign Judges</h3>
        <p className="text-sm text-gray-500 mb-4 truncate" title={entryLabels.join(', ')}>
          {entryLabels.join(', ')}
        </p>

        <div className="flex flex-col gap-2 mb-4 max-h-64 overflow-y-auto">
          {judges
            .sort((a, b) => a.judgeNumber - b.judgeNumber)
            .map(judge => (
              <label
                key={judge.id}
                className="flex items-center gap-3 px-3 py-2 rounded border border-gray-200 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(judge.id)}
                  onChange={() => toggle(judge.id)}
                  className="cursor-pointer"
                />
                <span className="text-sm font-medium">
                  J{judge.judgeNumber}
                </span>
                <span className="text-sm text-gray-600">{judge.name}</span>
                {judge.isChairman && (
                  <span className="ml-auto text-xs text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Chair</span>
                )}
              </label>
            ))}
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || selectedIds.size === 0}
            className="px-4 py-2 text-sm text-white bg-primary-500 rounded hover:bg-primary-600 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
