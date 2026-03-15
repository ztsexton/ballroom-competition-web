import { useState, useCallback } from 'react';
import { ActiveHeatInfo, ActiveHeatEntry, Judge } from '../../../types';
import { InputMethod } from './types';
import { formatRound } from './utils';
import InputMethodToggle from './components/InputMethodToggle';
import RecallForm from './components/RecallForm';
import RankingForm from './components/RankingForm';
import TapToRankForm from './components/TapToRankForm';
import PickerRankForm from './components/PickerRankForm';
import ProficiencyForm from './components/ProficiencyForm';
import QuickScoreForm from './components/QuickScoreForm';
import ScoringHeader from './components/ScoringHeader';
import DanceProgressIndicator from './components/DanceProgressIndicator';
import SubmissionPanel from './components/SubmissionPanel';

// ── Mock Data ──

const MOCK_JUDGES: Judge[] = [
  { id: 1, name: 'Maria Sanchez', judgeNumber: 1, competitionId: 0, isChairman: true },
  { id: 2, name: 'Robert Chen', judgeNumber: 2, competitionId: 0 },
  { id: 3, name: 'Lisa Thompson', judgeNumber: 3, competitionId: 0 },
];

const MOCK_JUDGES_INFO = MOCK_JUDGES.map(j => ({
  id: j.id, name: j.name, judgeNumber: j.judgeNumber, isChairman: j.isChairman,
}));

function makeCouples(count: number, startBib = 101) {
  const names = [
    ['James', 'Emily'], ['Michael', 'Sarah'], ['David', 'Jessica'],
    ['Daniel', 'Ashley'], ['Matthew', 'Amanda'], ['Andrew', 'Brittany'],
    ['Joshua', 'Megan'], ['Christopher', 'Lauren'], ['Ryan', 'Stephanie'],
    ['Brandon', 'Nicole'], ['Tyler', 'Jennifer'], ['Kevin', 'Rachel'],
    ['Nathan', 'Heather'], ['Justin', 'Michelle'], ['Samuel', 'Tiffany'],
  ];
  return Array.from({ length: count }, (_, i) => ({
    bib: startBib + i,
    leaderName: names[i % names.length][0] + (i >= names.length ? ` ${String.fromCharCode(65 + Math.floor(i / names.length))}` : ''),
    followerName: names[i % names.length][1] + (i >= names.length ? ` ${String.fromCharCode(65 + Math.floor(i / names.length))}` : ''),
  }));
}

// Scenario 1: Standard recall, quarter-final, 15 couples split into 2 floor heats
const SCENARIO_1: ActiveHeatInfo = {
  competitionId: 0,
  heatId: 'test-qf-split',
  entries: [{
    eventId: 101,
    eventName: 'Pro-Am Smooth Bronze Waltz',
    round: 'quarter-final',
    couples: makeCouples(8, 101),
    isRecallRound: true,
    scoringType: 'standard',
    designation: 'Pro-Am',
    style: 'Smooth',
    level: 'Bronze',
    dances: ['Waltz'],
    floorHeatIndex: 0,
    totalFloorHeats: 2,
    recallCount: 5,
  }],
  status: 'scoring',
  judges: MOCK_JUDGES_INFO,
  heatNumber: 3,
  totalHeats: 24,
};

// Scenario 2: Standard final, rank 1-6
const SCENARIO_2: ActiveHeatInfo = {
  competitionId: 0,
  heatId: 'test-final-rank',
  entries: [{
    eventId: 201,
    eventName: 'Amateur Smooth Silver Waltz',
    round: 'final',
    couples: makeCouples(6, 201),
    isRecallRound: false,
    scoringType: 'standard',
    designation: 'Amateur',
    style: 'Smooth',
    level: 'Silver',
    dances: ['Waltz'],
  }],
  status: 'scoring',
  judges: MOCK_JUDGES_INFO,
  heatNumber: 18,
  totalHeats: 24,
};

