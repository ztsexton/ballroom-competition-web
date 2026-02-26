import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { judgingApi } from '../../../api/client';
import { ActiveHeatInfo, ActiveHeatEntry, Judge } from '../../../types';
import { useCompetitionSSE } from '../../../hooks/useCompetitionSSE';
import { Skeleton } from '../../../components/Skeleton';
import { InputMethod } from './types';
import { formatRound } from './utils';
import JudgeBadge from './components/JudgeBadge';
import InputMethodToggle from './components/InputMethodToggle';
import RecallForm from './components/RecallForm';
import RankingForm from './components/RankingForm';
import TapToRankForm from './components/TapToRankForm';
import PickerRankForm from './components/PickerRankForm';
import ProficiencyForm from './components/ProficiencyForm';
import QuickScoreForm from './components/QuickScoreForm';

const statusCls = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-gray-200 text-gray-600';
    case 'scoring': return 'bg-yellow-100 text-yellow-800';
    case 'completed': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-200 text-gray-600';
  }
};

const JudgeScoringPage = () => {
  const { id } = useParams<{ id: string }>();
  const competitionId = parseInt(id || '0');

  const [judges, setJudges] = useState<Judge[]>([]);
  const [selectedJudgeId, setSelectedJudgeId] = useState<number | null>(null);
  const [heatInfo, setHeatInfo] = useState<ActiveHeatInfo | null>(null);
  // scores[key][bib] = score — key is "eventId" or "eventId:dance"
  const [scores, setScores] = useState<Record<string, Record<number, number>>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [activeDance, setActiveDance] = useState<string | null>(null);
  const [submittedDances, setSubmittedDances] = useState<Set<string>>(new Set());
  const [inputMethod, setInputMethod] = useState<InputMethod>('keyboard');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track which heat we've submitted for and which heat our scores belong to.
  const [submittedHeatKey, setSubmittedHeatKey] = useState<string | null>(null);
  const scoringHeatKeyRef = useRef<string | null>(null);

  const heatKey = heatInfo ? heatInfo.heatId : null;

  // Convenience: first entry (for shared properties like scoringType, isRecallRound)
  const firstEntry = heatInfo?.entries[0] ?? null;
  const isMultiEntry = (heatInfo?.entries.length ?? 0) > 1;

  // Multi-dance support: use server-provided dance list and current dance
  const allDances = heatInfo?.allDances || [];
  const isMultiDance = allDances.length > 0;
  const serverDance = heatInfo?.currentDance || null;
  const currentDanceIndex = activeDance ? allDances.indexOf(activeDance) : 0;

  // --- Fullscreen API ---

  const tryEnterFullscreen = useCallback(() => {
    const el = document.documentElement as any;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  }, []);

  const toggleFullscreen = useCallback(() => {
    const doc = document as any;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      if (doc.exitFullscreen) doc.exitFullscreen();
      else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
    } else {
      tryEnterFullscreen();
    }
  }, [tryEnterFullscreen]);

  useEffect(() => {
    const handler = () => {
      const doc = document as any;
      setIsFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
    };
  }, []);

  // --- localStorage helpers for input method preference ---

  const loadInputMethodPref = useCallback((judgeId: number, scoringType?: string, isRecall?: boolean) => {
    if (isRecall) return; // recall has no toggle
    const mode = scoringType === 'proficiency' ? 'proficiency' : 'ranking';
    const key = `judge-input-pref-${judgeId}-${mode}`;
    const saved = localStorage.getItem(key);
    if (saved === 'tap' || saved === 'picker' || saved === 'quickscore' || saved === 'keyboard') {
      setInputMethod(saved);
    } else {
      setInputMethod(mode === 'proficiency' ? 'quickscore' : 'tap');
    }
  }, []);

  const handleInputMethodChange = (method: InputMethod) => {
    setInputMethod(method);
    if (selectedJudgeId !== null && firstEntry) {
      const mode = firstEntry.scoringType === 'proficiency' ? 'proficiency' : 'ranking';
      const key = `judge-input-pref-${selectedJudgeId}-${mode}`;
      localStorage.setItem(key, method);
    }
  };

  // --- Data loading ---

  const loadJudges = useCallback(async () => {
    if (!competitionId) return;
    try {
      const res = await judgingApi.getJudges(competitionId);
      setJudges(res.data);
    } catch {
      setError('Failed to load judges');
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  const loadActiveHeat = useCallback(async () => {
    if (!competitionId) return;
    try {
      const res = await judgingApi.getActiveHeat(competitionId);
      setHeatInfo(res.data);
      setError('');
    } catch {
      setHeatInfo(null);
    }
  }, [competitionId]);

  useEffect(() => {
    loadJudges();
  }, [loadJudges]);

  useEffect(() => {
    if (selectedJudgeId !== null) {
      loadActiveHeat();
    }
  }, [selectedJudgeId, loadActiveHeat]);

  // Initialize scores only when the heat actually changes (different heatId).
  useEffect(() => {
    if (!heatInfo || !heatKey) return;
    if (heatKey === scoringHeatKeyRef.current) return; // same heat, keep scores

    const initial: Record<string, Record<number, number>> = {};
    let firstDanceName: string | null = null;
    for (const entry of heatInfo.entries) {
      const dances: (string | undefined)[] = entry.dances && entry.dances.length > 1 ? entry.dances : [undefined];
      for (const dance of dances) {
        if (dance && !firstDanceName) firstDanceName = dance;
        const key = dance ? `${entry.eventId}:${dance}` : String(entry.eventId);
        initial[key] = {};
        entry.couples.forEach(c => {
          initial[key][c.bib] = 0;
        });
      }
    }
    setScores(initial);
    // Use server-provided currentDance, fallback to first dance found
    setActiveDance(heatInfo.currentDance || firstDanceName);
    setSubmittedDances(new Set());
    scoringHeatKeyRef.current = heatKey;
    setSubmitting(false);
    setShowConfirm(false);
    setValidationErrors([]);

    // Load saved input method preference for the new heat's scoring type
    if (selectedJudgeId !== null && firstEntry) {
      loadInputMethodPref(selectedJudgeId, firstEntry.scoringType, firstEntry.isRecallRound);
    }
  }, [heatKey, heatInfo, selectedJudgeId, loadInputMethodPref, firstEntry]);

  // When the heat changes (different key), clear the submitted state.
  useEffect(() => {
    if (heatKey && submittedHeatKey && heatKey !== submittedHeatKey) {
      setSubmittedHeatKey(null);
    }
  }, [heatKey, submittedHeatKey]);

  // Sync activeDance from server's currentDance (admin controls which dance is active)
  useEffect(() => {
    if (serverDance && serverDance !== activeDance) {
      setActiveDance(serverDance);
      setValidationErrors([]);
    }
  }, [serverDance]);

  // SSE: refresh heat info on schedule or score updates
  useCompetitionSSE(selectedJudgeId !== null ? competitionId : null, {
    onScheduleUpdate: () => {
      loadActiveHeat();
    },
    onScoreUpdate: () => {
      loadActiveHeat();
    },
  });

  // Derive page state from data
  const isJudgeSelected = selectedJudgeId !== null;
  const isAssigned = heatInfo?.judges.some(j => j.id === selectedJudgeId) ?? false;
  const isScoring = heatInfo?.status === 'scoring';
  const isSubmitted = submittedHeatKey !== null && submittedHeatKey === heatKey;
  const canScore = isJudgeSelected && isScoring && isAssigned && !isSubmitted;

  const selectedJudge = judges.find(j => j.id === selectedJudgeId);

  // --- Handlers ---

  const handleToggleRecall = (key: string, bib: number) => {
    setScores(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [bib]: prev[key]?.[bib] === 1 ? 0 : 1,
      },
    }));
  };

  const handleRankChange = (key: string, bib: number, value: string) => {
    const rank = parseInt(value);
    if (value === '') {
      setScores(prev => ({ ...prev, [key]: { ...prev[key], [bib]: 0 } }));
    } else if (!isNaN(rank) && rank >= 1) {
      setScores(prev => ({ ...prev, [key]: { ...prev[key], [bib]: rank } }));
    }
  };

  const handleProficiencyChange = (key: string, bib: number, value: string) => {
    const num = parseInt(value) || 0;
    setScores(prev => ({
      ...prev,
      [key]: { ...prev[key], [bib]: Math.min(100, Math.max(0, num)) },
    }));
  };

  const handleScoresBatch = (key: string, newScores: Record<number, number>) => {
    setScores(prev => ({ ...prev, [key]: newScores }));
  };

  // --- Validation ---

  const validate = (): string[] => {
    if (!heatInfo) return ['No active heat'];
    const errors: string[] = [];

    for (const entry of heatInfo.entries) {
      const dances: (string | undefined)[] = entry.dances && entry.dances.length > 1 ? entry.dances : [undefined];
      for (const dance of dances) {
        const key = dance ? `${entry.eventId}:${dance}` : String(entry.eventId);
        const entryScores = scores[key] || {};
        const coupleCount = entry.couples.length;
        const isProficiency = entry.scoringType === 'proficiency';
        const prefix = isMultiEntry
          ? `${entry.eventName}${dance ? ` (${dance})` : ''}: `
          : dance ? `${dance}: ` : '';

        if (isProficiency) {
          const missing = entry.couples.filter(c => entryScores[c.bib] === undefined || entryScores[c.bib] === 0);
          if (missing.length > 0) {
            errors.push(`${prefix}Enter a score for: ${missing.map(c => `#${c.bib}`).join(', ')}`);
          }
        } else if (entry.isRecallRound) {
          // Recall: no strict validation — 0 recalls is technically valid
        } else {
          // Final ranking: unique ranks 1..N
          const ranks = entry.couples.map(c => entryScores[c.bib]);
          const missing = entry.couples.filter(c => !entryScores[c.bib] || entryScores[c.bib] < 1 || entryScores[c.bib] > coupleCount);
          if (missing.length > 0) {
            errors.push(`${prefix}Rank must be 1-${coupleCount} for: ${missing.map(c => `#${c.bib}`).join(', ')}`);
          }

          const seen = new Set<number>();
          const dupes = new Set<number>();
          for (const r of ranks) {
            if (r >= 1 && r <= coupleCount) {
              if (seen.has(r)) dupes.add(r);
              seen.add(r);
            }
          }
          if (dupes.size > 0) {
            errors.push(`${prefix}Duplicate rank(s): ${[...dupes].sort((a, b) => a - b).join(', ')}`);
          }
        }
      }
    }
    return errors;
  };

  // Validate a single dance (for per-dance "Next" navigation)
  const validateForDance = (targetDance: string): string[] => {
    if (!heatInfo) return [];
    const errors: string[] = [];
    for (const entry of heatInfo.entries) {
      if (!entry.dances?.includes(targetDance)) continue;
      const key = `${entry.eventId}:${targetDance}`;
      const entryScores = scores[key] || {};
      const coupleCount = entry.couples.length;
      const isProfEntry = entry.scoringType === 'proficiency';
      const prefix = isMultiEntry ? `${entry.eventName} (${targetDance}): ` : `${targetDance}: `;

      if (isProfEntry) {
        const missing = entry.couples.filter(c => entryScores[c.bib] === undefined || entryScores[c.bib] === 0);
        if (missing.length > 0) {
          errors.push(`${prefix}Enter a score for: ${missing.map(c => `#${c.bib}`).join(', ')}`);
        }
      } else if (entry.isRecallRound) {
        // Recall: no strict validation
      } else {
        const missing = entry.couples.filter(c => !entryScores[c.bib] || entryScores[c.bib] < 1 || entryScores[c.bib] > coupleCount);
        if (missing.length > 0) {
          errors.push(`${prefix}Rank must be 1-${coupleCount} for: ${missing.map(c => `#${c.bib}`).join(', ')}`);
        }
        const seen = new Set<number>();
        const dupes = new Set<number>();
        for (const r of entry.couples.map(c => entryScores[c.bib])) {
          if (r >= 1 && r <= coupleCount) {
            if (seen.has(r)) dupes.add(r);
            seen.add(r);
          }
        }
        if (dupes.size > 0) {
          errors.push(`${prefix}Duplicate rank(s): ${[...dupes].sort((a, b) => a - b).join(', ')}`);
        }
      }
    }
    return errors;
  };

  const handleSubmitClick = () => {
    // For multi-dance, validate only the active dance
    const errors = isMultiDance && activeDance
      ? validateForDance(activeDance)
      : validate();
    setValidationErrors(errors);
    if (errors.length > 0) return;
    setShowConfirm(true);
  };

  const handleConfirmSubmit = async () => {
    if (!heatInfo || selectedJudgeId === null || !heatKey) return;

    setSubmitting(true);
    setError('');
    setShowConfirm(false);
    try {
      if (isMultiDance && activeDance) {
        // Per-dance submission: submit only the active dance
        for (const entry of heatInfo.entries) {
          if (!entry.dances?.includes(activeDance)) continue;
          const key = `${entry.eventId}:${activeDance}`;
          const entryScores = scores[key] || {};
          const scoreArray = Object.entries(entryScores).map(([bib, score]) => ({
            bib: parseInt(bib),
            score,
          }));
          await judgingApi.submitJudgeScores(
            competitionId,
            selectedJudgeId,
            entry.eventId,
            entry.round,
            scoreArray,
            activeDance,
          );
        }

        // Mark this dance as submitted and wait for admin to advance
        const updated = new Set(submittedDances);
        updated.add(activeDance);
        setSubmittedDances(updated);
        setValidationErrors([]);
      } else {
        // Single-dance: submit all entries at once
        for (const entry of heatInfo.entries) {
          const key = String(entry.eventId);
          const entryScores = scores[key] || {};
          const scoreArray = Object.entries(entryScores).map(([bib, score]) => ({
            bib: parseInt(bib),
            score,
          }));
          await judgingApi.submitJudgeScores(
            competitionId,
            selectedJudgeId,
            entry.eventId,
            entry.round,
            scoreArray,
          );
        }
        setSubmittedHeatKey(heatKey);
        setValidationErrors([]);
      }
    } catch {
      setError('Failed to submit scores. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectJudge = (judgeId: number) => {
    setSelectedJudgeId(judgeId);
    setSubmittedHeatKey(null);
    scoringHeatKeyRef.current = null;
    tryEnterFullscreen();
  };

  const handleChangeJudge = () => {
    setSelectedJudgeId(null);
    setSubmittedHeatKey(null);
    scoringHeatKeyRef.current = null;
    setHeatInfo(null);
    setScores({});
    setActiveDance(null);
    setSubmittedDances(new Set());
    setShowConfirm(false);
    setValidationErrors([]);
  };

  // --- Status display helpers ---

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'scoring': return 'Scoring';
      case 'completed': return 'Completed';
      default: return status;
    }
  };

  if (loading) return <Skeleton variant="card" />;

  // ==================== JUDGE SELECTION ====================
  if (!isJudgeSelected) {
    return (
      <div className="max-w-[540px] mx-auto p-2">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <h2 className="mb-2">Judge Scoring</h2>
          <p className="text-gray-500 mb-6">
            Select your judge identity to begin.
          </p>
          <div className="flex flex-col gap-3">
            {judges.map(judge => (
              <button
                key={judge.id}
                onClick={() => handleSelectJudge(judge.id)}
                className="flex items-center gap-3 p-4 px-5 bg-white border-2 border-gray-200 rounded-lg cursor-pointer transition-all duration-150 text-left text-base touch-manipulation [-webkit-tap-highlight-color:transparent] select-none min-h-[44px] hover:border-primary-500 hover:bg-gray-50"
              >
                <span className={`w-10 h-10 rounded-full ${judge.isChairman ? 'bg-yellow-500' : 'bg-primary-500'} text-white flex items-center justify-center font-bold text-base shrink-0`}>
                  {judge.judgeNumber}
                </span>
                <span className="font-medium text-lg">
                  {judge.name}
                  {judge.isChairman && <span className="text-yellow-500 ml-2 text-sm">{'\u2605'} Chairman</span>}
                </span>
              </button>
            ))}
            {judges.length === 0 && (
              <p className="text-gray-400">No judges found for this competition.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==================== SUBMITTED ====================
  if (isSubmitted) {
    return (
      <div className="max-w-[540px] mx-auto p-2">
        <div className="text-center mb-4">
          <JudgeBadge judge={selectedJudge!} />
        </div>

        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="w-[72px] h-[72px] rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4 text-3xl text-green-800">
            ✓
          </div>

          <h2 className="text-green-800 mb-2">Scores Submitted</h2>
          {heatInfo && (
            <>
              <p className="text-gray-400 mb-1 text-[0.8rem]">
                Heat {heatInfo.heatNumber} of {heatInfo.totalHeats}
              </p>
              {heatInfo.entries.map(entry => (
                <p key={entry.eventId} className="text-gray-500 mb-1">
                  {entry.eventName} — {formatRound(entry.round)}
                </p>
              ))}
            </>
          )}
          <p className="text-gray-400 text-sm mt-2">
            Waiting for the next heat...
          </p>
        </div>

        <div className="text-center mt-4">
          <button
            onClick={handleChangeJudge}
            className="py-3 px-5 bg-transparent border border-gray-300 rounded-md text-gray-500 cursor-pointer text-sm touch-manipulation min-h-[44px] select-none [-webkit-tap-highlight-color:transparent]"
          >
            Change Judge
          </button>
        </div>
      </div>
    );
  }

  // ==================== WAITING ====================
  if (!canScore) {
    return (
      <div className="max-w-[540px] mx-auto p-2">
        <div className="text-center mb-4">
          <JudgeBadge judge={selectedJudge!} />
        </div>

        <div className="bg-white rounded-lg shadow p-6 text-center">
          <h2 className="mb-4">Waiting</h2>

          {!heatInfo ? (
            <div>
              <div className="text-3xl mb-2 text-gray-400">...</div>
              <p className="text-gray-400">No active heat. Waiting for the competition to begin.</p>
            </div>
          ) : heatInfo.isBreak ? (
            <div>
              <p className="text-gray-400 mb-2 text-[0.8rem]">
                Heat {heatInfo.heatNumber} of {heatInfo.totalHeats}
              </p>
              <div className="p-4 bg-yellow-50 rounded-lg mb-3">
                <p className="text-lg font-semibold mb-1">
                  {heatInfo.breakLabel || 'Break'}
                </p>
                {heatInfo.breakDuration && (
                  <p className="text-gray-500 m-0">{heatInfo.breakDuration} minutes</p>
                )}
              </div>
              <p className="text-gray-500 text-sm">Scoring will resume after the break.</p>
            </div>
          ) : (
            <div>
              <p className="text-gray-400 mb-2 text-[0.8rem]">
                Heat {heatInfo.heatNumber} of {heatInfo.totalHeats}
              </p>
              <div className="p-4 bg-gray-50 rounded-lg mb-3">
                {heatInfo.entries.map(entry => (
                  <div key={entry.eventId} className="mb-1">
                    <p className="text-lg font-semibold mb-0.5">
                      {entry.eventName}
                    </p>
                    <p className="text-gray-600 m-0 capitalize">
                      {formatRound(entry.round)}
                    </p>
                  </div>
                ))}
                <div className="mt-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold uppercase ${statusCls(heatInfo.status)}`}>
                    {statusLabel(heatInfo.status)}
                  </span>
                </div>
              </div>

              {heatInfo.status === 'scoring' && !isAssigned && (
                <p className="text-red-500 text-sm font-medium">
                  You are not assigned to judge this heat.
                </p>
              )}
              {heatInfo.status !== 'scoring' && isAssigned && (
                <p className="text-primary-500 text-sm font-medium">
                  You are assigned to this heat. Scoring will begin soon.
                </p>
              )}
              {heatInfo.status !== 'scoring' && !isAssigned && (
                <p className="text-gray-500 text-sm">
                  Waiting for this heat to enter scoring.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="text-center mt-4">
          <button
            onClick={handleChangeJudge}
            className="py-3 px-5 bg-transparent border border-gray-300 rounded-md text-gray-500 cursor-pointer text-sm touch-manipulation min-h-[44px] select-none [-webkit-tap-highlight-color:transparent]"
          >
            Change Judge
          </button>
        </div>
      </div>
    );
  }

  // ==================== SCORING ====================

  const renderEntryForm = (entry: ActiveHeatEntry, dance?: string) => {
    const key = dance ? `${entry.eventId}:${dance}` : String(entry.eventId);
    const entryScores = scores[key] || {};
    const isProficiency = entry.scoringType === 'proficiency';
    const isRecall = entry.isRecallRound;
    const proAm = entry.designation === 'Pro-Am';

    if (isProficiency) {
      return inputMethod === 'quickscore' ? (
        <QuickScoreForm
          couples={entry.couples}
          scores={entryScores}
          onChange={(bib, value) => handleProficiencyChange(key, bib, value)}
          isProAm={proAm}
        />
      ) : (
        <ProficiencyForm
          couples={entry.couples}
          scores={entryScores}
          onChange={(bib, value) => handleProficiencyChange(key, bib, value)}
          isProAm={proAm}
        />
      );
    }

    if (isRecall) {
      return (
        <RecallForm
          couples={entry.couples}
          scores={entryScores}
          onToggle={(bib) => handleToggleRecall(key, bib)}
          isProAm={proAm}
          maxRecalls={entry.recallCount}
        />
      );
    }

    if (inputMethod === 'tap') {
      return (
        <TapToRankForm
          couples={entry.couples}
          scores={entryScores}
          onScoresChange={(newScores) => handleScoresBatch(key, newScores)}
          isProAm={proAm}
        />
      );
    }

    if (inputMethod === 'picker') {
      return (
        <PickerRankForm
          couples={entry.couples}
          scores={entryScores}
          onScoresChange={(newScores) => handleScoresBatch(key, newScores)}
          isProAm={proAm}
        />
      );
    }

    return (
      <RankingForm
        couples={entry.couples}
        scores={entryScores}
        onChange={(bib, value) => handleRankChange(key, bib, value)}
        isProAm={proAm}
      />
    );
  };

  // All entries share same scoringType/isRecallRound (merge criterion)
  const isRecall = firstEntry?.isRecallRound ?? false;
  const isProficiency = firstEntry?.scoringType === 'proficiency';

  return (
    <div className="max-w-[540px] mx-auto p-2">
      {error && (
        <div className="px-3 py-2 bg-red-100 text-red-800 rounded-md mb-2 font-medium text-sm">
          {error}
        </div>
      )}

      {/* Compact header: judge identity + heat counter + controls */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-primary-500 rounded-lg mb-2 text-white">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">
            J{selectedJudge!.judgeNumber} {selectedJudge!.name}
          </span>
          <button
            onClick={handleChangeJudge}
            className="bg-transparent border-none text-white/60 text-[0.6875rem] cursor-pointer p-0 underline touch-manipulation select-none [-webkit-tap-highlight-color:transparent]"
          >
            change
          </button>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-white/80">
            Heat {heatInfo!.heatNumber}/{heatInfo!.totalHeats}
          </span>
          <button
            onClick={toggleFullscreen}
            className="bg-transparent border-none text-white/70 text-xs cursor-pointer p-0 touch-manipulation leading-none select-none [-webkit-tap-highlight-color:transparent]"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? '⊗' : '⛶'}
          </button>
        </div>
      </div>

      {/* Input method toggle (not for recall) */}
      {!isRecall && (
        <InputMethodToggle
          mode={isProficiency ? 'proficiency' : 'ranking'}
          selectedMethod={inputMethod}
          onMethodChange={handleInputMethodChange}
        />
      )}

      {/* Current dance indicator for multi-dance events (read-only, admin-controlled) */}
      {isMultiDance && activeDance && (() => {
        const danceSubmitted = submittedDances.has(activeDance);
        return (
          <div
            className="mb-2 rounded-lg overflow-hidden"
            style={{ border: `2px solid ${danceSubmitted ? '#48bb78' : '#667eea'}` }}
          >
            <div
              className="px-3 py-1.5 text-center"
              style={{ background: danceSubmitted ? '#48bb78' : '#667eea' }}
            >
              <p className="m-0 font-bold text-lg text-white">
                {danceSubmitted ? '✓ ' : ''}{activeDance}
              </p>
              <p className="m-0 text-[0.6875rem] text-white/85 font-medium">
                {danceSubmitted ? 'Submitted — waiting for next dance' : `Now Scoring — Dance ${currentDanceIndex + 1} of ${allDances.length}`}
              </p>
            </div>

            {allDances.length > 1 && (
              <div
                className="flex items-center justify-center gap-1 px-2 py-[0.3125rem]"
                style={{ background: danceSubmitted ? '#f0fff4' : '#eef2ff' }}
              >
                {allDances.map((d, i) => {
                  const isThisDance = d === activeDance;
                  const isSubmitted = submittedDances.has(d);
                  return (
                    <div key={d} className="flex items-center gap-1">
                      <div
                        className="flex items-center justify-center text-[0.6875rem] font-bold text-white"
                        style={{
                          minWidth: isThisDance ? undefined : '8px',
                          height: isThisDance ? '22px' : '8px',
                          padding: isThisDance ? '0 0.5rem' : 0,
                          borderRadius: isThisDance ? '11px' : '50%',
                          background: isSubmitted ? '#48bb78' : isThisDance ? '#667eea' : '#cbd5e0',
                        }}
                      >
                        {isThisDance ? d : ''}
                      </div>
                      {i < allDances.length - 1 && (
                        <div
                          className="w-3 h-0.5"
                          style={{ background: isSubmitted ? '#48bb78' : '#cbd5e0' }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Scoring forms — one per entry (filtered by active dance if multi-dance) */}
      <div className="bg-white rounded-lg shadow p-6">
        {/* When current dance is already submitted, show a waiting message instead of the form */}
        {isMultiDance && activeDance && submittedDances.has(activeDance) ? (
          <div className="text-center py-8 px-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3 text-2xl text-green-800">
              ✓
            </div>
            <p className="font-bold text-lg text-green-800 mb-1">
              {activeDance} Scores Submitted
            </p>
            <p className="text-gray-500 text-sm m-0">
              Waiting for the competition director to advance to the next dance.
            </p>
          </div>
        ) : (isMultiDance && activeDance
          ? heatInfo!.entries.filter(e => e.dances?.includes(activeDance))
          : heatInfo!.entries
        ).map((entry, idx, arr) => (
          <div key={isMultiDance ? `${entry.eventId}:${activeDance}` : entry.eventId}>
            {/* Section header for multi-entry heats */}
            {isMultiEntry && (
              <div className="py-2 mb-2 border-b-2 border-primary-500">
                <p className="m-0 font-bold text-primary-500 text-base">
                  {entry.eventName}
                </p>
                <p className="mt-0.5 mb-0 text-gray-500 text-[0.8rem]">
                  {formatRound(entry.round)} — {entry.couples.length} couples
                </p>
              </div>
            )}

            {renderEntryForm(entry, isMultiDance ? activeDance! : undefined)}

            {/* Divider between entries */}
            {isMultiEntry && idx < arr.length - 1 && (
              <hr className="border-none border-t-2 border-dashed border-gray-200 my-6" />
            )}
          </div>
        ))}

        {/* Validation errors, confirm overlay, and submit button — hidden when in dance-submitted waiting state */}
        {!(isMultiDance && activeDance && submittedDances.has(activeDance)) && (<>
          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="px-4 py-3 bg-red-100 rounded-md mt-4">
              {validationErrors.map((err, i) => (
                <p key={i} className={`text-red-800 text-sm ${i > 0 ? 'mt-1' : 'm-0'}`}>
                  {err}
                </p>
              ))}
            </div>
          )}

          {/* Confirmation overlay */}
          {showConfirm && (
            <div className="p-3 bg-blue-50 border-2 border-blue-200 rounded-lg mt-3 text-center">
              <p className="font-semibold mb-2 text-blue-900 text-[0.9375rem]">
                Submit {isMultiDance && activeDance ? `${activeDance} scores` : 'scores'}{isMultiEntry ? ` across ${heatInfo!.entries.length} events` : ''}?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={submitting}
                  className="flex-1 p-2.5 min-h-[44px] bg-white text-gray-600 border border-gray-300 rounded-md text-[0.9375rem] cursor-pointer touch-manipulation select-none [-webkit-tap-highlight-color:transparent]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSubmit}
                  disabled={submitting}
                  className={`flex-1 p-2.5 min-h-[44px] bg-success-500 text-white border-none rounded-md text-[0.9375rem] font-bold touch-manipulation select-none [-webkit-tap-highlight-color:transparent] ${submitting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer opacity-100'}`}
                >
                  {submitting ? 'Submitting...' : 'Confirm'}
                </button>
              </div>
            </div>
          )}

          {/* Submit button */}
          {!showConfirm && (
            <button
              onClick={handleSubmitClick}
              disabled={submitting}
              className={`w-full mt-3 p-3 min-h-[48px] bg-success-500 text-white border-none rounded-lg text-lg font-bold transition-opacity duration-150 touch-manipulation select-none [-webkit-tap-highlight-color:transparent] ${submitting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer opacity-100'}`}
            >
              {submitting ? 'Submitting...' : isMultiDance && activeDance ? `Submit ${activeDance}` : isMultiEntry ? 'Submit All Scores' : 'Submit Scores'}
            </button>
          )}
        </>)}
      </div>

    </div>
  );
};

export default JudgeScoringPage;
