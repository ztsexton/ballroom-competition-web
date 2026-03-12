import { useState } from 'react';
import { JudgeSettings, JudgeBreakConfig, TimingSettings, ScheduleDayConfig, AutoBreaksConfig, LevelCombiningConfig } from '../../../../types';
import { DEFAULT_STYLE_ORDER } from '../../../../constants/dances';
import { moveItem } from '../utils';

const EVENT_TYPE_LABELS: Record<string, string> = {
  single: 'Single Dance',
  multi: 'Multi-Dance',
  scholarship: 'Scholarship',
};

const LEVEL_COMBINING_LABELS: Record<string, { label: string; description: string }> = {
  'same-level': {
    label: 'Same level only',
    description: 'Only combine events at the same level (e.g., Bronze with Bronze). Most heats but cleanest grouping.',
  },
  'prefer-same': {
    label: 'Prefer same level',
    description: 'Combine same-level first, then merge under-filled heats cross-level to save time.',
  },
  'any': {
    label: 'Combine freely',
    description: 'Combine any levels together to minimize total heats. Fastest schedule.',
  },
  'custom': {
    label: 'Custom groups',
    description: 'Define which levels can be combined together.',
  },
};

interface ScheduleConfigFormProps {
  styleOrder: string[];
  levelOrder: string[];
  danceOrder: Record<string, string[]>;
  judgeSettings: JudgeSettings;
  timingSettings: TimingSettings;
  eventCount: number;
  dayConfigs: ScheduleDayConfig[];
  generating?: boolean;
  autoBreaks: AutoBreaksConfig;
  deferFinals: boolean;
  eventTypeOrder: string[];
  levelCombining: LevelCombiningConfig;
  onStyleOrderChange: (order: string[]) => void;
  onLevelOrderChange: (order: string[]) => void;
  onDanceOrderChange: (order: Record<string, string[]>) => void;
  onJudgeSettingsChange: (settings: JudgeSettings) => void;
  onTimingSettingsChange: (fn: (prev: TimingSettings) => TimingSettings) => void;
  onDayConfigsChange: (configs: ScheduleDayConfig[]) => void;
  onAutoBreaksChange: (config: AutoBreaksConfig) => void;
  onDeferFinalsChange: (value: boolean) => void;
  onEventTypeOrderChange: (order: string[]) => void;
  onLevelCombiningChange: (config: LevelCombiningConfig) => void;
  onGenerate: () => void;
}

function ConfigSection({ title, description, defaultOpen, children }: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="mt-4 border border-gray-200 rounded">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center p-3 bg-gray-50 hover:bg-gray-100 cursor-pointer text-left border-none"
      >
        <div>
          <span className="font-semibold text-gray-800">{title}</span>
          {description && !open && <span className="text-gray-400 text-sm ml-2">{description}</span>}
        </div>
        <span className="text-gray-400 text-sm">{open ? '\u25BC' : '\u25B6'}</span>
      </button>
      {open && <div className="p-4 pt-2 border-t border-gray-200">{children}</div>}
    </div>
  );
}

