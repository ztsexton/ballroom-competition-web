import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { judgingApi } from '../../api/client';
import { ActiveHeatInfo, ActiveHeatEntry, Judge } from '../../types';
import { useCompetitionSSE } from '../../hooks/useCompetitionSSE';
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

  const statusColor = (status: string) => {
    switch (status) {
      case 'pending': return { bg: '#e2e8f0', text: '#4a5568' };
      case 'scoring': return { bg: '#fefcbf', text: '#744210' };
      case 'completed': return { bg: '#c6f6d5', text: '#276749' };
      default: return { bg: '#e2e8f0', text: '#4a5568' };
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  const containerStyle: React.CSSProperties = { maxWidth: '540px', margin: '0 auto', padding: '0.5rem' };

  // ==================== JUDGE SELECTION ====================
  if (!isJudgeSelected) {
    return (
      <div style={containerStyle}>
        <div className="card" style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>Judge Scoring</h2>
          <p style={{ color: '#718096', marginBottom: '1.5rem' }}>
            Select your judge identity to begin.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {judges.map(judge => (
              <button
                key={judge.id}
                onClick={() => handleSelectJudge(judge.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem 1.25rem',
                  background: 'white',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  textAlign: 'left',
                  fontSize: '1rem',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#667eea';
                  (e.currentTarget as HTMLButtonElement).style.background = '#f7fafc';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0';
                  (e.currentTarget as HTMLButtonElement).style.background = 'white';
                }}
              >
                <span style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: judge.isChairman ? '#d69e2e' : '#667eea',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '1rem',
                  flexShrink: 0,
                }}>
                  {judge.judgeNumber}
                </span>
                <span style={{ fontWeight: 500, fontSize: '1.125rem' }}>
                  {judge.name}
                  {judge.isChairman && <span style={{ color: '#d69e2e', marginLeft: '0.5rem', fontSize: '0.875rem' }}>{'\u2605'} Chairman</span>}
                </span>
              </button>
            ))}
            {judges.length === 0 && (
              <p style={{ color: '#a0aec0' }}>No judges found for this competition.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==================== SUBMITTED ====================
  if (isSubmitted) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <JudgeBadge judge={selectedJudge!} />
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: '#c6f6d5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            fontSize: '2rem',
            color: '#276749',
          }}>
            ✓
          </div>

          <h2 style={{ color: '#276749', marginBottom: '0.5rem' }}>Scores Submitted</h2>
          {heatInfo && (
            <>
              <p style={{ color: '#a0aec0', margin: '0 0 0.25rem', fontSize: '0.8rem' }}>
                Heat {heatInfo.heatNumber} of {heatInfo.totalHeats}
              </p>
              {heatInfo.entries.map(entry => (
                <p key={entry.eventId} style={{ color: '#718096', marginBottom: '0.25rem' }}>
                  {entry.eventName} — {formatRound(entry.round)}
                </p>
              ))}
            </>
          )}
          <p style={{ color: '#a0aec0', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Waiting for the next heat...
          </p>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button
            onClick={handleChangeJudge}
            style={{
              padding: '0.75rem 1.25rem',
              background: 'transparent',
              border: '1px solid #cbd5e0',
              borderRadius: '6px',
              color: '#718096',
              cursor: 'pointer',
              fontSize: '0.875rem',
              touchAction: 'manipulation',
            }}
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
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <JudgeBadge judge={selectedJudge!} />
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: '1rem' }}>Waiting</h2>

          {!heatInfo ? (
            <div>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem', color: '#a0aec0' }}>...</div>
              <p style={{ color: '#a0aec0' }}>No active heat. Waiting for the competition to begin.</p>
            </div>
          ) : heatInfo.isBreak ? (
            <div>
              <p style={{ color: '#a0aec0', margin: '0 0 0.5rem', fontSize: '0.8rem' }}>
                Heat {heatInfo.heatNumber} of {heatInfo.totalHeats}
              </p>
              <div style={{
                padding: '1rem',
                background: '#fefce8',
                borderRadius: '8px',
                marginBottom: '0.75rem',
              }}>
                <p style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.25rem' }}>
                  {heatInfo.breakLabel || 'Break'}
                </p>
                {heatInfo.breakDuration && (
                  <p style={{ color: '#718096', margin: 0 }}>{heatInfo.breakDuration} minutes</p>
                )}
              </div>
              <p style={{ color: '#718096', fontSize: '0.875rem' }}>Scoring will resume after the break.</p>
            </div>
          ) : (
            <div>
              <p style={{ color: '#a0aec0', margin: '0 0 0.5rem', fontSize: '0.8rem' }}>
                Heat {heatInfo.heatNumber} of {heatInfo.totalHeats}
              </p>
              <div style={{
                padding: '1rem',
                background: '#f7fafc',
                borderRadius: '8px',
                marginBottom: '0.75rem',
              }}>
                {heatInfo.entries.map(entry => (
                  <div key={entry.eventId} style={{ marginBottom: '0.25rem' }}>
                    <p style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.125rem' }}>
                      {entry.eventName}
                    </p>
                    <p style={{ color: '#4a5568', margin: 0, textTransform: 'capitalize' }}>
                      {formatRound(entry.round)}
                    </p>
                  </div>
                ))}
                <div style={{ marginTop: '0.5rem' }}>
                  {(() => {
                    const sc = statusColor(heatInfo.status);
                    return (
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        background: sc.bg,
                        color: sc.text,
                        textTransform: 'uppercase',
                      }}>
                        {statusLabel(heatInfo.status)}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {heatInfo.status === 'scoring' && !isAssigned && (
                <p style={{ color: '#e53e3e', fontSize: '0.875rem', fontWeight: 500 }}>
                  You are not assigned to judge this heat.
                </p>
              )}
              {heatInfo.status !== 'scoring' && isAssigned && (
                <p style={{ color: '#667eea', fontSize: '0.875rem', fontWeight: 500 }}>
                  You are assigned to this heat. Scoring will begin soon.
                </p>
              )}
              {heatInfo.status !== 'scoring' && !isAssigned && (
                <p style={{ color: '#718096', fontSize: '0.875rem' }}>
                  Waiting for this heat to enter scoring.
                </p>
              )}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button
            onClick={handleChangeJudge}
            style={{
              padding: '0.75rem 1.25rem',
              background: 'transparent',
              border: '1px solid #cbd5e0',
              borderRadius: '6px',
              color: '#718096',
              cursor: 'pointer',
              fontSize: '0.875rem',
              touchAction: 'manipulation',
            }}
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
    <div style={containerStyle}>
      {error && (
        <div style={{
          padding: '0.5rem 0.75rem',
          background: '#fed7d7',
          color: '#9b2c2c',
          borderRadius: '6px',
          marginBottom: '0.5rem',
          fontWeight: 500,
          fontSize: '0.875rem',
        }}>
          {error}
        </div>
      )}

      {/* Compact header: judge identity + heat counter + controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.375rem 0.625rem',
        background: '#667eea',
        borderRadius: '8px',
        marginBottom: '0.5rem',
        color: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>
            J{selectedJudge!.judgeNumber} {selectedJudge!.name}
          </span>
          <button
            onClick={handleChangeJudge}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '0.6875rem',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
              touchAction: 'manipulation',
            }}
          >
            change
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)' }}>
            Heat {heatInfo!.heatNumber}/{heatInfo!.totalHeats}
          </span>
          <button
            onClick={toggleFullscreen}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              padding: 0,
              touchAction: 'manipulation',
              lineHeight: 1,
            }}
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
          <div style={{
            marginBottom: '0.5rem',
            borderRadius: '8px',
            overflow: 'hidden',
            border: `2px solid ${danceSubmitted ? '#48bb78' : '#667eea'}`,
          }}>
            <div style={{
              padding: '0.375rem 0.75rem',
              background: danceSubmitted ? '#48bb78' : '#667eea',
              textAlign: 'center',
            }}>
              <p style={{
                margin: 0,
                fontWeight: 700,
                fontSize: '1.125rem',
                color: 'white',
              }}>
                {danceSubmitted ? '✓ ' : ''}{activeDance}
              </p>
              <p style={{
                margin: 0,
                fontSize: '0.6875rem',
                color: 'rgba(255,255,255,0.85)',
                fontWeight: 500,
              }}>
                {danceSubmitted ? 'Submitted — waiting for next dance' : `Now Scoring — Dance ${currentDanceIndex + 1} of ${allDances.length}`}
              </p>
            </div>

            {allDances.length > 1 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem',
                padding: '0.3125rem 0.5rem',
                background: danceSubmitted ? '#f0fff4' : '#eef2ff',
              }}>
                {allDances.map((d, i) => {
                  const isThisDance = d === activeDance;
                  const isSubmitted = submittedDances.has(d);
                  return (
                    <div key={d} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: isThisDance ? undefined : '8px',
                        height: isThisDance ? '22px' : '8px',
                        padding: isThisDance ? '0 0.5rem' : 0,
                        borderRadius: isThisDance ? '11px' : '50%',
                        background: isSubmitted ? '#48bb78' : isThisDance ? '#667eea' : '#cbd5e0',
                        color: 'white',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                      }}>
                        {isThisDance ? d : ''}
                      </div>
                      {i < allDances.length - 1 && (
                        <div style={{
                          width: '12px',
                          height: '2px',
                          background: isSubmitted ? '#48bb78' : '#cbd5e0',
                        }} />
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
      <div className="card">
        {/* When current dance is already submitted, show a waiting message instead of the form */}
        {isMultiDance && activeDance && submittedDances.has(activeDance) ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#c6f6d5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem',
              fontSize: '1.5rem',
              color: '#276749',
            }}>
              ✓
            </div>
            <p style={{ fontWeight: 700, fontSize: '1.125rem', color: '#276749', margin: '0 0 0.25rem' }}>
              {activeDance} Scores Submitted
            </p>
            <p style={{ color: '#718096', fontSize: '0.875rem', margin: 0 }}>
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
              <div style={{
                padding: '0.5rem 0',
                marginBottom: '0.5rem',
                borderBottom: '2px solid #667eea',
              }}>
                <p style={{ margin: 0, fontWeight: 700, color: '#667eea', fontSize: '1rem' }}>
                  {entry.eventName}
                </p>
                <p style={{ margin: '0.125rem 0 0', color: '#718096', fontSize: '0.8rem' }}>
                  {formatRound(entry.round)} — {entry.couples.length} couples
                </p>
              </div>
            )}

            {renderEntryForm(entry, isMultiDance ? activeDance! : undefined)}

            {/* Divider between entries */}
            {isMultiEntry && idx < arr.length - 1 && (
              <hr style={{
                border: 'none',
                borderTop: '2px dashed #e2e8f0',
                margin: '1.5rem 0',
              }} />
            )}
          </div>
        ))}

        {/* Validation errors, confirm overlay, and submit button — hidden when in dance-submitted waiting state */}
        {!(isMultiDance && activeDance && submittedDances.has(activeDance)) && (<>
          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div style={{
              padding: '0.75rem 1rem',
              background: '#fed7d7',
              borderRadius: '6px',
              marginTop: '1rem',
            }}>
              {validationErrors.map((err, i) => (
                <p key={i} style={{ margin: i > 0 ? '0.25rem 0 0' : 0, color: '#9b2c2c', fontSize: '0.875rem' }}>
                  {err}
                </p>
              ))}
            </div>
          )}

          {/* Confirmation overlay */}
          {showConfirm && (
            <div style={{
              padding: '0.75rem',
              background: '#ebf8ff',
              border: '2px solid #bee3f8',
              borderRadius: '8px',
              marginTop: '0.75rem',
              textAlign: 'center',
            }}>
              <p style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#2a4365', fontSize: '0.9375rem' }}>
                Submit {isMultiDance && activeDance ? `${activeDance} scores` : 'scores'}{isMultiEntry ? ` across ${heatInfo!.entries.length} events` : ''}?
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: '0.625rem',
                    minHeight: '42px',
                    background: 'white',
                    color: '#4a5568',
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                    fontSize: '0.9375rem',
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSubmit}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: '0.625rem',
                    minHeight: '42px',
                    background: '#48bb78',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.9375rem',
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.6 : 1,
                    touchAction: 'manipulation',
                  }}
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
              style={{
                width: '100%',
                marginTop: '0.75rem',
                padding: '0.75rem',
                minHeight: '48px',
                background: '#48bb78',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1.125rem',
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.6 : 1,
                transition: 'opacity 0.15s',
                touchAction: 'manipulation',
              }}
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
