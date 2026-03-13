import { useState, useCallback } from 'react';
import { schedulesApi } from '../../../../api/client';
import { CompetitionSchedule } from '../../../../types';

interface ScheduleAnalysis {
  estimatedDurationMinutes: number;
  availableMinutes: number | null;
  overflowMinutes: number;
  fitsInWindow: boolean;
  hardStopTime?: string;
  estimatedEndTime?: string;
  exceedsHardStop?: boolean;
  hardStopOverflowMinutes?: number;
  suggestions: Array<{
    type: 'merge' | 'increase-max-couples';
    description: string;
    details: { sourceIndex?: number; targetIndex?: number; newMaxCouples?: number };
    estimatedTimeSavingMinutes: number;
  }>;
}

interface ScheduleOptimizerProps {
  competitionId: number;
  onScheduleUpdated: (schedule: CompetitionSchedule) => void;
}

export default function ScheduleOptimizer({ competitionId, onScheduleUpdated }: ScheduleOptimizerProps) {
  const [analysis, setAnalysis] = useState<ScheduleAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await schedulesApi.analyze(competitionId);
      setAnalysis(res.data);
      setSelectedSuggestions(new Set());
    } catch {
      setError('Failed to analyze schedule');
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  const handleApply = async () => {
    if (!analysis || selectedSuggestions.size === 0) return;
    setApplying(true);
    setError('');
    try {
      const mergeSuggestions = [...selectedSuggestions].filter(
        idx => analysis.suggestions[idx]?.type === 'merge'
      );
      const res = await schedulesApi.optimize(competitionId, mergeSuggestions);
      onScheduleUpdated(res.data);
      setAnalysis(null);
      setSelectedSuggestions(new Set());
    } catch {
      setError('Failed to apply optimizations');
    } finally {
      setApplying(false);
    }
  };

  const toggleSuggestion = (idx: number) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3">
        <button
          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200 disabled:opacity-50"
          onClick={handleAnalyze}
          disabled={loading}
        >
          {loading ? 'Analyzing...' : 'Analyze Schedule'}
        </button>
        {analysis && analysis.fitsInWindow && !analysis.exceedsHardStop && (
          <span className="text-sm text-green-700 font-medium">Schedule fits within configured time</span>
        )}
      </div>

      {error && <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}

      {analysis && analysis.exceedsHardStop && (
        <div className="mt-3 bg-red-50 border border-red-300 rounded-lg p-4">
          <div className="text-sm text-red-900 mb-3">
            <strong>Exceeds hard stop:</strong>{' '}
            Schedule ends ~{analysis.hardStopOverflowMinutes} min past the {analysis.hardStopTime} deadline
          </div>
        </div>
      )}

      {analysis && (!analysis.fitsInWindow || analysis.exceedsHardStop) && (
        <div className="mt-3 bg-amber-50 border border-amber-300 rounded-lg p-4">
          {!analysis.fitsInWindow && (
            <div className="text-sm text-amber-900 mb-3">
              <strong>Schedule overflow:</strong>{' '}
              Estimated {analysis.estimatedDurationMinutes} min vs {analysis.availableMinutes} min available
              ({analysis.overflowMinutes} min over)
            </div>
          )}

          {analysis.suggestions.length > 0 ? (
            <>
              <div className="text-sm font-semibold text-amber-800 mb-2">Suggestions:</div>
              <div className="flex flex-col gap-1.5">
                {analysis.suggestions.map((suggestion, idx) => (
                  <label
                    key={idx}
                    className="flex items-start gap-2 p-2 bg-white/60 rounded border border-amber-200 cursor-pointer hover:bg-white/80"
                  >
                    {suggestion.type === 'merge' && (
                      <input
                        type="checkbox"
                        checked={selectedSuggestions.has(idx)}
                        onChange={() => toggleSuggestion(idx)}
                        className="mt-0.5 cursor-pointer"
                      />
                    )}
                    <div className="flex-1 text-sm">
                      <div className="text-gray-800">{suggestion.description}</div>
                      {suggestion.estimatedTimeSavingMinutes > 0 && (
                        <div className="text-gray-500 text-xs mt-0.5">
                          Saves ~{suggestion.estimatedTimeSavingMinutes.toFixed(1)} min
                        </div>
                      )}
                      {suggestion.type === 'increase-max-couples' && (
                        <div className="text-gray-500 text-xs mt-0.5">
                          Requires schedule regeneration
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {[...selectedSuggestions].some(idx => analysis.suggestions[idx]?.type === 'merge') && (
                <button
                  className="mt-3 px-4 py-1.5 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 disabled:opacity-50"
                  onClick={handleApply}
                  disabled={applying}
                >
                  {applying ? 'Applying...' : `Apply Selected (${[...selectedSuggestions].filter(idx => analysis.suggestions[idx]?.type === 'merge').length})`}
                </button>
              )}
            </>
          ) : (
            <div className="text-sm text-amber-700">No automatic suggestions available. Consider manually merging heats or adjusting timing settings.</div>
          )}
        </div>
      )}
    </div>
  );
}