export default function ScheduleConfigForm({
  styleOrder,
  levelOrder,
  danceOrder,
  judgeSettings,
  timingSettings,
  eventCount,
  dayConfigs,
  generating,
  autoBreaks,
  deferFinals,
  eventTypeOrder,
  levelCombining,
  onStyleOrderChange,
  onLevelOrderChange,
  onDanceOrderChange,
  onJudgeSettingsChange,
  onTimingSettingsChange,
  onDayConfigsChange,
  onAutoBreaksChange,
  onDeferFinalsChange,
  onEventTypeOrderChange,
  onLevelCombiningChange,
  onGenerate,
}: ScheduleConfigFormProps) {
  const numberOfDays = dayConfigs.length || 1;
  const [newStyleInput, setNewStyleInput] = useState('');

  const handleDaysChange = (newCount: number) => {
    const count = Math.max(1, Math.min(newCount, 7));
    const newConfigs: ScheduleDayConfig[] = [];
    for (let i = 0; i < count; i++) {
      newConfigs.push(dayConfigs[i] || { day: i + 1, startTime: '08:00', endTime: '17:00' });
    }
    // Ensure day numbers are sequential
    newConfigs.forEach((c, i) => { c.day = i + 1; });
    onDayConfigsChange(newConfigs);
  };

  const handleDayConfigChange = (index: number, field: 'startTime' | 'endTime', value: string) => {
    const newConfigs = dayConfigs.map((c, i) =>
      i === index ? { ...c, [field]: value } : c
    );
    onDayConfigsChange(newConfigs);
  };

  const generateButton = (
    <button
      className="px-6 py-3 bg-primary-500 text-white rounded border-none text-base font-medium transition-colors hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
      onClick={onGenerate}
      disabled={generating}
    >
      {generating && (
        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {generating ? 'Generating Schedule...' : `Generate Schedule (${eventCount} events)`}
    </button>
  );

  // Suggest level groups based on common patterns
  const suggestLevelGroups = (): string[][] => {
    // Group adjacent similar levels (e.g., Bronze 1-4 together, Silver 1-3 together)
    const groups: string[][] = [];
    let currentGroup: string[] = [];
    let currentBase = '';

    for (const level of levelOrder) {
      const base = level.replace(/\s*\d+$/, ''); // "Bronze 1" → "Bronze"
      if (base !== currentBase && currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
      currentBase = base;
      currentGroup.push(level);
    }
    if (currentGroup.length > 0) groups.push(currentGroup);
    return groups;
  };

  return (
    <>
      <div className="mt-4 mb-2">
        {generateButton}
      </div>

      <ConfigSection title="Event Ordering" description="Style, level, and dance order" defaultOpen>
        <div>
          <h4 className="mt-0 mb-2">Style Order</h4>
          <p className="text-gray-500 text-sm mb-2">
            Events are grouped by style first. Use arrows to set priority.
          </p>
          <div className="flex flex-col gap-1 max-w-[300px]">
            {styleOrder.map((style, idx) => (
              <div key={style} className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded">
                <span className="font-semibold min-w-[1.5rem]">{idx + 1}.</span>
                <span className="flex-1">{style}</span>
                <button
                  onClick={() => onStyleOrderChange(moveItem(styleOrder, idx, 'up'))}
                  disabled={idx === 0}
                  className={`py-0.5 px-1.5 ${idx === 0 ? 'opacity-30 cursor-default' : 'cursor-pointer'}`}
                >
                  ▲
                </button>
                <button
                  onClick={() => onStyleOrderChange(moveItem(styleOrder, idx, 'down'))}
                  disabled={idx === styleOrder.length - 1}
                  className={`py-0.5 px-1.5 ${idx === styleOrder.length - 1 ? 'opacity-30 cursor-default' : 'cursor-pointer'}`}
                >
                  ▼
                </button>
                {!DEFAULT_STYLE_ORDER.includes(style) && (
                  <button
                    onClick={() => {
                      onStyleOrderChange(styleOrder.filter(s => s !== style));
                      const newDanceOrder = { ...danceOrder };
                      delete newDanceOrder[style];
                      onDanceOrderChange(newDanceOrder);
                    }}
                    className="py-0 px-1 text-xs text-red-400 hover:text-red-600 cursor-pointer"
                    title="Remove custom style"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <div className="flex gap-1.5 mt-1">
              <input
                type="text"
                placeholder="Add custom style..."
                value={newStyleInput}
                onChange={(e) => setNewStyleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const name = newStyleInput.trim();
                    if (name && !styleOrder.includes(name)) {
                      onStyleOrderChange([...styleOrder, name]);
                      onDanceOrderChange({ ...danceOrder, [name]: [] });
                      setNewStyleInput('');
                    }
                  }
                }}
                className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const name = newStyleInput.trim();
                  if (name && !styleOrder.includes(name)) {
                    onStyleOrderChange([...styleOrder, name]);
                    onDanceOrderChange({ ...danceOrder, [name]: [] });
                    setNewStyleInput('');
                  }
                }}
                className="px-2.5 py-1 bg-primary-500 text-white rounded text-sm font-medium cursor-pointer hover:bg-primary-600"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <h4 className="mt-0 mb-2">Event Type Order</h4>
          <p className="text-gray-500 text-sm mb-2">
            Within each style, events are grouped by type in this order.
          </p>
          <div className="flex flex-col gap-1 max-w-[300px]">
            {eventTypeOrder.map((type, idx) => (
              <div key={type} className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded">
                <span className="font-semibold min-w-[1.5rem]">{idx + 1}.</span>
                <span className="flex-1">{EVENT_TYPE_LABELS[type] || type}</span>
                <button
                  onClick={() => onEventTypeOrderChange(moveItem(eventTypeOrder, idx, 'up'))}
                  disabled={idx === 0}
                  className={`py-0.5 px-1.5 ${idx === 0 ? 'opacity-30 cursor-default' : 'cursor-pointer'}`}
                >
                  ▲
                </button>
                <button
                  onClick={() => onEventTypeOrderChange(moveItem(eventTypeOrder, idx, 'down'))}
                  disabled={idx === eventTypeOrder.length - 1}
                  className={`py-0.5 px-1.5 ${idx === eventTypeOrder.length - 1 ? 'opacity-30 cursor-default' : 'cursor-pointer'}`}
                >
                  ▼
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <h4 className="mt-0 mb-2">Level Order</h4>
          <p className="text-gray-500 text-sm mb-2">
            Within each style and event type, events are sorted by level.
          </p>
          <div className="flex flex-col gap-1 max-w-[300px]">
            {levelOrder.map((level, idx) => (
              <div key={level} className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded">
                <span className="font-semibold min-w-[1.5rem]">{idx + 1}.</span>
                <span className="flex-1">{level}</span>
                <button
                  onClick={() => onLevelOrderChange(moveItem(levelOrder, idx, 'up'))}
                  disabled={idx === 0}
                  className={`py-0.5 px-1.5 ${idx === 0 ? 'opacity-30 cursor-default' : 'cursor-pointer'}`}
                >
                  ▲
                </button>
                <button
                  onClick={() => onLevelOrderChange(moveItem(levelOrder, idx, 'down'))}
                  disabled={idx === levelOrder.length - 1}
                  className={`py-0.5 px-1.5 ${idx === levelOrder.length - 1 ? 'opacity-30 cursor-default' : 'cursor-pointer'}`}
                >
                  ▼
                </button>
              </div>
            ))}
          </div>
        </div>

        <DanceOrderSection
          styleOrder={styleOrder}
          danceOrder={danceOrder}
          onDanceOrderChange={onDanceOrderChange}
        />
      </ConfigSection>

      <ConfigSection title="Heat Combining" description={LEVEL_COMBINING_LABELS[levelCombining.mode]?.label || 'Combine freely'}>
        <p className="text-gray-500 text-sm mb-3">
          Control how events at different levels are combined into shared heats to save time.
          Events must share the same style, dance(s), and scoring type to be combined.
          Couples are never duplicated within a heat.
        </p>
        <div className="flex flex-col gap-2 max-w-[500px]">
          {(['same-level', 'prefer-same', 'any', 'custom'] as const).map(mode => (
            <label key={mode} className="flex items-start gap-2.5 cursor-pointer p-2 rounded hover:bg-gray-50">
              <input
                type="radio"
                name="levelCombining"
                checked={levelCombining.mode === mode}
                onChange={() => {
                  if (mode === 'custom') {
                    onLevelCombiningChange({ mode, customGroups: suggestLevelGroups() });
                  } else {
                    onLevelCombiningChange({ mode });
                  }
                }}
                className="mt-0.5"
              />
              <div>
                <span className="font-semibold text-sm">{LEVEL_COMBINING_LABELS[mode].label}</span>
                <p className="text-gray-400 text-xs mt-0.5 mb-0">{LEVEL_COMBINING_LABELS[mode].description}</p>
              </div>
            </label>
          ))}

          {levelCombining.mode === 'custom' && levelCombining.customGroups && (
            <div className="mt-2 ml-6">
              <p className="text-sm text-gray-600 mb-2">
                Levels in the same group will be combined into shared heats. Drag levels between groups or use the suggested grouping.
              </p>
              {levelCombining.customGroups.map((group, groupIdx) => (
                <div key={groupIdx} className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-500">Group {groupIdx + 1}</span>
                    {levelCombining.customGroups!.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newGroups = levelCombining.customGroups!.filter((_, i) => i !== groupIdx);
                          // Move orphaned levels to the last group
                          if (group.length > 0 && newGroups.length > 0) {
                            newGroups[newGroups.length - 1] = [...newGroups[newGroups.length - 1], ...group];
                          }
                          onLevelCombiningChange({ ...levelCombining, customGroups: newGroups });
                        }}
                        className="text-xs text-red-400 hover:text-red-600 cursor-pointer bg-transparent border-none"
                      >
                        Remove group
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {group.map(level => (
                      <span key={level} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded text-sm">
                        {level}
                        {/* Move to next group */}
                        {groupIdx < levelCombining.customGroups!.length - 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newGroups = levelCombining.customGroups!.map(g => [...g]);
                              newGroups[groupIdx] = newGroups[groupIdx].filter(l => l !== level);
                              newGroups[groupIdx + 1] = [level, ...newGroups[groupIdx + 1]];
                              onLevelCombiningChange({ ...levelCombining, customGroups: newGroups.filter(g => g.length > 0) });
                            }}
                            className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer bg-transparent border-none"
                            title={`Move to Group ${groupIdx + 2}`}
                          >
                            ▼
                          </button>
                        )}
                        {groupIdx > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newGroups = levelCombining.customGroups!.map(g => [...g]);
                              newGroups[groupIdx] = newGroups[groupIdx].filter(l => l !== level);
                              newGroups[groupIdx - 1] = [...newGroups[groupIdx - 1], level];
                              onLevelCombiningChange({ ...levelCombining, customGroups: newGroups.filter(g => g.length > 0) });
                            }}
                            className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer bg-transparent border-none"
                            title={`Move to Group ${groupIdx}`}
                          >
                            ▲
                          </button>
                        )}
                      </span>
                    ))}
                    {group.length === 0 && <span className="text-xs text-gray-400 italic">Empty</span>}
                  </div>
                </div>
              ))}
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    onLevelCombiningChange({
                      ...levelCombining,
                      customGroups: [...(levelCombining.customGroups || []), []],
                    });
                  }}
                  className="text-xs text-primary-500 cursor-pointer bg-transparent border-none hover:underline"
                >
                  + Add group
                </button>
                <button
                  type="button"
                  onClick={() => onLevelCombiningChange({ ...levelCombining, customGroups: suggestLevelGroups() })}
                  className="text-xs text-primary-500 cursor-pointer bg-transparent border-none hover:underline"
                >
                  Reset to suggested
                </button>
                <button
                  type="button"
                  onClick={() => onLevelCombiningChange({ ...levelCombining, customGroups: levelOrder.map(l => [l]) })}
                  className="text-xs text-primary-500 cursor-pointer bg-transparent border-none hover:underline"
                >
                  One per level
                </button>
              </div>
            </div>
          )}
        </div>
      </ConfigSection>

      <ConfigSection title="Judge Assignment" description={`Default: ${judgeSettings.defaultCount} judges`}>
        <p className="text-gray-500 text-sm mb-2">
          Judges are automatically rotated across heats. Set the number required per level.
        </p>
        <div className="flex flex-col gap-2 max-w-[300px]">
          <div className="flex items-center gap-3">
            <label className="flex-1 font-semibold">Default count</label>
            <input
              type="number"
              min={1}
              value={judgeSettings.defaultCount}
              onChange={(e) => onJudgeSettingsChange({ ...judgeSettings, defaultCount: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-16 p-1.5 rounded border border-gray-200 text-center"
            />
          </div>
          {levelOrder.map(level => (
            <div key={level} className="flex items-center gap-3">
              <label className="flex-1 text-gray-600">{level}</label>
              <input
                type="number"
                min={1}
                placeholder={String(judgeSettings.defaultCount)}
                value={judgeSettings.levelOverrides[level] ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const overrides = { ...judgeSettings.levelOverrides };
                  if (val === '' || parseInt(val) === judgeSettings.defaultCount) {
                    delete overrides[level];
                  } else {
                    overrides[level] = Math.max(1, parseInt(val) || 1);
                  }
                  onJudgeSettingsChange({ ...judgeSettings, levelOverrides: overrides });
                }}
                className="w-16 p-1.5 rounded border border-gray-200 text-center"
              />
            </div>
          ))}
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100">
            <label className="flex-1 font-semibold">Target stint (min)</label>
            <input
              type="number"
              min={5}
              placeholder="45"
              value={judgeSettings.targetStintMinutes ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                onJudgeSettingsChange({
                  ...judgeSettings,
                  targetStintMinutes: val === '' ? undefined : Math.max(5, parseInt(val) || 45),
                });
              }}
              className="w-16 p-1.5 rounded border border-gray-200 text-center"
            />
          </div>
          <p className="text-gray-400 text-xs mt-1">How long judges work before rotating out. Default: 45 min.</p>
        </div>
      </ConfigSection>

      <ConfigSection title="Judge Break Schedule" description={judgeSettings.breakConfig?.mode === 'main-fillin' ? 'Main / Fill-in' : 'Standard Rotation'}>
        <p className="text-gray-500 text-sm mb-3">
          Configure how judge breaks are scheduled. In Main/Fill-in mode, designate main judges and fill-in judges on the Judges page, then generate variant schedules.
        </p>
        <div className="flex flex-col gap-3 max-w-[400px]">
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="breakMode"
                checked={!judgeSettings.breakConfig || judgeSettings.breakConfig.mode === 'rotation'}
                onChange={() => onJudgeSettingsChange({ ...judgeSettings, breakConfig: undefined })}
              />
              <div>
                <span className="font-semibold text-sm">Standard Rotation</span>
                <p className="text-gray-400 text-xs mt-0.5 mb-0">Judges rotate automatically based on target stint time.</p>
              </div>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="breakMode"
                checked={judgeSettings.breakConfig?.mode === 'main-fillin'}
                onChange={() => onJudgeSettingsChange({
                  ...judgeSettings,
                  breakConfig: {
                    enabled: true,
                    mode: 'main-fillin',
                    maxSessionMinutes: judgeSettings.breakConfig?.maxSessionMinutes ?? 60,
                    breakDurationMinutes: judgeSettings.breakConfig?.breakDurationMinutes ?? 15,
                    lunchBreak: judgeSettings.breakConfig?.lunchBreak,
                  },
                })}
              />
              <div>
                <span className="font-semibold text-sm">Main / Fill-in</span>
                <p className="text-gray-400 text-xs mt-0.5 mb-0">Designate main judges and a fill-in who covers during breaks. Choose from generated schedule options.</p>
              </div>
            </label>
          </div>

          {judgeSettings.breakConfig?.mode === 'main-fillin' && (() => {
            const bc = judgeSettings.breakConfig!;
            const updateBreakConfig = (updates: Partial<JudgeBreakConfig>) =>
              onJudgeSettingsChange({ ...judgeSettings, breakConfig: { ...bc, ...updates } });

            return (
              <div className="ml-6 flex flex-col gap-2 border-l-2 border-primary-200 pl-4">
                <div className="flex items-center gap-3">
                  <label className="flex-1 text-sm font-semibold">Max session (min)</label>
                  <input
                    type="number"
                    min={10}
                    value={bc.maxSessionMinutes}
                    onChange={(e) => updateBreakConfig({ maxSessionMinutes: Math.max(10, parseInt(e.target.value) || 60) })}
                    className="w-20 p-1.5 rounded border border-gray-200 text-center"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex-1 text-sm font-semibold">Break duration (min)</label>
                  <input
                    type="number"
                    min={5}
                    value={bc.breakDurationMinutes}
                    onChange={(e) => updateBreakConfig({ breakDurationMinutes: Math.max(5, parseInt(e.target.value) || 15) })}
                    className="w-20 p-1.5 rounded border border-gray-200 text-center"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={bc.lunchBreak?.enabled ?? false}
                    onChange={(e) => updateBreakConfig({
                      lunchBreak: {
                        enabled: e.target.checked,
                        durationMinutes: bc.lunchBreak?.durationMinutes ?? 45,
                        earliestTime: bc.lunchBreak?.earliestTime ?? '11:30',
                        latestTime: bc.lunchBreak?.latestTime ?? '13:00',
                      },
                    })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-semibold">Lunch break</span>
                </label>

                {bc.lunchBreak?.enabled && (
                  <div className="ml-6 flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <label className="flex-1 text-sm text-gray-600">Duration (min)</label>
                      <input
                        type="number"
                        min={15}
                        value={bc.lunchBreak.durationMinutes}
                        onChange={(e) => updateBreakConfig({
                          lunchBreak: { ...bc.lunchBreak!, durationMinutes: Math.max(15, parseInt(e.target.value) || 45) },
                        })}
                        className="w-20 p-1.5 rounded border border-gray-200 text-center"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex-1 text-sm text-gray-600">Earliest</label>
                      <input
                        type="time"
                        value={bc.lunchBreak.earliestTime || '11:30'}
                        onChange={(e) => updateBreakConfig({
                          lunchBreak: { ...bc.lunchBreak!, earliestTime: e.target.value },
                        })}
                        className="p-1.5 rounded border border-gray-200"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex-1 text-sm text-gray-600">Latest</label>
                      <input
                        type="time"
                        value={bc.lunchBreak.latestTime || '13:00'}
                        onChange={(e) => updateBreakConfig({
                          lunchBreak: { ...bc.lunchBreak!, latestTime: e.target.value },
                        })}
                        className="p-1.5 rounded border border-gray-200"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </ConfigSection>

      <ConfigSection title="Timing Settings" description={`${timingSettings.defaultDanceDurationSeconds}s per dance`}>
        <p className="text-gray-500 text-sm mb-2">
          Configure dance durations and transition times to estimate the schedule timeline.
        </p>
        <div className="flex flex-col gap-2 max-w-[400px]">
          <div className="flex items-center gap-3">
            <label className="flex-1 font-semibold">Start time</label>
            <input
              type="datetime-local"
              value={timingSettings.startTime || ''}
              onChange={(e) => onTimingSettingsChange(prev => ({ ...prev, startTime: e.target.value || undefined }))}
              className="p-1.5 rounded border border-gray-200"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex-1 font-semibold">Default dance duration (sec)</label>
            <input
              type="number"
              min={1}
              value={timingSettings.defaultDanceDurationSeconds}
              onChange={(e) => onTimingSettingsChange(prev => ({ ...prev, defaultDanceDurationSeconds: Math.max(1, parseInt(e.target.value) || 75) }))}
              className="w-20 p-1.5 rounded border border-gray-200 text-center"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex-1 font-semibold">Scholarship duration (sec)</label>
            <input
              type="number"
              min={1}
              placeholder="90"
              value={timingSettings.scholarshipDurationSeconds ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                onTimingSettingsChange(prev => ({
                  ...prev,
                  scholarshipDurationSeconds: val === '' ? undefined : Math.max(1, parseInt(val) || 90),
                }));
              }}
              className="w-20 p-1.5 rounded border border-gray-200 text-center"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex-1 font-semibold">Between dances (sec)</label>
            <input
              type="number"
              min={0}
              value={timingSettings.betweenDanceSeconds}
              onChange={(e) => onTimingSettingsChange(prev => ({ ...prev, betweenDanceSeconds: Math.max(0, parseInt(e.target.value) || 0) }))}
              className="w-20 p-1.5 rounded border border-gray-200 text-center"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex-1 font-semibold">Between heats (sec)</label>
            <input
              type="number"
              min={0}
              value={timingSettings.betweenHeatSeconds}
              onChange={(e) => onTimingSettingsChange(prev => ({ ...prev, betweenHeatSeconds: Math.max(0, parseInt(e.target.value) || 0) }))}
              className="w-20 p-1.5 rounded border border-gray-200 text-center"
            />
          </div>
          <div className="mt-1">
            <label className="font-semibold block mb-1.5">Duration overrides by level (sec)</label>
            {levelOrder.map(level => (
              <div key={level} className="flex items-center gap-3 mb-1">
                <label className="flex-1 text-gray-600">{level}</label>
                <input
                  type="number"
                  min={1}
                  placeholder={String(timingSettings.defaultDanceDurationSeconds)}
                  value={timingSettings.levelDurationOverrides?.[level] ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    onTimingSettingsChange(prev => {
                      const overrides = { ...prev.levelDurationOverrides };
                      if (val === '' || parseInt(val) === prev.defaultDanceDurationSeconds) {
                        delete overrides[level];
                      } else {
                        overrides[level] = Math.max(1, parseInt(val) || 1);
                      }
                      return { ...prev, levelDurationOverrides: Object.keys(overrides).length > 0 ? overrides : undefined };
                    });
                  }}
                  className="w-20 p-1.5 rounded border border-gray-200 text-center"
                />
              </div>
            ))}
          </div>
        </div>
      </ConfigSection>

      <ConfigSection title="Schedule Window" description={`${numberOfDays} day${numberOfDays > 1 ? 's' : ''}`}>
        <p className="text-gray-500 text-sm mb-2">
          Set competition duration to enable schedule optimization and overflow warnings.
        </p>
        <div className="flex flex-col gap-2 max-w-[400px]">
          <div className="flex items-center gap-3">
            <label className="flex-1 font-semibold">Number of days</label>
            <input
              type="number"
              min={1}
              max={7}
              value={numberOfDays}
              onChange={(e) => handleDaysChange(parseInt(e.target.value) || 1)}
              className="w-16 p-1.5 rounded border border-gray-200 text-center"
            />
          </div>
          {dayConfigs.map((config, idx) => (
            <div key={idx} className="flex items-center gap-3">
              {numberOfDays > 1 && (
                <label className="font-semibold min-w-[3.5rem]">Day {config.day}</label>
              )}
              <label className="text-gray-600">{numberOfDays === 1 ? 'Start' : ''}</label>
              <input
                type="time"
                value={config.startTime}
                onChange={(e) => handleDayConfigChange(idx, 'startTime', e.target.value)}
                className="p-1.5 rounded border border-gray-200"
              />
              <span className="text-gray-400">to</span>
              <input
                type="time"
                value={config.endTime}
                onChange={(e) => handleDayConfigChange(idx, 'endTime', e.target.value)}
                className="p-1.5 rounded border border-gray-200"
              />
            </div>
          ))}
        </div>
      </ConfigSection>

      <ConfigSection title="Auto Breaks" description={autoBreaks.enabled ? 'Enabled' : 'Disabled'}>
        <p className="text-gray-500 text-sm mb-2">
          Automatically insert breaks between style transitions in the generated schedule.
        </p>
        <div className="flex flex-col gap-2 max-w-[400px]">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoBreaks.enabled}
              onChange={(e) => onAutoBreaksChange({ ...autoBreaks, enabled: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="font-semibold text-sm">Insert breaks between styles</span>
          </label>
          {autoBreaks.enabled && (
            <div className="flex flex-col gap-2 ml-6">
              <div className="flex items-center gap-3">
                <label className="flex-1 text-sm text-gray-600">Break label</label>
                <input
                  type="text"
                  placeholder="Break"
                  value={autoBreaks.label || ''}
                  onChange={(e) => onAutoBreaksChange({ ...autoBreaks, label: e.target.value || undefined })}
                  className="w-40 p-1.5 rounded border border-gray-200 text-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex-1 text-sm text-gray-600">Duration (minutes)</label>
                <input
                  type="number"
                  min={1}
                  placeholder="5"
                  value={autoBreaks.durationMinutes ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    onAutoBreaksChange({
                      ...autoBreaks,
                      durationMinutes: val === '' ? undefined : Math.max(1, parseInt(val) || 5),
                    });
                  }}
                  className="w-20 p-1.5 rounded border border-gray-200 text-center text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </ConfigSection>

      <ConfigSection title="Finals Scheduling" description={deferFinals ? 'Deferred' : 'Inline'}>
        <p className="text-gray-500 text-sm mb-2">
          Control where final rounds appear in the schedule.
        </p>
        <div className="flex flex-col gap-2 max-w-[400px]">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={deferFinals}
              onChange={(e) => onDeferFinalsChange(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="font-semibold text-sm">Defer all finals to end of schedule</span>
          </label>
          <p className="text-gray-400 text-xs ml-6">
            {deferFinals
              ? 'All preliminary rounds run first across all styles, then all finals. Useful for morning prelims / evening finals.'
              : 'Finals run within their style block, immediately after prelims.'}
          </p>
        </div>
      </ConfigSection>

      <div className="mt-6">
        {generateButton}
      </div>
    </>
  );
}

function DanceOrderSection({
  styleOrder,
  danceOrder,
  onDanceOrderChange,
}: {
  styleOrder: string[];
  danceOrder: Record<string, string[]>;
  onDanceOrderChange: (order: Record<string, string[]>) => void;
}) {
  const [expandedStyles, setExpandedStyles] = useState<Record<string, boolean>>({});
  const [newDanceInputs, setNewDanceInputs] = useState<Record<string, string>>({});

  const toggleStyle = (style: string) => {
    setExpandedStyles(prev => ({ ...prev, [style]: !prev[style] }));
  };

  const moveDance = (style: string, fromIdx: number, direction: 'up' | 'down') => {
    const dances = danceOrder[style] || [];
    const moved = moveItem(dances, fromIdx, direction);
    onDanceOrderChange({ ...danceOrder, [style]: moved });
  };

  const removeDance = (style: string, idx: number) => {
    const dances = [...(danceOrder[style] || [])];
    dances.splice(idx, 1);
    onDanceOrderChange({ ...danceOrder, [style]: dances });
  };

  const addDance = (style: string) => {
    const name = (newDanceInputs[style] || '').trim();
    if (!name) return;
    const dances = [...(danceOrder[style] || [])];
    if (dances.includes(name)) return;
    dances.push(name);
    onDanceOrderChange({ ...danceOrder, [style]: dances });
    setNewDanceInputs(prev => ({ ...prev, [style]: '' }));
  };

  return (
    <div className="mt-4">
      <h4 className="mt-0 mb-2">Dance Order</h4>
      <p className="text-gray-500 text-sm mb-2">
        Within each style and level, events are sorted by their first dance in this order.
      </p>
      <div className="flex flex-col gap-2 max-w-[350px]">
        {styleOrder.map(style => {
          const dances = danceOrder[style] || [];
          const isExpanded = expandedStyles[style];
          return (
            <div key={style} className="border border-gray-200 rounded">
              <button
                type="button"
                onClick={() => toggleStyle(style)}
                className="w-full flex items-center justify-between p-2 bg-gray-50 hover:bg-gray-100 cursor-pointer text-left font-semibold text-sm border-none"
              >
                <span>{style} ({dances.length})</span>
                <span className="text-gray-400">{isExpanded ? '\u25BC' : '\u25B6'}</span>
              </button>
              {isExpanded && (
                <div className="p-2 pt-1">
                  <div className="flex flex-col gap-1">
                    {dances.map((dance, idx) => (
                      <div key={dance} className="flex items-center gap-1.5 py-1 px-2 bg-white border border-gray-100 rounded text-sm">
                        <span className="text-gray-400 min-w-[1.2rem] text-xs">{idx + 1}.</span>
                        <span className="flex-1">{dance}</span>
                        <button
                          type="button"
                          onClick={() => moveDance(style, idx, 'up')}
                          disabled={idx === 0}
                          className={`py-0 px-1 text-xs ${idx === 0 ? 'opacity-30 cursor-default' : 'cursor-pointer'}`}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveDance(style, idx, 'down')}
                          disabled={idx === dances.length - 1}
                          className={`py-0 px-1 text-xs ${idx === dances.length - 1 ? 'opacity-30 cursor-default' : 'cursor-pointer'}`}
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDance(style, idx)}
                          className="py-0 px-1 text-xs text-red-400 hover:text-red-600 cursor-pointer"
                          title="Remove dance"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <input
                      type="text"
                      placeholder="Add custom dance..."
                      value={newDanceInputs[style] || ''}
                      onChange={(e) => setNewDanceInputs(prev => ({ ...prev, [style]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDance(style); } }}
                      className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => addDance(style)}
                      className="px-2.5 py-1 bg-primary-500 text-white rounded text-sm font-medium cursor-pointer hover:bg-primary-600"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
