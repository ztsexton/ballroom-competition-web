import { useState, useCallback, useRef, useEffect } from 'react';
import { schedulesApi } from '../../../../api/client';
import { LevelCombiningConfig } from '../../../../types';

interface ConsolidationChanges {
  maxCouplesPerHeat?: number;
  levelCombining?: LevelCombiningConfig;
  defaultDanceDurationSeconds?: number;
  scholarshipDurationSeconds?: number;
  betweenHeatSeconds?: number;
  betweenDanceSeconds?: number;
}

interface Strategy {
  id: string;
  name: string;
  description: string;
  category: 'couples' | 'levels' | 'timing' | 'combined';
  changes: ConsolidationChanges;
  totalHeats: number;
  estimatedDurationMinutes: number;
  timeSavedMinutes: number;
  fitsInWindow: boolean;
}

interface Preview {
  currentHeats: number;
  currentDurationMinutes: number;
  availableMinutes: number | null;
  overflowMinutes: number;
  strategies: Strategy[];
}

interface CombinedResult {
  totalHeats: number;
  estimatedDurationMinutes: number;
  timeSavedMinutes: number;
  fitsInWindow: boolean;
  mergedChanges: ConsolidationChanges;
}

interface ConsolidationPreviewProps {
  competitionId: number;
  overflowMinutes: number;
  isOverflowing: boolean;
  estimatedStartTime?: string;
  estimatedEndTime?: string;
  windowStart?: string;
  windowEnd?: string;
  onApplyStrategy: (changes: ConsolidationChanges) => void;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/** Get the timing sub-group key for a strategy — strategies in the same sub-group supersede each other */
function getTimingSubGroup(strategy: Strategy): string | null {
  if (strategy.category !== 'timing') return null;
  if (strategy.changes.defaultDanceDurationSeconds !== undefined) return 'dance-duration';
  if (strategy.changes.scholarshipDurationSeconds !== undefined) return 'scholarship-duration';
  if (strategy.changes.betweenHeatSeconds !== undefined) return 'between-heat';
  if (strategy.changes.betweenDanceSeconds !== undefined) return 'between-dance';
  return null;
}

const TIMING_SUBGROUP_LABELS: Record<string, string> = {
  'dance-duration': 'Dance Duration',
  'scholarship-duration': 'Scholarship Duration',
  'between-heat': 'Between-Heat Gap',
  'between-dance': 'Between-Dance Gap',
};

const CATEGORY_LABELS: Record<string, string> = {
  couples: 'Couples per Heat',
  levels: 'Level Combining',
  timing: 'Timing Adjustments',
};

const CATEGORY_ORDER = ['couples', 'levels', 'timing'];

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function ConsolidationPreview({ competitionId, overflowMinutes, isOverflowing, estimatedStartTime, estimatedEndTime, windowStart, windowEnd, onApplyStrategy }: ConsolidationPreviewProps) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [combinedResult, setCombinedResult] = useState<CombinedResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setError('');
    setExpanded(true);
    setSelected(new Set());
    setCombinedResult(null);
    try {
      const res = await schedulesApi.getConsolidationPreview(competitionId);
      setPreview(res.data);
    } catch {
      setError('Failed to generate consolidation preview');
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  // Simulate combined strategies when selection changes
  useEffect(() => {
    if (selected.size === 0) {
      setCombinedResult(null);
      return;
    }
    if (selected.size === 1 && preview) {
      const strat = preview.strategies.find(s => s.id === [...selected][0]);
      if (strat) {
        setCombinedResult({
          totalHeats: strat.totalHeats,
          estimatedDurationMinutes: strat.estimatedDurationMinutes,
          timeSavedMinutes: strat.timeSavedMinutes,
          fitsInWindow: strat.fitsInWindow,
          mergedChanges: strat.changes,
        });
        return;
      }
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSimulating(true);
      try {
        const res = await schedulesApi.simulateCombined(competitionId, [...selected]);
        setCombinedResult(res.data);
      } catch {
        // Silently fail
      } finally {
        setSimulating(false);
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [selected, competitionId, preview]);

  const toggleStrategy = (id: string) => {
    if (!preview) return;
    const strategy = preview.strategies.find(s => s.id === id);
    if (!strategy) return;

    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // If this is a timing strategy, remove any other selected strategy in the same sub-group
        // (selecting 15s gap supersedes 20s gap)
        const subGroup = getTimingSubGroup(strategy);
        if (subGroup) {
          for (const otherId of prev) {
            const other = preview.strategies.find(s => s.id === otherId);
            if (other && getTimingSubGroup(other) === subGroup) {
              next.delete(otherId);
            }
          }
        }
      }
      return next;
    });
  };

  const handleApply = () => {
    if (combinedResult) {
      onApplyStrategy(combinedResult.mergedChanges);
    }
  };

  // Group strategies
  const grouped: Record<string, Strategy[]> = {};
  const timingSubGroups: Record<string, Strategy[]> = {};
  if (preview) {
    for (const s of preview.strategies) {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
      const subGroup = getTimingSubGroup(s);
      if (subGroup) {
        if (!timingSubGroups[subGroup]) timingSubGroups[subGroup] = [];
        timingSubGroups[subGroup].push(s);
      }
    }
  }

  // Determine which timing strategies are superseded (hidden)
  // Within a sub-group, if a more aggressive option is selected, hide less aggressive ones
  const superseded = new Set<string>();
  if (preview) {
    for (const [, strategies] of Object.entries(timingSubGroups)) {
      const selectedInGroup = strategies.filter(s => selected.has(s.id));
      if (selectedInGroup.length > 0) {
        // The selected one saves the most time — hide all others that save less
        const maxSaved = Math.max(...selectedInGroup.map(s => s.timeSavedMinutes));
        for (const s of strategies) {
          if (!selected.has(s.id) && s.timeSavedMinutes < maxSaved) {
            superseded.add(s.id);
          }
        }
      }
    }
  }

  if (!expanded) {
    return (
      <div className={`mt-4 px-4 py-3 rounded-lg border ${
        isOverflowing
          ? 'bg-amber-50 border-amber-300'
          : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className={`text-sm ${isOverflowing ? 'text-amber-900' : 'text-gray-700'}`}>
            {isOverflowing ? (
              <>
                <strong>Schedule overflows by {overflowMinutes} minutes.</strong>{' '}
                Get consolidation options to help fit within the time window.
              </>
            ) : (
              <>
                <strong>Schedule Optimization</strong>{' '}
                — explore options to adjust timing, heat sizes, and level combining.
              </>
            )}
          </div>
          <button
            className={`px-4 py-1.5 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap ml-4 ${
              isOverflowing
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-gray-600 hover:bg-gray-700'
            }`}
            onClick={handleAnalyze}
            disabled={loading}
          >
            {loading ? 'Analyzing...' : 'Show Options'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h3 className="m-0 text-lg font-semibold">Schedule Optimization</h3>
          <p className="text-xs text-gray-500 mt-0.5 mb-0">Select one or more options, then apply to regenerate the schedule.</p>
        </div>
        <button
          className="text-sm text-gray-500 bg-transparent border-none cursor-pointer hover:text-gray-700"
          onClick={() => setExpanded(false)}
        >
          Close
        </button>
      </div>

      {error && <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}

      {loading && (
        <div className="p-8 text-center text-gray-500">
          <svg className="animate-spin h-6 w-6 text-primary-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Simulating schedule configurations...
        </div>
      )}

      {preview && !loading && (
        <div className="p-4">
          {/* Schedule window & current status */}
          <div className={`mb-4 p-3 rounded-lg text-sm ${isOverflowing ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
            {/* Schedule window times */}
            {(windowStart || estimatedStartTime) && (
              <div className="flex flex-wrap gap-x-6 gap-y-1 mb-2 pb-2 border-b border-gray-200 text-sm">
                {windowStart && windowEnd && (
                  <span>Window: <strong>{windowStart} – {windowEnd}</strong></span>
                )}
                {estimatedStartTime && (
                  <span>Estimated: <strong>{formatTime(estimatedStartTime)}</strong></span>
                )}
                {estimatedEndTime && (
                  <span>→ <strong>{formatTime(estimatedEndTime)}</strong></span>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="text-gray-500 text-xs">Heats</div>
                <div className="font-semibold">{preview.currentHeats}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Duration</div>
                <div className="font-semibold">{formatDuration(preview.currentDurationMinutes)}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Available</div>
                <div className="font-semibold">{preview.availableMinutes !== null ? formatDuration(preview.availableMinutes) : 'Not set'}</div>
              </div>
              {isOverflowing ? (
                <div>
                  <div className="text-gray-500 text-xs">Need to save</div>
                  <div className="font-semibold text-amber-700">{formatDuration(preview.overflowMinutes)}</div>
                </div>
              ) : (
                <div>
                  <div className="text-gray-500 text-xs">Status</div>
                  <div className="font-semibold text-green-700">Fits</div>
                </div>
              )}
            </div>
          </div>

          {/* Combined preview bar */}
          {selected.size > 0 && (
            <div className={`mb-4 p-3 rounded-lg border-2 ${
              combinedResult?.fitsInWindow ? 'border-green-400 bg-green-50' : 'border-blue-300 bg-blue-50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm font-semibold mb-1">
                    {selected.size} option{selected.size !== 1 ? 's' : ''} selected
                    {simulating && <span className="text-gray-500 font-normal ml-2">Simulating...</span>}
                  </div>
                  {combinedResult && !simulating && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span>{combinedResult.totalHeats} heats</span>
                      <span>{formatDuration(combinedResult.estimatedDurationMinutes)}</span>
                      <span className="text-green-700 font-semibold">-{formatDuration(combinedResult.timeSavedMinutes)}</span>
                      {combinedResult.fitsInWindow && (
                        <span className="px-1.5 py-0.5 bg-green-200 text-green-800 text-xs rounded font-medium">
                          Fits in window
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0 ml-4">
                  <button
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-xs font-medium transition-colors hover:bg-gray-200"
                    onClick={() => setSelected(new Set())}
                  >
                    Clear
                  </button>
                  <button
                    className="px-4 py-1.5 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 disabled:opacity-50 whitespace-nowrap"
                    onClick={handleApply}
                    disabled={!combinedResult || simulating}
                  >
                    Apply & Regenerate
                  </button>
                </div>
              </div>
            </div>
          )}

          {preview.strategies.length === 0 ? (
            <div className="text-center p-6 text-gray-500">
              No optimization options available. The schedule is already using the most compact settings.
            </div>
          ) : (
            <div className="space-y-5">
              {CATEGORY_ORDER.filter(cat => grouped[cat]?.length > 0).map(cat => (
                <div key={cat}>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {CATEGORY_LABELS[cat]}
                  </h4>

                  {cat === 'timing' ? (
                    // Render timing strategies grouped into sub-sections
                    <div className="space-y-3">
                      {Object.entries(timingSubGroups).map(([subKey, strategies]) => {
                        const visibleStrategies = strategies.filter(s => !superseded.has(s.id));
                        if (visibleStrategies.length === 0) return null;

                        return (
                          <div key={subKey}>
                            <div className="text-xs font-medium text-gray-400 mb-1 ml-1">
                              {TIMING_SUBGROUP_LABELS[subKey]}
                            </div>
                            <div className="space-y-1">
                              {visibleStrategies.map(strategy => (
                                <StrategyRow
                                  key={strategy.id}
                                  strategy={strategy}
                                  isSelected={selected.has(strategy.id)}
                                  currentDuration={preview.currentDurationMinutes}
                                  onToggle={() => toggleStrategy(strategy.id)}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {grouped[cat].map(strategy => (
                        <StrategyRow
                          key={strategy.id}
                          strategy={strategy}
                          isSelected={selected.has(strategy.id)}
                          currentDuration={preview.currentDurationMinutes}
                          onToggle={() => toggleStrategy(strategy.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex justify-end">
            <button
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-xs font-medium transition-colors hover:bg-gray-200"
              onClick={handleAnalyze}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StrategyRow({
  strategy,
  isSelected,
  currentDuration,
  onToggle,
}: {
  strategy: Strategy;
  isSelected: boolean;
  currentDuration: number;
  onToggle: () => void;
}) {
  const pctSaved = currentDuration > 0
    ? Math.round((strategy.timeSavedMinutes / currentDuration) * 100)
    : 0;

  return (
    <label
      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
        isSelected
          ? 'border-primary-300 bg-primary-50'
          : strategy.fitsInWindow
            ? 'border-green-200 bg-green-50 hover:bg-green-100'
            : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="rounded shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{strategy.name}</span>
          {strategy.fitsInWindow && !isSelected && (
            <span className="px-1.5 py-0.5 bg-green-200 text-green-800 text-xs rounded font-medium">
              Fits alone
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 mb-0">{strategy.description}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0 text-right">
        <div>
          <div className="text-sm font-semibold">{strategy.totalHeats} heats</div>
          <div className="text-xs text-gray-500">{formatDuration(strategy.estimatedDurationMinutes)}</div>
        </div>
        <div className="min-w-[4rem]">
          <div className="text-sm font-semibold text-green-700">-{formatDuration(strategy.timeSavedMinutes)}</div>
          <div className="text-xs text-gray-400">{pctSaved}%</div>
        </div>
      </div>
    </label>
  );
}
