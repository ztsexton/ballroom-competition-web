import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { judgingApi } from '../api/client';
import { ActiveHeatInfo, Judge } from '../types';
import { useCompetitionSSE } from '../hooks/useCompetitionSSE';

type InputMethod = 'keyboard' | 'tap' | 'picker' | 'quickscore';

const JudgeScoringPage = () => {
  const { id } = useParams<{ id: string }>();
  const competitionId = parseInt(id || '0');

  const [judges, setJudges] = useState<Judge[]>([]);
  const [selectedJudgeId, setSelectedJudgeId] = useState<number | null>(null);
  const [heatInfo, setHeatInfo] = useState<ActiveHeatInfo | null>(null);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [inputMethod, setInputMethod] = useState<InputMethod>('keyboard');

  // Track which heat we've submitted for and which heat our scores belong to.
  const [submittedHeatKey, setSubmittedHeatKey] = useState<string | null>(null);
  const scoringHeatKeyRef = useRef<string | null>(null);

  const heatKey = heatInfo ? `${heatInfo.eventId}:${heatInfo.round}` : null;

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
    if (selectedJudgeId !== null && heatInfo) {
      const mode = heatInfo.scoringType === 'proficiency' ? 'proficiency' : 'ranking';
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

  // Initialize scores only when the heat actually changes (different eventId+round).
  useEffect(() => {
    if (!heatInfo || !heatKey) return;
    if (heatKey === scoringHeatKeyRef.current) return; // same heat, keep scores

    const isProficiency = heatInfo.scoringType === 'proficiency';
    const initial: Record<number, number> = {};
    heatInfo.couples.forEach(c => {
      initial[c.bib] = isProficiency ? 0 : heatInfo.isRecallRound ? 0 : 1;
    });
    setScores(initial);
    scoringHeatKeyRef.current = heatKey;
    setSubmitting(false);
    setShowConfirm(false);
    setValidationErrors([]);

    // Load saved input method preference for the new heat's scoring type
    if (selectedJudgeId !== null) {
      loadInputMethodPref(selectedJudgeId, heatInfo.scoringType, heatInfo.isRecallRound);
    }
  }, [heatKey, heatInfo, selectedJudgeId, loadInputMethodPref]);

  // When the heat changes (different key), clear the submitted state.
  useEffect(() => {
    if (heatKey && submittedHeatKey && heatKey !== submittedHeatKey) {
      setSubmittedHeatKey(null);
    }
  }, [heatKey, submittedHeatKey]);

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

  // --- Validation ---

  const validate = (): string[] => {
    if (!heatInfo) return ['No active heat'];
    const errors: string[] = [];
    const coupleCount = heatInfo.couples.length;
    const isProficiency = heatInfo.scoringType === 'proficiency';

    if (isProficiency) {
      const missing = heatInfo.couples.filter(c => scores[c.bib] === undefined || scores[c.bib] === 0);
      if (missing.length > 0) {
        errors.push(`Enter a score for: ${missing.map(c => `#${c.bib}`).join(', ')}`);
      }
    } else if (heatInfo.isRecallRound) {
      // Recall: no strict validation — 0 recalls is technically valid
    } else {
      // Final ranking: unique ranks 1..N
      const ranks = heatInfo.couples.map(c => scores[c.bib]);
      const missing = heatInfo.couples.filter(c => !scores[c.bib] || scores[c.bib] < 1 || scores[c.bib] > coupleCount);
      if (missing.length > 0) {
        errors.push(`Rank must be 1-${coupleCount} for: ${missing.map(c => `#${c.bib}`).join(', ')}`);
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
        errors.push(`Duplicate rank(s): ${[...dupes].sort((a, b) => a - b).join(', ')}`);
      }
    }
    return errors;
  };

  const handleSubmitClick = () => {
    const errors = validate();
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
      const scoreArray = Object.entries(scores).map(([bib, score]) => ({
        bib: parseInt(bib),
        score,
      }));

      await judgingApi.submitJudgeScores(
        competitionId,
        selectedJudgeId,
        heatInfo.eventId,
        heatInfo.round,
        scoreArray
      );
      setSubmittedHeatKey(heatKey);
      setValidationErrors([]);
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
  };

  const handleChangeJudge = () => {
    setSelectedJudgeId(null);
    setSubmittedHeatKey(null);
    scoringHeatKeyRef.current = null;
    setHeatInfo(null);
    setScores({});
    setShowConfirm(false);
    setValidationErrors([]);
  };

  const handleToggleRecall = (bib: number) => {
    setScores(prev => ({ ...prev, [bib]: prev[bib] === 1 ? 0 : 1 }));
  };

  const handleRankChange = (bib: number, value: string) => {
    const rank = parseInt(value);
    if (value === '') {
      setScores(prev => ({ ...prev, [bib]: 0 }));
    } else if (!isNaN(rank) && rank >= 1) {
      setScores(prev => ({ ...prev, [bib]: rank }));
    }
  };

  const handleProficiencyChange = (bib: number, value: string) => {
    const num = parseInt(value) || 0;
    setScores(prev => ({ ...prev, [bib]: Math.min(100, Math.max(0, num)) }));
  };

  const handleScoresBatch = (newScores: Record<number, number>) => {
    setScores(newScores);
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

  const containerStyle = { maxWidth: '540px', margin: '0 auto', padding: '0.75rem' };

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
                  background: '#667eea',
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
                <span style={{ fontWeight: 500, fontSize: '1.125rem' }}>{judge.name}</span>
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
            <p style={{ color: '#718096', marginBottom: '0.25rem' }}>
              {heatInfo.eventName} — {formatRound(heatInfo.round)}
            </p>
          )}
          <p style={{ color: '#a0aec0', fontSize: '0.875rem' }}>
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
              <div style={{
                padding: '1rem',
                background: '#f7fafc',
                borderRadius: '8px',
                marginBottom: '0.75rem',
              }}>
                <p style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.25rem' }}>
                  {heatInfo.eventName}
                </p>
                <p style={{ color: '#4a5568', margin: '0 0 0.5rem', textTransform: 'capitalize' }}>
                  {formatRound(heatInfo.round)}
                </p>
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
  const isProficiency = heatInfo!.scoringType === 'proficiency';
  const isRecall = heatInfo!.isRecallRound;

  return (
    <div style={containerStyle}>
      {error && (
        <div style={{
          padding: '0.75rem 1rem',
          background: '#fed7d7',
          color: '#9b2c2c',
          borderRadius: '6px',
          marginBottom: '0.75rem',
          fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.75rem',
      }}>
        <JudgeBadge judge={selectedJudge!} />
        <span style={{
          padding: '0.25rem 0.75rem',
          background: '#fefcbf',
          borderRadius: '9999px',
          fontSize: '0.875rem',
          fontWeight: 700,
          color: '#744210',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          Scoring
        </span>
      </div>

      {/* Event info */}
      <div className="card" style={{ marginBottom: '0.75rem', padding: '0.75rem 1rem' }}>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem' }}>{heatInfo!.eventName}</h2>
        <p style={{ color: '#4a5568', margin: 0, fontSize: '0.875rem' }}>
          {formatRound(heatInfo!.round)}
          {heatInfo!.style || heatInfo!.level || heatInfo!.dances?.length ? ' | ' : ''}
          {[heatInfo!.style, heatInfo!.level, heatInfo!.dances?.join(', ')].filter(Boolean).join(' | ')}
        </p>
      </div>

      {/* Input method toggle (not for recall) */}
      {!isRecall && (
        <InputMethodToggle
          mode={isProficiency ? 'proficiency' : 'ranking'}
          selectedMethod={inputMethod}
          onMethodChange={handleInputMethodChange}
        />
      )}

      {/* Scoring form */}
      <div className="card">
        {isProficiency ? (
          inputMethod === 'quickscore' ? (
            <QuickScoreForm
              couples={heatInfo!.couples}
              scores={scores}
              onChange={handleProficiencyChange}
            />
          ) : (
            <ProficiencyForm
              couples={heatInfo!.couples}
              scores={scores}
              onChange={handleProficiencyChange}
            />
          )
        ) : isRecall ? (
          <RecallForm
            couples={heatInfo!.couples}
            scores={scores}
            onToggle={handleToggleRecall}
          />
        ) : (
          inputMethod === 'tap' ? (
            <TapToRankForm
              couples={heatInfo!.couples}
              scores={scores}
              onScoresChange={handleScoresBatch}
            />
          ) : inputMethod === 'picker' ? (
            <PickerRankForm
              couples={heatInfo!.couples}
              scores={scores}
              onScoresChange={handleScoresBatch}
            />
          ) : (
            <RankingForm
              couples={heatInfo!.couples}
              scores={scores}
              onChange={handleRankChange}
            />
          )
        )}

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
            padding: '1rem',
            background: '#ebf8ff',
            border: '2px solid #bee3f8',
            borderRadius: '8px',
            marginTop: '1rem',
            textAlign: 'center',
          }}>
            <p style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#2a4365' }}>
              Submit these scores?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                onClick={handleConfirmSubmit}
                disabled={submitting}
                style={{
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
                  touchAction: 'manipulation',
                }}
              >
                {submitting ? 'Submitting...' : 'Confirm'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                style={{
                  padding: '0.75rem',
                  minHeight: '48px',
                  background: 'white',
                  color: '#4a5568',
                  border: '1px solid #cbd5e0',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                }}
              >
                Cancel
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
              marginTop: '1.5rem',
              padding: '1rem',
              minHeight: '56px',
              background: '#48bb78',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1.25rem',
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
              transition: 'opacity 0.15s',
              touchAction: 'manipulation',
            }}
          >
            Submit Scores
          </button>
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
};

// ============================================================
// Sub-components
// ============================================================

interface CoupleInfo {
  bib: number;
  leaderName: string;
  followerName: string;
}

const JudgeBadge = ({ judge }: { judge: Judge }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.375rem 0.75rem',
    background: '#edf2f7',
    borderRadius: '6px',
    fontSize: '0.9375rem',
    fontWeight: 500,
  }}>
    <span style={{
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      background: '#667eea',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: '0.8125rem',
    }}>
      {judge.judgeNumber}
    </span>
    {judge.name}
  </span>
);

// --- Input Method Toggle ---

const InputMethodToggle = ({
  mode,
  selectedMethod,
  onMethodChange,
}: {
  mode: 'ranking' | 'proficiency';
  selectedMethod: string;
  onMethodChange: (method: InputMethod) => void;
}) => {
  const options: { key: InputMethod; label: string }[] = mode === 'ranking'
    ? [{ key: 'tap', label: 'Tap to Rank' }, { key: 'picker', label: 'Picker' }, { key: 'keyboard', label: 'Keyboard' }]
    : [{ key: 'quickscore', label: 'Quick Score' }, { key: 'keyboard', label: 'Keyboard' }];

  return (
    <div style={{
      display: 'flex',
      border: '2px solid #e2e8f0',
      borderRadius: '10px',
      overflow: 'hidden',
      marginBottom: '0.75rem',
    }}>
      {options.map(opt => {
        const isActive = opt.key === selectedMethod;
        return (
          <button
            key={opt.key}
            onClick={() => onMethodChange(opt.key)}
            style={{
              flex: 1,
              padding: '0.625rem 0.5rem',
              minHeight: '44px',
              border: 'none',
              background: isActive ? '#667eea' : 'transparent',
              color: isActive ? 'white' : '#4a5568',
              fontWeight: isActive ? 700 : 500,
              fontSize: '0.9375rem',
              cursor: 'pointer',
              transition: 'all 0.15s',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

// --- Recall Form ---

const RecallForm = ({
  couples,
  scores,
  onToggle,
}: {
  couples: CoupleInfo[];
  scores: Record<number, number>;
  onToggle: (bib: number) => void;
}) => {
  const recallCount = Object.values(scores).filter(v => v === 1).length;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <p style={{ fontWeight: 600, margin: 0 }}>Select couples to recall:</p>
        <span style={{
          padding: '0.25rem 0.5rem',
          background: recallCount > 0 ? '#c6f6d5' : '#e2e8f0',
          borderRadius: '4px',
          fontSize: '0.875rem',
          fontWeight: 600,
        }}>
          {recallCount} / {couples.length}
        </span>
      </div>
      {couples.map(couple => {
        const selected = scores[couple.bib] === 1;
        return (
          <div
            key={couple.bib}
            onClick={() => onToggle(couple.bib)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem',
              marginBottom: '0.5rem',
              borderRadius: '8px',
              border: selected ? '2px solid #48bb78' : '2px solid #e2e8f0',
              background: selected ? '#f0fff4' : '#fff',
              cursor: 'pointer',
              transition: 'all 0.15s',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
              minHeight: '56px',
            }}
          >
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              border: selected ? '2px solid #48bb78' : '2px solid #cbd5e0',
              background: selected ? '#48bb78' : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: '1rem',
              flexShrink: 0,
              transition: 'all 0.15s',
            }}>
              {selected ? '✓' : ''}
            </div>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: '1.0625rem' }}>#{couple.bib}</strong>{' '}
              <span style={{ color: '#4a5568' }}>
                {couple.leaderName} & {couple.followerName}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// --- Ranking Form (keyboard) ---

const RankingForm = ({
  couples,
  scores,
  onChange,
}: {
  couples: CoupleInfo[];
  scores: Record<number, number>;
  onChange: (bib: number, value: string) => void;
}) => {
  const rankCounts: Record<number, number> = {};
  Object.values(scores).forEach(r => {
    if (r >= 1) rankCounts[r] = (rankCounts[r] || 0) + 1;
  });

  return (
    <div>
      <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>
        Rank each couple (1 = best, {couples.length} = last):
      </p>
      {couples.map(couple => {
        const rank = scores[couple.bib];
        const isDuplicate = rank >= 1 && rankCounts[rank] > 1;
        return (
          <div
            key={couple.bib}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem',
              marginBottom: '0.5rem',
              borderRadius: '8px',
              border: isDuplicate ? '2px solid #e53e3e' : '1px solid #e2e8f0',
              background: isDuplicate ? '#fff5f5' : '#fff',
              minHeight: '56px',
            }}
          >
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: '1.0625rem' }}>#{couple.bib}</strong>{' '}
              <span style={{ color: '#4a5568' }}>
                {couple.leaderName} & {couple.followerName}
              </span>
            </div>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={1}
              max={couples.length}
              value={rank || ''}
              onChange={(e) => onChange(couple.bib, e.target.value)}
              style={{
                width: '60px',
                height: '48px',
                textAlign: 'center',
                padding: '0.25rem',
                border: isDuplicate ? '2px solid #e53e3e' : '2px solid #cbd5e0',
                borderRadius: '8px',
                fontSize: '1.375rem',
                fontWeight: 700,
                color: isDuplicate ? '#e53e3e' : '#2d3748',
                touchAction: 'manipulation',
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

// --- Tap to Rank Form ---

const TapToRankForm = ({
  couples,
  scores,
  onScoresChange,
}: {
  couples: CoupleInfo[];
  scores: Record<number, number>;
  onScoresChange: (scores: Record<number, number>) => void;
}) => {
  // Derive ranked and unranked lists from scores
  const ranked = couples
    .filter(c => scores[c.bib] > 0)
    .sort((a, b) => scores[a.bib] - scores[b.bib]);
  const unranked = couples.filter(c => !scores[c.bib] || scores[c.bib] === 0);
  const allRanked = ranked.length === couples.length;

  const handleTapToRank = (bib: number) => {
    const maxRank = Math.max(0, ...Object.values(scores).filter(v => v > 0));
    onScoresChange({ ...scores, [bib]: maxRank + 1 });
  };

  const handleRemoveRank = (bib: number) => {
    const removedRank = scores[bib];
    const updated: Record<number, number> = {};
    for (const [b, r] of Object.entries(scores)) {
      const bibNum = parseInt(b);
      if (bibNum === bib) {
        updated[bibNum] = 0;
      } else if (r > removedRank) {
        updated[bibNum] = r - 1;
      } else {
        updated[bibNum] = r;
      }
    }
    onScoresChange(updated);
  };

  const handleClearAll = () => {
    const cleared: Record<number, number> = {};
    couples.forEach(c => { cleared[c.bib] = 0; });
    onScoresChange(cleared);
  };

  const rowBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    width: '100%',
    padding: '0.875rem 1rem',
    marginBottom: '0.5rem',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '1rem',
    minHeight: '56px',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none',
  };

  return (
    <div>
      {/* Progress header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <p style={{ fontWeight: 600, margin: 0 }}>Tap couples in placement order:</p>
        <span style={{
          padding: '0.25rem 0.5rem',
          background: allRanked ? '#c6f6d5' : '#fefcbf',
          borderRadius: '4px',
          fontSize: '0.875rem',
          fontWeight: 600,
        }}>
          {ranked.length} / {couples.length}
        </span>
      </div>

      {/* Ranked section */}
      {ranked.length > 0 && (
        <div style={{ marginBottom: unranked.length > 0 ? '1rem' : 0 }}>
          {ranked.map(couple => (
            <button
              key={couple.bib}
              onClick={() => handleRemoveRank(couple.bib)}
              style={{
                ...rowBase,
                background: '#eef2ff',
                border: '2px solid #667eea',
              }}
            >
              {/* Rank circle */}
              <span style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: '#667eea',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1.25rem',
                flexShrink: 0,
              }}>
                {scores[couple.bib]}
              </span>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '1.0625rem' }}>#{couple.bib}</strong>{' '}
                <span style={{ color: '#4a5568' }}>
                  {couple.leaderName} & {couple.followerName}
                </span>
              </div>
              {/* Remove indicator */}
              <span style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.875rem',
                color: '#718096',
                flexShrink: 0,
              }}>
                ✕
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Divider with label */}
      {ranked.length > 0 && unranked.length > 0 && (
        <p style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: '#a0aec0',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.5rem',
        }}>
          Tap to place
        </p>
      )}

      {/* Unranked section */}
      {unranked.map(couple => (
        <button
          key={couple.bib}
          onClick={() => handleTapToRank(couple.bib)}
          style={{
            ...rowBase,
            background: '#fff',
            border: '2px solid #e2e8f0',
          }}
        >
          {/* Placeholder circle */}
          <span style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '2px dashed #cbd5e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '1.25rem',
            color: '#cbd5e0',
            flexShrink: 0,
          }}>
            {ranked.length + unranked.indexOf(couple) + 1}
          </span>
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: '1.0625rem' }}>#{couple.bib}</strong>{' '}
            <span style={{ color: '#4a5568' }}>
              {couple.leaderName} & {couple.followerName}
            </span>
          </div>
        </button>
      ))}

      {/* Clear all button */}
      {ranked.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          <button
            onClick={handleClearAll}
            style={{
              padding: '0.5rem 1rem',
              background: 'transparent',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              color: '#a0aec0',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              touchAction: 'manipulation',
            }}
          >
            Reset Rankings
          </button>
        </div>
      )}
    </div>
  );
};

// --- Picker Rank Form ---

const PickerRankForm = ({
  couples,
  scores,
  onScoresChange,
}: {
  couples: CoupleInfo[];
  scores: Record<number, number>;
  onScoresChange: (scores: Record<number, number>) => void;
}) => {
  const coupleCount = couples.length;
  const rankOptions = Array.from({ length: coupleCount }, (_, i) => i + 1);

  // Which ranks are already used, and by which bib
  const rankToBib: Record<number, number> = {};
  for (const c of couples) {
    const r = scores[c.bib];
    if (r >= 1 && r <= coupleCount) {
      rankToBib[r] = c.bib;
    }
  }

  const allRanked = Object.keys(rankToBib).length === coupleCount;

  const handlePickRank = (bib: number, rank: number) => {
    const currentRank = scores[bib];
    // If tapping the same rank, deselect it
    if (currentRank === rank) {
      onScoresChange({ ...scores, [bib]: 0 });
      return;
    }
    const updated = { ...scores };
    // If another couple has this rank, clear them
    if (rankToBib[rank] !== undefined && rankToBib[rank] !== bib) {
      updated[rankToBib[rank]] = 0;
    }
    updated[bib] = rank;
    onScoresChange(updated);
  };

  const handleClearAll = () => {
    const cleared: Record<number, number> = {};
    couples.forEach(c => { cleared[c.bib] = 0; });
    onScoresChange(cleared);
  };

  return (
    <div>
      {/* Progress header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <p style={{ fontWeight: 600, margin: 0 }}>
          Pick a rank for each couple (1 = best):
        </p>
        <span style={{
          padding: '0.25rem 0.5rem',
          background: allRanked ? '#c6f6d5' : '#fefcbf',
          borderRadius: '4px',
          fontSize: '0.875rem',
          fontWeight: 600,
        }}>
          {Object.keys(rankToBib).length} / {coupleCount}
        </span>
      </div>

      {couples.map(couple => {
        const currentRank = scores[couple.bib];
        const hasRank = currentRank >= 1 && currentRank <= coupleCount;
        return (
          <div
            key={couple.bib}
            style={{
              padding: '0.75rem',
              marginBottom: '0.625rem',
              borderRadius: '8px',
              border: hasRank ? '2px solid #667eea' : '1px solid #e2e8f0',
              background: hasRank ? '#eef2ff' : '#fff',
            }}
          >
            {/* Couple info */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem',
            }}>
              <div>
                <strong style={{ fontSize: '1.0625rem' }}>#{couple.bib}</strong>{' '}
                <span style={{ color: '#4a5568', fontSize: '0.9375rem' }}>
                  {couple.leaderName} & {couple.followerName}
                </span>
              </div>
              {hasRank && (
                <span style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#667eea',
                  minWidth: '28px',
                  textAlign: 'right',
                }}>
                  {currentRank}
                </span>
              )}
            </div>

            {/* Rank buttons */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(coupleCount, 8)}, 1fr)`,
              gap: '0.375rem',
            }}>
              {rankOptions.map(rank => {
                const isSelected = currentRank === rank;
                const isUsedByOther = rankToBib[rank] !== undefined && rankToBib[rank] !== couple.bib;
                return (
                  <button
                    key={rank}
                    onClick={() => handlePickRank(couple.bib, rank)}
                    disabled={false}
                    style={{
                      minHeight: '44px',
                      border: isSelected
                        ? '2px solid #667eea'
                        : isUsedByOther
                          ? '2px solid #e2e8f0'
                          : '2px solid #cbd5e0',
                      borderRadius: '8px',
                      background: isSelected
                        ? '#667eea'
                        : isUsedByOther
                          ? '#f7fafc'
                          : '#fff',
                      color: isSelected
                        ? 'white'
                        : isUsedByOther
                          ? '#cbd5e0'
                          : '#2d3748',
                      fontSize: '1.125rem',
                      fontWeight: 700,
                      cursor: isUsedByOther ? 'default' : 'pointer',
                      opacity: isUsedByOther ? 0.5 : 1,
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                      transition: 'all 0.1s',
                    }}
                  >
                    {rank}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Clear all button */}
      {Object.keys(rankToBib).length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          <button
            onClick={handleClearAll}
            style={{
              padding: '0.5rem 1rem',
              background: 'transparent',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              color: '#a0aec0',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              touchAction: 'manipulation',
            }}
          >
            Reset Rankings
          </button>
        </div>
      )}
    </div>
  );
};

// --- Proficiency Form (keyboard) ---

const ProficiencyForm = ({
  couples,
  scores,
  onChange,
}: {
  couples: CoupleInfo[];
  scores: Record<number, number>;
  onChange: (bib: number, value: string) => void;
}) => (
  <div>
    <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>
      Score each couple (0-100):
    </p>
    {couples.map(couple => (
      <div
        key={couple.bib}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem',
          marginBottom: '0.5rem',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          background: '#fff',
          minHeight: '56px',
        }}
      >
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: '1.0625rem' }}>#{couple.bib}</strong>{' '}
          <span style={{ color: '#4a5568' }}>
            {couple.leaderName} & {couple.followerName}
          </span>
        </div>
        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min={0}
          max={100}
          value={scores[couple.bib] ?? ''}
          onChange={(e) => onChange(couple.bib, e.target.value)}
          style={{
            width: '64px',
            height: '48px',
            textAlign: 'center',
            padding: '0.25rem',
            border: '2px solid #cbd5e0',
            borderRadius: '8px',
            fontSize: '1.375rem',
            fontWeight: 700,
            touchAction: 'manipulation',
          }}
        />
      </div>
    ))}
  </div>
);

// --- Quick Score Form (proficiency presets) ---

const SCORE_PRESETS = [60, 65, 70, 75, 80, 85, 90, 95];

const QuickScoreForm = ({
  couples,
  scores,
  onChange,
}: {
  couples: CoupleInfo[];
  scores: Record<number, number>;
  onChange: (bib: number, value: string) => void;
}) => (
  <div>
    <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>
      Score each couple (0-100):
    </p>
    {couples.map(couple => {
      const score = scores[couple.bib] || 0;
      return (
        <div
          key={couple.bib}
          style={{
            padding: '0.875rem',
            marginBottom: '0.75rem',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: '#fff',
          }}
        >
          {/* Couple info + score display */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.625rem',
          }}>
            <div>
              <strong style={{ fontSize: '1.0625rem' }}>#{couple.bib}</strong>{' '}
              <span style={{ color: '#4a5568', fontSize: '0.9375rem' }}>
                {couple.leaderName} & {couple.followerName}
              </span>
            </div>
            <span style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: score > 0 ? '#2d3748' : '#cbd5e0',
              minWidth: '50px',
              textAlign: 'right',
            }}>
              {score > 0 ? score : '--'}
            </span>
          </div>

          {/* Preset buttons grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.375rem',
            marginBottom: '0.5rem',
          }}>
            {SCORE_PRESETS.map(preset => {
              const isActive = score === preset;
              return (
                <button
                  key={preset}
                  onClick={() => onChange(couple.bib, String(preset))}
                  style={{
                    minHeight: '44px',
                    border: isActive ? '2px solid #667eea' : '2px solid #e2e8f0',
                    borderRadius: '8px',
                    background: isActive ? '#667eea' : '#f7fafc',
                    color: isActive ? 'white' : '#2d3748',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {preset}
                </button>
              );
            })}
          </div>

          {/* Fine-tune row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
          }}>
            <button
              onClick={() => onChange(couple.bib, String(Math.max(0, score - 1)))}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                border: '2px solid #e2e8f0',
                background: '#f7fafc',
                fontSize: '1.25rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                color: '#4a5568',
              }}
            >
              -
            </button>
            <span style={{
              fontSize: '1.125rem',
              fontWeight: 600,
              color: '#718096',
              minWidth: '36px',
              textAlign: 'center',
            }}>
              {score > 0 ? score : '--'}
            </span>
            <button
              onClick={() => onChange(couple.bib, String(Math.min(100, score + 1)))}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                border: '2px solid #e2e8f0',
                background: '#f7fafc',
                fontSize: '1.25rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                color: '#4a5568',
              }}
            >
              +
            </button>
          </div>
        </div>
      );
    })}
  </div>
);

// --- Utilities ---

const formatRound = (round: string) =>
  round.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

export default JudgeScoringPage;
