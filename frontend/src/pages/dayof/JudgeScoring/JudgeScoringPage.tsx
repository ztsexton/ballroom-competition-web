import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { judgingApi } from '../../../api/client';
import { ActiveHeatInfo, ActiveHeatEntry, Judge } from '../../../types';
import { useCompetitionSSE } from '../../../hooks/useCompetitionSSE';
import { Skeleton } from '../../../components/Skeleton';
import { InputMethod } from './types';
import { formatRound } from './utils';
import InputMethodToggle from './components/InputMethodToggle';
import RecallForm from './components/RecallForm';
import RankingForm from './components/RankingForm';
import TapToRankForm from './components/TapToRankForm';
import PickerRankForm from './components/PickerRankForm';
import ProficiencyForm from './components/ProficiencyForm';
import QuickScoreForm from './components/QuickScoreForm';
import JudgeSelectionCard from './components/JudgeSelectionCard';
import SubmittedCard from './components/SubmittedCard';
import WaitingCard from './components/WaitingCard';
import ScoringHeader from './components/ScoringHeader';
import DanceProgressIndicator from './components/DanceProgressIndicator';
import SubmissionPanel from './components/SubmissionPanel';

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
  const [inputMethods, setInputMethods] = useState<Record<string, InputMethod>>({
    ranking: 'keyboard',
    proficiency: 'keyboard',
  });
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
      setInputMethods(prev => ({ ...prev, [mode]: saved }));
    } else {
      setInputMethods(prev => ({ ...prev, [mode]: mode === 'proficiency' ? 'quickscore' : 'tap' }));
    }
  }, []);

  const handleInputMethodChange = (mode: string, method: InputMethod) => {
    setInputMethods(prev => ({ ...prev, [mode]: method }));
    if (selectedJudgeId !== null) {
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

    // Load saved input method preferences for all scoring types in the heat
    if (selectedJudgeId !== null && heatInfo) {
      const scoringTypes = new Set(heatInfo.entries.map(e => e.scoringType || 'standard'));
      for (const st of scoringTypes) {
        loadInputMethodPref(selectedJudgeId, st, heatInfo.entries[0]?.isRecallRound);
      }
    }
  }, [heatKey, heatInfo, selectedJudgeId, loadInputMethodPref]);

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

  if (loading) return <Skeleton variant="card" />;

  if (!isJudgeSelected) {
    return <JudgeSelectionCard judges={judges} onSelectJudge={handleSelectJudge} />;
  }

  if (isSubmitted) {
    return <SubmittedCard judge={selectedJudge!} heatInfo={heatInfo} onChangeJudge={handleChangeJudge} />;
  }

  if (!canScore) {
    return <WaitingCard judge={selectedJudge!} heatInfo={heatInfo} isAssigned={isAssigned} onChangeJudge={handleChangeJudge} />;
  }

  // ==================== SCORING ====================

  const renderEntryForm = (entry: ActiveHeatEntry, dance?: string) => {
    const key = dance ? `${entry.eventId}:${dance}` : String(entry.eventId);
    const entryScores = scores[key] || {};
    const isProficiency = entry.scoringType === 'proficiency';
    const isRecall = entry.isRecallRound;
    const proAm = entry.designation === 'Pro-Am';
    const currentInputMethod = isProficiency ? inputMethods.proficiency : inputMethods.ranking;

    if (isProficiency) {
      return currentInputMethod === 'quickscore' ? (
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

    if (currentInputMethod === 'tap') {
      return (
        <TapToRankForm
          couples={entry.couples}
          scores={entryScores}
          onScoresChange={(newScores) => handleScoresBatch(key, newScores)}
          isProAm={proAm}
        />
      );
    }

    if (currentInputMethod === 'picker') {
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

  // Detect mixed scoring types in the heat
  const isRecall = firstEntry?.isRecallRound ?? false;
  const isProficiency = firstEntry?.scoringType === 'proficiency';
  const scoringTypes = new Set(heatInfo!.entries.map(e => e.scoringType || 'standard'));
  const hasMixedTypes = scoringTypes.size > 1;

  return (
    <div className="max-w-[540px] mx-auto p-2">
      {error && (
        <div className="px-3 py-2 bg-red-100 text-red-800 rounded-md mb-2 font-medium text-sm">
          {error}
        </div>
      )}

      <ScoringHeader
        judge={selectedJudge!}
        heatNumber={heatInfo!.heatNumber}
        totalHeats={heatInfo!.totalHeats}
        isFullscreen={isFullscreen}
        onChangeJudge={handleChangeJudge}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* Input method toggle(s) — per scoring type when mixed */}
      {!isRecall && hasMixedTypes ? (
        <div className="mb-2">
          {scoringTypes.has('standard') && (
            <div className="mb-1">
              <span className="text-xs text-gray-500 font-medium mr-1">Ranking events:</span>
              <InputMethodToggle
                mode="ranking"
                selectedMethod={inputMethods.ranking}
                onMethodChange={(m) => handleInputMethodChange('ranking', m)}
              />
            </div>
          )}
          {scoringTypes.has('proficiency') && (
            <div className="mb-1">
              <span className="text-xs text-gray-500 font-medium mr-1">Proficiency events:</span>
              <InputMethodToggle
                mode="proficiency"
                selectedMethod={inputMethods.proficiency}
                onMethodChange={(m) => handleInputMethodChange('proficiency', m)}
              />
            </div>
          )}
        </div>
      ) : !isRecall && (
        <InputMethodToggle
          mode={isProficiency ? 'proficiency' : 'ranking'}
          selectedMethod={inputMethods[isProficiency ? 'proficiency' : 'ranking']}
          onMethodChange={(m) => handleInputMethodChange(isProficiency ? 'proficiency' : 'ranking', m)}
        />
      )}

      {isMultiDance && activeDance && (
        <DanceProgressIndicator
          activeDance={activeDance}
          allDances={allDances}
          submittedDances={submittedDances}
          currentDanceIndex={currentDanceIndex}
        />
      )}

      {/* Scoring forms — one per entry (filtered by active dance if multi-dance) */}
      <div className="bg-white rounded-lg shadow px-3 py-3">
        {/* When current dance is already submitted, show a waiting message instead of the form */}
        {isMultiDance && activeDance && submittedDances.has(activeDance) ? (
          <div className="text-center py-6 px-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2 text-xl text-green-800">
              ✓
            </div>
            <p className="font-bold text-base text-green-800 mb-1">
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
              <div className="py-1 mb-1.5 border-b-2 border-primary-500">
                <p className="m-0 font-bold text-primary-500 text-sm leading-tight">
                  {entry.eventName}
                  {hasMixedTypes && (
                    <span className={`ml-1.5 px-1 py-0.5 rounded text-[0.625rem] font-semibold ${
                      entry.scoringType === 'proficiency' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {entry.scoringType === 'proficiency' ? 'Prof' : 'Rank'}
                    </span>
                  )}
                  <span className="text-gray-400 font-normal text-xs ml-1.5">
                    {formatRound(entry.round)} — {entry.couples.length}
                  </span>
                </p>
              </div>
            )}

            {renderEntryForm(entry, isMultiDance ? activeDance! : undefined)}

            {/* Divider between entries */}
            {isMultiEntry && idx < arr.length - 1 && (
              <hr className="border-none border-t-2 border-dashed border-gray-200 my-3" />
            )}
          </div>
        ))}

        {!(isMultiDance && activeDance && submittedDances.has(activeDance)) && (
          <SubmissionPanel
            validationErrors={validationErrors}
            showConfirm={showConfirm}
            submitting={submitting}
            isMultiDance={isMultiDance}
            isMultiEntry={isMultiEntry}
            activeDance={activeDance}
            entryCount={heatInfo!.entries.length}
            onSubmitClick={handleSubmitClick}
            onConfirmSubmit={handleConfirmSubmit}
            onCancelConfirm={() => setShowConfirm(false)}
          />
        )}
      </div>

    </div>
  );
};

export default JudgeScoringPage;