// Scenario 3: Proficiency, 10 couples in one event
const SCENARIO_3: ActiveHeatInfo = {
  competitionId: 0,
  heatId: 'test-prof-10',
  entries: [{
    eventId: 301,
    eventName: 'Pro-Am Rhythm Bronze Cha Cha',
    round: 'final',
    couples: makeCouples(10, 301),
    isRecallRound: false,
    scoringType: 'proficiency',
    designation: 'Pro-Am',
    style: 'Rhythm',
    level: 'Bronze',
    dances: ['Cha Cha'],
  }],
  status: 'scoring',
  judges: MOCK_JUDGES_INFO,
  heatNumber: 10,
  totalHeats: 24,
};

// Scenario 4: Proficiency, 8 couples, 4 separate events in same heat
const SCENARIO_4: ActiveHeatInfo = {
  competitionId: 0,
  heatId: 'test-prof-multi',
  entries: [
    {
      eventId: 401,
      eventName: 'Pro-Am Latin Bronze Cha Cha',
      round: 'final',
      couples: makeCouples(2, 401),
      isRecallRound: false,
      scoringType: 'proficiency',
      designation: 'Pro-Am',
      style: 'Latin',
      level: 'Bronze',
      dances: ['Cha Cha'],
    },
    {
      eventId: 402,
      eventName: 'Pro-Am Latin Bronze Rumba',
      round: 'final',
      couples: makeCouples(2, 403),
      isRecallRound: false,
      scoringType: 'proficiency',
      designation: 'Pro-Am',
      style: 'Latin',
      level: 'Bronze',
      dances: ['Rumba'],
    },
    {
      eventId: 403,
      eventName: 'Pro-Am Latin Silver Cha Cha',
      round: 'final',
      couples: makeCouples(2, 405),
      isRecallRound: false,
      scoringType: 'proficiency',
      designation: 'Pro-Am',
      style: 'Latin',
      level: 'Silver',
      dances: ['Cha Cha'],
    },
    {
      eventId: 404,
      eventName: 'Pro-Am Latin Silver Rumba',
      round: 'final',
      couples: makeCouples(2, 407),
      isRecallRound: false,
      scoringType: 'proficiency',
      designation: 'Pro-Am',
      style: 'Latin',
      level: 'Silver',
      dances: ['Rumba'],
    },
  ],
  status: 'scoring',
  judges: MOCK_JUDGES_INFO,
  heatNumber: 14,
  totalHeats: 24,
};

const SCENARIOS = [
  { id: 'qf-recall', label: 'Quarter-Final Recall (Split Heat)', description: 'Standard scoring, quarter-final, 8 couples on floor (split from 15). Judges mark recalls.', data: SCENARIO_1 },
  { id: 'final-rank', label: 'Final Ranking (1-6)', description: 'Standard scoring, final round, 6 couples. Judges rank 1st through 6th.', data: SCENARIO_2 },
  { id: 'prof-10', label: 'Proficiency (10 Couples)', description: 'Proficiency scoring, 10 couples in a single event. Judges give numeric scores 0-100.', data: SCENARIO_3 },
  { id: 'prof-multi', label: 'Proficiency Multi-Event Heat', description: '4 separate events in one heat (8 couples total, 2 per event). Each event scored independently.', data: SCENARIO_4 },
];

// ── Test Page Component ──

