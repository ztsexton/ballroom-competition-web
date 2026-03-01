import { useEffect, useState } from 'react';
import { schedulesApi } from '../../../../api/client';
import { JudgeScheduleEntry } from '../../../../types';
import { Skeleton } from '../../../../components/Skeleton';

interface JudgeScheduleViewProps {
  competitionId: number;
}

export default function JudgeScheduleView({ competitionId }: JudgeScheduleViewProps) {
  const [entries, setEntries] = useState<JudgeScheduleEntry[]>([]);
  const [maxMinutes, setMaxMinutes] = useState(360);
  const [loading, setLoading] = useState(true);
  const [expandedJudge, setExpandedJudge] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    schedulesApi.getJudgeSchedule(competitionId)
      .then(res => {
        setEntries(res.data.entries);
        setMaxMinutes(res.data.maxMinutesWithoutBreak);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [competitionId]);

  if (loading) return <Skeleton variant="card" />;

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No judges assigned. Run auto-assign judges when generating the schedule.</p>
      </div>
    );
  }

  const maxHours = Math.round((maxMinutes / 60) * 10) / 10;
  const warningCount = entries.filter(e => e.segments.some(s => s.exceedsLimit)).length;
  const hasTimingData = entries.some(e => e.heats.some(h => h.estimatedStartTime));

  return (
    <div>
      {/* Summary line */}
      <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
        <span>{entries.length} judges</span>
        <span>Max continuous: <strong>{maxHours}h</strong></span>
        {warningCount > 0 && (
          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-semibold">
            {warningCount} judge{warningCount !== 1 ? 's' : ''} exceed{warningCount === 1 ? 's' : ''} limit
          </span>
        )}
      </div>

      {/* Day timeline */}
      {hasTimingData ? (
        <DayTimeline entries={entries} maxMinutes={maxMinutes} />
      ) : (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-6 mb-4 text-center text-sm text-gray-500">
          Set a start time in the schedule configuration to see the daily timeline.
        </div>
      )}

      {/* Judge list */}
      <div className="flex flex-col gap-2 mt-4">
        {entries.map(entry => {
          const hasExceeded = entry.segments.some(s => s.exceedsLimit);
          const isExpanded = expandedJudge === entry.judgeId;

          return (
            <div
              key={entry.judgeId}
              className={`border rounded-lg px-4 py-3 ${
                hasExceeded ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-sm ${hasExceeded ? 'text-amber-700' : 'text-gray-800'}`}>
                    J{entry.judgeNumber}
                  </span>
                  <span className="text-sm text-gray-600">{entry.judgeName}</span>
                  {entry.isChairman && (
                    <span className="text-[10px] text-amber-700 bg-amber-100 px-1 py-0.5 rounded">Chair</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{entry.totalHeatCount} heats</span>
                  <span>{entry.estimatedWorkingMinutes}min</span>
                  {/* Segment summary: 30m | 45m | 20m */}
                  <span className="flex items-center gap-1">
                    {entry.segments.map((seg, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && <span className="text-gray-300">|</span>}
                        <span className={seg.exceedsLimit ? 'text-amber-700 font-semibold' : ''}>
                          {Math.round(seg.durationMinutes)}m
                        </span>
                      </span>
                    ))}
                  </span>
                  {hasExceeded && <span className="text-amber-600 font-bold">!</span>}
                  <button
                    onClick={() => setExpandedJudge(isExpanded ? null : entry.judgeId)}
                    className="text-primary-600 hover:underline cursor-pointer ml-1"
                  >
                    {isExpanded ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-2 max-h-48 overflow-y-auto border-t border-gray-100 pt-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left py-1 pr-2">#</th>
                        <th className="text-left py-1 pr-2">Event</th>
                        <th className="text-left py-1 pr-2">Round</th>
                        {hasTimingData && <th className="text-left py-1">Time</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {entry.heats.map((h, i) => (
                        <tr key={i} className="border-t border-gray-50">
                          <td className="py-1 pr-2 text-gray-400">{h.heatIndex + 1}</td>
                          <td className="py-1 pr-2 truncate max-w-[200px]" title={h.eventNames.join(', ')}>
                            {h.eventNames.join(', ')}
                          </td>
                          <td className="py-1 pr-2 capitalize">{h.round}</td>
                          {hasTimingData && (
                            <td className="py-1 text-gray-400">
                              {h.estimatedStartTime ? formatTime(new Date(h.estimatedStartTime)) : '—'}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

function formatTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'p' : 'a';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, '0')}${ampm}`;
}

function formatHourLabel(d: Date): string {
  const h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12} ${ampm}`;
}

interface TimeBlock {
  startMs: number;
  endMs: number;
  exceedsLimit: boolean;
}

function getTimeBlocks(entry: JudgeScheduleEntry): TimeBlock[] {
  const blocks: TimeBlock[] = [];

  for (const seg of entry.segments) {
    // Find heats that fall within this segment's heat index range
    const segHeats = entry.heats.filter(
      h => h.heatIndex >= seg.startHeatIndex && h.heatIndex <= seg.endHeatIndex
    );
    if (segHeats.length === 0) continue;

    const firstHeat = segHeats[0];
    const lastHeat = segHeats[segHeats.length - 1];
    if (!firstHeat.estimatedStartTime) continue;

    const startMs = new Date(firstHeat.estimatedStartTime).getTime();
    const endMs = lastHeat.estimatedStartTime
      ? new Date(lastHeat.estimatedStartTime).getTime() + (lastHeat.estimatedDurationSeconds || 120) * 1000
      : startMs + seg.durationMinutes * 60 * 1000;

    blocks.push({ startMs, endMs, exceedsLimit: seg.exceedsLimit });
  }

  return blocks;
}

/* ─── Day Timeline ─── */

function DayTimeline({ entries, maxMinutes }: {
  entries: JudgeScheduleEntry[];
  maxMinutes: number;
}) {
  // Compute time blocks for all judges
  const allJudges = entries.map(e => ({ entry: e, blocks: getTimeBlocks(e) }));

  // Find day bounds
  let dayStartMs = Infinity;
  let dayEndMs = -Infinity;
  for (const { blocks } of allJudges) {
    for (const block of blocks) {
      if (block.startMs < dayStartMs) dayStartMs = block.startMs;
      if (block.endMs > dayEndMs) dayEndMs = block.endMs;
    }
  }

  if (dayStartMs === Infinity) return null;

  // Round to hour boundaries
  const startDate = new Date(dayStartMs);
  startDate.setMinutes(0, 0, 0);
  const dayStartRounded = startDate.getTime();

  const endDate = new Date(dayEndMs);
  endDate.setMinutes(0, 0, 0);
  endDate.setHours(endDate.getHours() + 1);
  const dayEndRounded = endDate.getTime();

  const totalMs = dayEndRounded - dayStartRounded;
  if (totalMs <= 0) return null;

  // Generate hour marks
  const hours: Date[] = [];
  const cursor = new Date(dayStartRounded);
  while (cursor.getTime() <= dayEndRounded) {
    hours.push(new Date(cursor));
    cursor.setHours(cursor.getHours() + 1);
  }

  const pct = (ms: number) => ((ms - dayStartRounded) / totalMs) * 100;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Hour labels */}
      <div className="flex border-b border-gray-100 bg-gray-50/50">
        <div className="w-24 flex-shrink-0" />
        <div className="relative flex-1 h-6">
          {hours.map((hour, i) => (
            <span
              key={i}
              className="absolute text-[10px] text-gray-400 -translate-x-1/2 top-1"
              style={{ left: `${pct(hour.getTime())}%` }}
            >
              {formatHourLabel(hour)}
            </span>
          ))}
        </div>
      </div>

      {/* Judge rows */}
      {allJudges.map(({ entry, blocks }, idx) => {
        const hasExceeded = entry.segments.some(s => s.exceedsLimit);
        return (
          <div
            key={entry.judgeId}
            className={`flex items-center ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
          >
            {/* Judge label */}
            <div className="w-24 flex-shrink-0 px-3 py-1">
              <div className="flex items-center gap-1">
                <span className={`text-xs font-bold ${hasExceeded ? 'text-amber-700' : 'text-gray-700'}`}>
                  J{entry.judgeNumber}
                </span>
                <span className="text-[11px] text-gray-500 truncate max-w-[48px]" title={entry.judgeName}>
                  {entry.judgeName.split(' ')[0]}
                </span>
              </div>
            </div>

            {/* Timeline bar */}
            <div className="relative flex-1 h-7 py-0.5">
              <div className="relative h-full bg-gray-100 rounded-sm">
                {/* Hour grid lines */}
                {hours.map((hour, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 w-px bg-gray-200/60"
                    style={{ left: `${pct(hour.getTime())}%` }}
                  />
                ))}

                {/* Work blocks */}
                {blocks.map((block, i) => {
                  const left = pct(block.startMs);
                  const width = pct(block.endMs) - left;
                  return (
                    <div
                      key={i}
                      className={`absolute top-0.5 bottom-0.5 rounded-sm ${
                        block.exceedsLimit ? 'bg-amber-400' : 'bg-primary-400'
                      }`}
                      style={{ left: `${left}%`, width: `${Math.max(width, 0.3)}%` }}
                      title={`${formatTime(new Date(block.startMs))} – ${formatTime(new Date(block.endMs))}${block.exceedsLimit ? ' (exceeds limit)' : ''}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex items-center gap-4 px-3 py-2 border-t border-gray-100 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-primary-400 inline-block" /> Judging
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-amber-400 inline-block" /> Exceeds {maxMinutes / 60}h limit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-gray-100 border border-gray-200 inline-block" /> Off
        </span>
      </div>
    </div>
  );
}
