import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { competitionsApi } from '../../api/client';
import { useCompetition } from '../../context/CompetitionContext';
import { useToast } from '../../context/ToastContext';
import { Skeleton } from '../../components/Skeleton';

interface EntryAction {
  eventId: number;
  eventName: string;
  currentLevel: string;
  style: string | undefined;
  validTargetLevels: string[];
  defaultTargetLevel: string;
}

interface CoupleConflict {
  bib: number;
  leaderName: string;
  followerName: string;
  style: string | undefined;
  conflictType: 'per-style' | 'cross-style';
  entries: Array<{ eventId: number; eventName: string; level: string; style: string | undefined; inRange: boolean }>;
  currentRange: string;
  allowedRange: string[];
  entryActions: EntryAction[];
}

interface PendingEntryEnriched {
  id: string;
  bib: number;
  combination: {
    designation?: string;
    syllabusType?: string;
    level?: string;
    style?: string;
    dances?: string[];
    scoringType?: string;
    ageCategory?: string;
  };
  reason: string;
  requestedAt: string;
  leaderName: string;
  followerName: string;
}

// Per-entry decision: remove, move to a chosen level, or leave alone (no action)
type EntryDecision = { action: 'remove' } | { action: 'move'; targetLevel: string } | { action: 'none' };