const TestScoringPage = () => {
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [selectedJudge, setSelectedJudge] = useState<Judge>(MOCK_JUDGES[0]);
  const [scores, setScores] = useState<Record<string, Record<number, number>>>({});
  const [inputMethods, setInputMethods] = useState<Record<string, InputMethod>>({
    ranking: 'tap',
    proficiency: 'quickscore',
  });
  const [showConfirm, setShowConfirm] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [activeDance, setActiveDance] = useState<string | null>(null);
  const [submittedDances, setSubmittedDances] = useState<Set<string>>(new Set());

  const scenario = SCENARIOS.find(s => s.id === activeScenario);
  const heatInfo = scenario?.data ?? null;

  const initScores = useCallback((heat: ActiveHeatInfo) => {
    const initial: Record<string, Record<number, number>> = {};
    for (const entry of heat.entries) {
      const dances: (string | undefined)[] = entry.dances && entry.dances.length > 1 ? entry.dances : [undefined];
      for (const dance of dances) {
        const key = dance ? `${entry.eventId}:${dance}` : String(entry.eventId);
        initial[key] = {};
        entry.couples.forEach(c => { initial[key][c.bib] = 0; });
      }
    }
    setScores(initial);
    setShowConfirm(false);
    setValidationErrors([]);
    setSubmitted(false);
    setActiveDance(heat.allDances?.[0] || null);
    setSubmittedDances(new Set());
  }, []);

  const handleSelectScenario = (id: string) => {
    setActiveScenario(id);
    const s = SCENARIOS.find(s => s.id === id);
    if (s) initScores(s.data);
  };

  const handleToggleRecall = (key: string, bib: number) => {
    setScores(prev => ({
      ...prev,
      [key]: { ...prev[key], [bib]: prev[key]?.[bib] === 1 ? 0 : 1 },
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

  const handleInputMethodChange = (mode: string, method: InputMethod) => {
    setInputMethods(prev => ({ ...prev, [mode]: method }));
  };

  // Validation (mirrors real page logic)
  const validate = (): string[] => {
    if (!heatInfo) return ['No active heat'];
    const errors: string[] = [];
    const isMultiEntry = heatInfo.entries.length > 1;
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
          // No strict validation for recall
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
    }
    return errors;
  };

  const handleSubmitClick = () => {
    const errors = validate();
    setValidationErrors(errors);
    if (errors.length > 0) return;
    setShowConfirm(true);
  };

  const handleConfirmSubmit = () => {
    setShowConfirm(false);
    setSubmitted(true);
  };

  // ── Render ──

  // Scenario picker
  if (!activeScenario || !heatInfo) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Test Scoring Interface</h1>
          <p className="text-gray-500 text-sm">
            Select a scenario to test how the judge scoring UI looks and behaves with mock data. No real data is affected.
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Judge</label>
          <div className="flex gap-2">
            {MOCK_JUDGES.map(j => (
              <button
                key={j.id}
                onClick={() => setSelectedJudge(j)}
                className={`px-3 py-2 rounded-lg border-2 cursor-pointer text-sm font-medium transition-all ${
                  selectedJudge.id === j.id
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <span className="font-bold">J{j.judgeNumber}</span> {j.name}
                {j.isChairman && <span className="ml-1 text-amber-500">★</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {SCENARIOS.map(s => (
            <button
              key={s.id}
              onClick={() => handleSelectScenario(s.id)}
              className="text-left bg-white rounded-lg shadow p-5 border-2 border-transparent hover:border-primary-300 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="font-semibold text-gray-800 mb-1">{s.label}</div>
              <p className="text-sm text-gray-500 m-0">{s.description}</p>
              <div className="flex gap-2 mt-2 flex-wrap">
                {s.data.entries.map(e => (
                  <span key={e.eventId} className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                    {e.couples.length} couples — {e.isRecallRound ? 'Recall' : e.scoringType === 'proficiency' ? 'Proficiency' : 'Ranking'}
                  </span>
                ))}
                {s.data.entries[0]?.floorHeatIndex !== undefined && (
                  <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                    Floor {(s.data.entries[0].floorHeatIndex ?? 0) + 1} of {s.data.entries[0].totalFloorHeats}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Submitted state
  if (submitted) {
    return (
      <div className="max-w-[540px] mx-auto p-2">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4 text-3xl text-green-800">
            ✓
          </div>
          <h2 className="text-xl font-bold text-green-800 mb-2">Scores Submitted (Test)</h2>
          <p className="text-gray-500 text-sm mb-1">This is a test — no real scores were saved.</p>

          <div className="mt-4 bg-gray-50 rounded-lg p-4 text-left">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Submitted Scores</h3>
            {heatInfo.entries.map(entry => {
              const key = String(entry.eventId);
              const entryScores = scores[key] || {};
              return (
                <div key={entry.eventId} className="mb-3">
                  <p className="text-xs font-semibold text-primary-600 mb-1">{entry.eventName}</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {entry.couples.map(c => (
                      <div key={c.bib} className="flex justify-between px-2 py-1 bg-white rounded border border-gray-100">
                        <span className="font-medium">#{c.bib}</span>
                        <span className="text-gray-600">
                          {entry.isRecallRound
                            ? (entryScores[c.bib] === 1 ? 'Recalled' : '—')
                            : entry.scoringType === 'proficiency'
                              ? entryScores[c.bib] || '—'
                              : entryScores[c.bib] ? `#${entryScores[c.bib]}` : '—'
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => { initScores(heatInfo); }}
              className="flex-1 px-4 py-2.5 bg-primary-500 text-white rounded-lg border-none cursor-pointer text-sm font-semibold hover:bg-primary-600 transition-colors"
            >
              Score Again
            </button>
            <button
              onClick={() => setActiveScenario(null)}
              className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg border-none cursor-pointer text-sm font-medium hover:bg-gray-300 transition-colors"
            >
              Back to Scenarios
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active scoring ──

  const firstEntry = heatInfo.entries[0];
  const isMultiEntry = heatInfo.entries.length > 1;
  const isRecall = firstEntry?.isRecallRound ?? false;
  const isProficiency = firstEntry?.scoringType === 'proficiency';
  const scoringTypes = new Set(heatInfo.entries.map(e => e.scoringType || 'standard'));
  const hasMixedTypes = scoringTypes.size > 1;
  const allDances = heatInfo.allDances || [];
  const isMultiDance = allDances.length > 0;
  const currentDanceIndex = activeDance ? allDances.indexOf(activeDance) : 0;

  const renderEntryForm = (entry: ActiveHeatEntry, dance?: string) => {
    const key = dance ? `${entry.eventId}:${dance}` : String(entry.eventId);
    const entryScores = scores[key] || {};
    const entryIsProficiency = entry.scoringType === 'proficiency';
    const entryIsRecall = entry.isRecallRound;
    const proAm = entry.designation === 'Pro-Am';
    const currentInputMethod = entryIsProficiency ? inputMethods.proficiency : inputMethods.ranking;

    if (entryIsProficiency) {
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

    if (entryIsRecall) {
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

  return (
    <div className="max-w-[540px] mx-auto p-2">
      {/* Test mode banner */}
      <div className="px-3 py-2 bg-amber-100 border border-amber-300 rounded-lg mb-2 flex items-center justify-between">
        <div>
          <span className="text-amber-800 font-semibold text-sm">Test Mode</span>
          <span className="text-amber-700 text-xs ml-2">{scenario?.label}</span>
          {firstEntry?.floorHeatIndex !== undefined && (
            <span className="ml-2 px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded text-xs font-medium">
              Floor {(firstEntry.floorHeatIndex ?? 0) + 1} of {firstEntry.totalFloorHeats}
            </span>
          )}
        </div>
        <button
          onClick={() => setActiveScenario(null)}
          className="text-amber-700 text-xs font-medium cursor-pointer bg-transparent border-none underline"
        >
          Change
        </button>
      </div>

      <ScoringHeader
        judge={selectedJudge}
        heatNumber={heatInfo.heatNumber}
        totalHeats={heatInfo.totalHeats}
        isFullscreen={false}
        onChangeJudge={() => setActiveScenario(null)}
        onToggleFullscreen={() => {}}
      />

      {/* Input method toggle(s) */}
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

      {/* Scoring forms */}
      <div className="bg-white rounded-lg shadow px-3 py-3">
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
          ? heatInfo.entries.filter(e => e.dances?.includes(activeDance))
          : heatInfo.entries
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

            {isMultiEntry && idx < arr.length - 1 && (
              <hr className="border-none border-t-2 border-dashed border-gray-200 my-3" />
            )}
          </div>
        ))}

        {!(isMultiDance && activeDance && submittedDances.has(activeDance)) && (
          <SubmissionPanel
            validationErrors={validationErrors}
            showConfirm={showConfirm}
            submitting={false}
            isMultiDance={isMultiDance}
            isMultiEntry={isMultiEntry}
            activeDance={activeDance}
            entryCount={heatInfo.entries.length}
            onSubmitClick={handleSubmitClick}
            onConfirmSubmit={handleConfirmSubmit}
            onCancelConfirm={() => setShowConfirm(false)}
          />
        )}
      </div>
    </div>
  );
};

export default TestScoringPage;
