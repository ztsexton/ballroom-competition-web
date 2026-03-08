import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { competitionsApi } from '../../api/client';
import { useCompetition } from '../../context/CompetitionContext';
import { useToast } from '../../context/ToastContext';
import { Skeleton } from '../../components/Skeleton';

interface ResolutionAction {
  eventId: number;
  eventName: string;
  currentLevel: string;
  action: 'remove' | 'move';
  targetLevel?: string;
}

interface Resolution {
  id: string;
  type: 'remove' | 'move';
  description: string;
  actions: ResolutionAction[];
}

interface CoupleConflict {
  bib: number;
  leaderName: string;
  followerName: string;
  entries: Array<{ eventId: number; eventName: string; level: string }>;
  currentRange: string;
  allowedRange: string[];
  outOfRangeEntries: Array<{ eventId: number; eventName: string; level: string; reason: string }>;
  suggestedResolutions: Resolution[];
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

const ValidationPage = () => {
  const { id } = useParams<{ id: string }>();
  const competitionId = parseInt(id || '0');
  const { activeCompetition, refreshCompetitions } = useCompetition();
  const { showToast } = useToast();

  const [conflicts, setConflicts] = useState<CoupleConflict[]>([]);
  const [pendingEntries, setPendingEntries] = useState<PendingEntryEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBib, setExpandedBib] = useState<number | null>(null);
  const [selectedResolution, setSelectedResolution] = useState<{ bib: number; resolution: Resolution } | null>(null);
  const [confirmingResolution, setConfirmingResolution] = useState<{ bib: number; resolution: Resolution } | null>(null);
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
    } catch {
      showToast('Failed to load validation data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectResolution = (bib: number, resolution: Resolution) => {
    setSelectedResolution({ bib, resolution });
    setConfirmingResolution(null);
  };

  const handleConfirmStep = () => {
    if (selectedResolution) {
      setConfirmingResolution(selectedResolution);
    }
  };

  const handleApplyResolution = async () => {
    if (!confirmingResolution) return;
    setApplying(true);
    try {
      const { bib, resolution } = confirmingResolution;
      const actions = resolution.actions.map(a => ({
        eventId: a.eventId,
        action: a.action,
        bib,
        targetLevel: a.targetLevel,
      }));
      const res = await competitionsApi.applyResolution(competitionId, actions);
      if (res.data.allSuccess) {
        showToast('Resolution applied successfully', 'success');
      } else {
        const failures = res.data.results.filter(r => !r.success);
        showToast(`${failures.length} action(s) failed: ${failures.map(f => f.error).join(', ')}`, 'error');
      }
      setSelectedResolution(null);
      setConfirmingResolution(null);
      setExpandedBib(null);
      await refreshCompetitions();
      await loadData();
    } catch {
      showToast('Failed to apply resolution', 'error');
    } finally {
      setApplying(false);
    }
  };

  const handleCancelConfirm = () => {
    setConfirmingResolution(null);
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
          Review level conflicts and pending entry approvals. Levels are inferred from each couple's existing event entries.
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
            These couples have entries spanning levels that are outside the competition's allowed range.
            Expand each to see suggested resolutions.
          </p>
          <div className="space-y-3">
            {conflicts.map(conflict => {
              const isExpanded = expandedBib === conflict.bib;
              const selected = selectedResolution?.bib === conflict.bib ? selectedResolution.resolution : null;
              const confirming = confirmingResolution?.bib === conflict.bib ? confirmingResolution.resolution : null;

              return (
                <div key={conflict.bib} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                  {/* Conflict header — always visible */}
                  <button
                    onClick={() => {
                      setExpandedBib(isExpanded ? null : conflict.bib);
                      if (isExpanded) {
                        setSelectedResolution(null);
                        setConfirmingResolution(null);
                      }
                    }}
                    className="w-full flex items-center justify-between px-5 py-4 text-left bg-transparent border-none cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-bold shrink-0">
                        {conflict.bib}
                      </span>
                      <div>
                        <div className="font-semibold text-gray-800">
                          {conflict.leaderName} &amp; {conflict.followerName}
                        </div>
                        <div className="text-sm text-gray-500 mt-0.5">
                          {conflict.outOfRangeEntries.length} out-of-range entr{conflict.outOfRangeEntries.length === 1 ? 'y' : 'ies'}
                          <span className="text-gray-400 mx-1.5">&middot;</span>
                          Range: {conflict.currentRange}
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
                      <div className="mb-4">
                        <h4 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Current Entries</h4>
                        <div className="flex flex-wrap gap-2">
                          {conflict.entries.map((entry, i) => {
                            const isOutOfRange = conflict.outOfRangeEntries.some(e => e.eventId === entry.eventId);
                            return (
                              <span
                                key={i}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium ${
                                  isOutOfRange
                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${isOutOfRange ? 'bg-red-400' : 'bg-green-400'}`} />
                                {entry.level}: {entry.eventName}
                              </span>
                            );
                          })}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Allowed range: <span className="font-medium">{conflict.allowedRange.join(', ')}</span>
                        </p>
                      </div>

                      {/* Suggested resolutions */}
                      <div className="mb-4">
                        <h4 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Suggested Resolutions</h4>
                        <div className="space-y-2">
                          {conflict.suggestedResolutions.map(resolution => {
                            const isSelected = selected?.id === resolution.id;
                            return (
                              <button
                                key={resolution.id}
                                onClick={() => handleSelectResolution(conflict.bib, resolution)}
                                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors cursor-pointer bg-transparent ${
                                  isSelected
                                    ? 'border-primary-500 bg-primary-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                    isSelected ? 'border-primary-500' : 'border-gray-300'
                                  }`}>
                                    {isSelected && <span className="w-2 h-2 rounded-full bg-primary-500" />}
                                  </span>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-800">{resolution.description}</p>
                                    <div className="mt-2 space-y-1">
                                      {resolution.actions.map((action, ai) => (
                                        <div key={ai} className="text-xs text-gray-600 flex items-center gap-1.5">
                                          {action.action === 'remove' ? (
                                            <>
                                              <span className="text-red-500 font-bold">&times;</span>
                                              Remove from <span className="font-medium">{action.eventName}</span>
                                            </>
                                          ) : (
                                            <>
                                              <span className="text-blue-500 font-bold">&rarr;</span>
                                              Move <span className="font-medium">{action.eventName}</span>
                                              {' '}from {action.currentLevel} to <span className="font-medium">{action.targetLevel}</span>
                                            </>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Action buttons */}
                      {selected && !confirming && (
                        <div className="flex justify-end">
                          <button
                            onClick={handleConfirmStep}
                            className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium hover:bg-primary-600 transition-colors"
                          >
                            Review &amp; Confirm
                          </button>
                        </div>
                      )}

                      {/* Confirmation panel */}
                      {confirming && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-amber-800 mb-2">Confirm Resolution</h4>
                          <p className="text-sm text-amber-700 mb-3">
                            The following changes will be made for <span className="font-semibold">Bib {conflict.bib}</span> ({conflict.leaderName} &amp; {conflict.followerName}):
                          </p>
                          <ul className="space-y-1.5 mb-4">
                            {confirming.actions.map((action, i) => (
                              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                <span className={`mt-0.5 shrink-0 ${action.action === 'remove' ? 'text-red-500' : 'text-blue-500'}`}>
                                  {action.action === 'remove' ? '\u2717' : '\u2192'}
                                </span>
                                {action.action === 'remove' ? (
                                  <span>Remove couple from <strong>{action.eventName}</strong> ({action.currentLevel})</span>
                                ) : (
                                  <span>
                                    Move couple from <strong>{action.eventName}</strong> ({action.currentLevel})
                                    {' '}to a <strong>{action.targetLevel}</strong> event
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={handleCancelConfirm}
                              disabled={applying}
                              className="px-4 py-2 bg-gray-200 text-gray-700 rounded border-none cursor-pointer text-sm font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
                            >
                              Back
                            </button>
                            <button
                              onClick={handleApplyResolution}
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