const ValidationPage = () => {
  const { id } = useParams<{ id: string }>();
  const competitionId = parseInt(id || '0');
  const { activeCompetition, refreshCompetitions } = useCompetition();
  const { showToast } = useToast();

  const [conflicts, setConflicts] = useState<CoupleConflict[]>([]);
  const [pendingEntries, setPendingEntries] = useState<PendingEntryEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Per-entry decisions keyed by `${bib}-${eventId}`
  const [decisions, setDecisions] = useState<Record<string, EntryDecision>>({});
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!competitionId) return;
    loadData();
  }, [competitionId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resolutionsRes, pendingRes] = await Promise.all([
        competitionsApi.getValidationResolutions(competitionId),
        competitionsApi.getPendingEntries(competitionId),
      ]);
      setConflicts(resolutionsRes.data.conflicts);
      setPendingEntries(pendingRes.data.pendingEntries);

      // Initialize all decisions to "no action" — admin picks which to act on
      const initial: Record<string, EntryDecision> = {};
      for (const conflict of resolutionsRes.data.conflicts) {
        for (const ea of conflict.entryActions) {
          initial[`${conflict.bib}-${ea.eventId}`] = { action: 'none' };
        }
      }
      setDecisions(initial);
    } catch {
      showToast('Failed to load validation data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const conflictKey = (c: CoupleConflict) => `${c.bib}-${c.conflictType}-${c.style || 'all'}`;

  const setDecision = (conflict: CoupleConflict, eventId: number, decision: EntryDecision) => {
    setDecisions(prev => {
      const next = { ...prev };
      // When selecting an action on one entry, reset all other entries for this conflict to "none"
      if (decision.action !== 'none') {
        for (const ea of conflict.entryActions) {
          if (ea.eventId !== eventId) {
            next[`${conflict.bib}-${ea.eventId}`] = { action: 'none' };
          }
        }
      }
      next[`${conflict.bib}-${eventId}`] = decision;
      return next;
    });
    setConfirmingKey(null);
  };

  const getDecision = (bib: number, eventId: number): EntryDecision => {
    return decisions[`${bib}-${eventId}`] || { action: 'none' };
  };

  const handleApply = async (conflict: CoupleConflict) => {
    setApplying(true);
    try {
      const actions: Array<{ eventId: number; action: 'remove' | 'move'; bib: number; targetLevel?: string }> = [];
      for (const ea of conflict.entryActions) {
        const d = getDecision(conflict.bib, ea.eventId);
        if (d.action === 'remove') {
          actions.push({ eventId: ea.eventId, action: 'remove', bib: conflict.bib });
        } else if (d.action === 'move') {
          actions.push({ eventId: ea.eventId, action: 'move', bib: conflict.bib, targetLevel: d.targetLevel });
        }
      }
      if (actions.length === 0) {
        showToast('No actions selected', 'error');
        setApplying(false);
        return;
      }
      const res = await competitionsApi.applyResolution(competitionId, actions);
      if (res.data.allSuccess) {
        showToast('Resolution applied successfully', 'success');
      } else {
        const failures = res.data.results.filter(r => !r.success);
        showToast(`${failures.length} action(s) failed: ${failures.map(f => f.error).join(', ')}`, 'error');
      }
      setConfirmingKey(null);
      setExpandedKey(null);
      await refreshCompetitions();
      await loadData();
    } catch {
      showToast('Failed to apply resolution', 'error');
    } finally {
      setApplying(false);
    }
  };

  const handleApprovePending = async (entryId: string) => {
    try {
      await competitionsApi.approvePendingEntry(competitionId, entryId);
      showToast('Entry approved', 'success');
      await refreshCompetitions();
      await loadData();
    } catch {
      showToast('Failed to approve entry', 'error');
    }
  };

  const handleRejectPending = async (entryId: string) => {
    try {
      await competitionsApi.rejectPendingEntry(competitionId, entryId);
      showToast('Entry rejected', 'info');
      await refreshCompetitions();
      await loadData();
    } catch {
      showToast('Failed to reject entry', 'error');
    }
  };

  const validationEnabled = activeCompetition?.entryValidation?.enabled;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <Skeleton variant="card" className="mb-4" />
        <Skeleton variant="card" />
      </div>
    );
  }

  if (!validationEnabled) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Entry Validation</h2>
          <p className="text-gray-500">
            Entry validation is not enabled for this competition. Enable it in{' '}
            <span className="font-medium text-primary-500">Settings &rarr; Entry Validation</span> to use this feature.
          </p>
        </div>
      </div>
    );
  }

  const formatCombination = (c: PendingEntryEnriched['combination']) =>
    [c.designation, c.syllabusType, c.level, c.style, c.dances?.join(', ')].filter(Boolean).join(' \u2022 ') || '\u2014';

  const totalIssues = conflicts.length + pendingEntries.length;

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Entry Validation</h2>
        <p className="text-gray-500 text-sm">
          Review level conflicts and pending entry approvals. Level restrictions are validated per style, with optional cross-style limits.
        </p>
      </div>

      {/* Summary bar */}
      {totalIssues === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-5 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-green-600 text-xl">&#10003;</span>
            <p className="text-green-800 font-medium">All entries are within valid level ranges. No issues found.</p>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-amber-800 text-sm font-medium">
            {conflicts.length > 0 && `${conflicts.length} level conflict${conflicts.length !== 1 ? 's' : ''}`}
            {conflicts.length > 0 && pendingEntries.length > 0 && ' and '}
            {pendingEntries.length > 0 && `${pendingEntries.length} pending approval${pendingEntries.length !== 1 ? 's' : ''}`}
            {' '}to review.
          </p>
        </div>
      )}

      {/* Pending Entries Section */}
      {pendingEntries.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Pending Approvals</h3>
          <p className="text-sm text-gray-500 mb-3">
            These entries were submitted by participants but are outside their current level range.
          </p>
          <div className="space-y-2">
            {pendingEntries.map(entry => (
              <div key={entry.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-sm">
                      <span className="font-semibold text-gray-800">Bib {entry.bib}</span>
                      <span className="text-gray-400 mx-1.5">&middot;</span>
                      <span className="text-gray-700">{entry.leaderName} &amp; {entry.followerName}</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Requested: <span className="font-medium">{formatCombination(entry.combination)}</span>
                    </div>
                    <p className="text-xs text-amber-600 mt-1">{entry.reason}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Requested {new Date(entry.requestedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleApprovePending(entry.id)}
                      className="px-3 py-1.5 bg-success-500 text-white rounded border-none cursor-pointer text-xs font-medium hover:bg-success-600 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectPending(entry.id)}
                      className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded border-none cursor-pointer text-xs font-medium hover:bg-gray-300 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Level Conflicts Section */}
      {conflicts.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Level Conflicts</h3>
          <p className="text-sm text-gray-500 mb-3">
            These couples have entries spanning levels outside the competition's allowed range.
            Expand each to choose how to resolve.
          </p>
          <div className="space-y-3">
            {conflicts.map(conflict => {
              const ck = conflictKey(conflict);
              const isExpanded = expandedKey === ck;
              const isConfirming = confirmingKey === ck;

              // Check if at least one action is chosen
              const hasAction = conflict.entryActions.some(ea => {
                const d = getDecision(conflict.bib, ea.eventId);
                return d.action !== 'none';
              });

              return (
                <div key={ck} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                  {/* Header */}
                  <button
                    onClick={() => {
                      setExpandedKey(isExpanded ? null : ck);
                      setConfirmingKey(null);
                    }}
                    className="w-full flex items-center justify-between px-5 py-4 text-left bg-transparent border-none cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        conflict.conflictType === 'cross-style' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {conflict.bib}
                      </span>
                      <div>
                        <div className="font-semibold text-gray-800">
                          {conflict.leaderName} &amp; {conflict.followerName}
                          {conflict.style && (
                            <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">{conflict.style}</span>
                          )}
                          {conflict.conflictType === 'cross-style' && (
                            <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded bg-purple-100 text-purple-600">Cross-Style</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mt-0.5">
                          {conflict.entries.length} entries in conflict
                          <span className="text-gray-400 mx-1.5">&middot;</span>
                          Spans: {conflict.currentRange}
                        </div>
                      </div>
                    </div>
                    <span className="text-gray-400 text-lg transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                      &#9660;
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-5 py-4">
                      {/* Current entries overview */}
                      <div className="mb-5">
                        <h4 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Current Entries</h4>
                        <div className="flex flex-wrap gap-2">
                          {conflict.entries.map((entry, i) => (
                            <span
                              key={i}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium ${
                                entry.inRange
                                  ? 'bg-gray-100 text-gray-700 border border-gray-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${entry.inRange ? 'bg-green-400' : 'bg-red-400'}`} />
                              {entry.level}: {entry.eventName}
                              {conflict.conflictType === 'cross-style' && entry.style && (
                                <span className="text-gray-400 ml-1">({entry.style})</span>
                              )}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          These entries span too wide a range. With current rules, allowed range from lowest entry ({conflict.entries.find(e => e.inRange)?.level || conflict.entries[0]?.level}): <span className="font-medium">{conflict.allowedRange.join(', ')}</span>
                        </p>
                      </div>

                      {/* Per-entry actions */}
                      <div className="mb-5">
                        <h4 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-1">
                          Choose How to Resolve
                        </h4>
                        <p className="text-xs text-gray-500 mb-3">
                          Pick one entry to move or remove. You can act on any entry — move a lower entry up or a higher entry down.
                        </p>
                        <div className="space-y-3">
                          {(() => {
                            // Find which entry (if any) has an active action
                            const activeEventId = conflict.entryActions.find(
                              ea => getDecision(conflict.bib, ea.eventId).action !== 'none'
                            )?.eventId ?? null;
                            return conflict.entryActions.map(ea => {
                            const d = getDecision(conflict.bib, ea.eventId);
                            const isInRange = conflict.entries.find(e => e.eventId === ea.eventId)?.inRange ?? false;
                            const isDisabled = activeEventId !== null && activeEventId !== ea.eventId;
                            return (
                              <div key={ea.eventId} className={`border rounded-lg overflow-hidden transition-opacity ${d.action !== 'none' ? 'border-primary-300 shadow-sm' : 'border-gray-200'} ${isDisabled ? 'opacity-45 pointer-events-none' : ''}`}>
                                {/* Entry header */}
                                <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${isInRange ? 'bg-green-400' : 'bg-red-400'}`} />
                                  <span className="text-sm font-semibold text-gray-800">{ea.eventName}</span>
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">{ea.currentLevel}</span>
                                </div>

                                {/* Action choices */}
                                <div className="p-3 space-y-2 bg-white">
                                  {/* Keep as-is */}
                                  <label
                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                                      d.action === 'none'
                                        ? 'border-gray-300 bg-gray-50'
                                        : 'border-transparent hover:bg-gray-50'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={`action-${conflict.bib}-${ea.eventId}`}
                                      checked={d.action === 'none'}
                                      onChange={() => setDecision(conflict, ea.eventId, { action: 'none' })}
                                      className="shrink-0"
                                    />
                                    <span className="text-sm text-gray-600">Keep as-is</span>
                                  </label>

                                  {/* Move option */}
                                  {ea.validTargetLevels.length > 0 && (
                                    <label
                                      className={`flex items-start gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                                        d.action === 'move'
                                          ? 'border-primary-400 bg-primary-50'
                                          : 'border-transparent hover:bg-gray-50'
                                      }`}
                                      onClick={() => {
                                        if (d.action !== 'move') {
                                          setDecision(conflict, ea.eventId, { action: 'move', targetLevel: ea.defaultTargetLevel });
                                        }
                                      }}
                                    >
                                      <input
                                        type="radio"
                                        name={`action-${conflict.bib}-${ea.eventId}`}
                                        checked={d.action === 'move'}
                                        onChange={() => setDecision(conflict, ea.eventId, { action: 'move', targetLevel: d.action === 'move' ? d.targetLevel : ea.defaultTargetLevel })}
                                        className="mt-0.5 shrink-0"
                                      />
                                      <div className="flex-1">
                                        <span className="text-sm font-medium text-gray-800">Move to different level</span>
                                        {d.action === 'move' && (
                                          <div className="mt-2 flex flex-wrap gap-1.5">
                                            {ea.validTargetLevels.map(lvl => (
                                              <button
                                                key={lvl}
                                                type="button"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  setDecision(conflict, ea.eventId, { action: 'move', targetLevel: lvl });
                                                }}
                                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                                                  d.targetLevel === lvl
                                                    ? 'bg-primary-500 text-white border-primary-500'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:border-primary-300 hover:text-primary-600'
                                                }`}
                                              >
                                                {lvl}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </label>
                                  )}

                                  {/* Remove option */}
                                  <label
                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                                      d.action === 'remove'
                                        ? 'border-red-300 bg-red-50'
                                        : 'border-transparent hover:bg-gray-50'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={`action-${conflict.bib}-${ea.eventId}`}
                                      checked={d.action === 'remove'}
                                      onChange={() => setDecision(conflict, ea.eventId, { action: 'remove' })}
                                      className="shrink-0"
                                    />
                                    <span className="text-sm text-red-700 font-medium">Remove from this event</span>
                                  </label>
                                </div>
                              </div>
                            );
                          });
                          })()}
                        </div>
                      </div>

                      {/* Action / Confirmation */}
                      {!isConfirming && (
                        <div className="flex justify-end">
                          <button
                            onClick={() => setConfirmingKey(ck)}
                            disabled={!hasAction}
                            className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Review &amp; Confirm
                          </button>
                        </div>
                      )}

                      {isConfirming && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-amber-800 mb-2">Confirm Changes</h4>
                          <p className="text-sm text-amber-700 mb-3">
                            The following changes will be applied for <span className="font-semibold">Bib {conflict.bib}</span> ({conflict.leaderName} &amp; {conflict.followerName}):
                          </p>
                          <ul className="space-y-1.5 mb-4">
                            {conflict.entryActions.map(ea => {
                              const d = getDecision(conflict.bib, ea.eventId);
                              if (d.action === 'none') return null;
                              return (
                                <li key={ea.eventId} className="text-sm text-gray-700 flex items-start gap-2">
                                  <span className={`mt-0.5 shrink-0 ${d.action === 'remove' ? 'text-red-500' : 'text-blue-500'}`}>
                                    {d.action === 'remove' ? '\u2717' : '\u2192'}
                                  </span>
                                  {d.action === 'remove' ? (
                                    <span>Remove couple from <strong>{ea.eventName}</strong> ({ea.currentLevel})</span>
                                  ) : (
                                    <span>
                                      Move couple from <strong>{ea.eventName}</strong> ({ea.currentLevel})
                                      {' '}to a <strong>{d.targetLevel}</strong> event
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setConfirmingKey(null)}
                              disabled={applying}
                              className="px-4 py-2 bg-gray-200 text-gray-700 rounded border-none cursor-pointer text-sm font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
                            >
                              Back
                            </button>
                            <button
                              onClick={() => handleApply(conflict)}
                              disabled={applying}
                              className="px-4 py-2 bg-danger-500 text-white rounded border-none cursor-pointer text-sm font-medium hover:bg-danger-600 transition-colors disabled:opacity-50"
                            >
                              {applying ? 'Applying...' : 'Apply Changes'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ValidationPage;
