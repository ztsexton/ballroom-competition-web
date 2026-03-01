import { useState } from 'react';
import { JudgeSettings, TimingSettings, ScheduleDayConfig, AutoBreaksConfig } from '../../../../types';
import { DEFAULT_STYLE_ORDER } from '../../../../constants/dances';
import { moveItem } from '../utils';

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
  onStyleOrderChange: (order: string[]) => void;
  onLevelOrderChange: (order: string[]) => void;
  onDanceOrderChange: (order: Record<string, string[]>) => void;
  onJudgeSettingsChange: (settings: JudgeSettings) => void;
  onTimingSettingsChange: (fn: (prev: TimingSettings) => TimingSettings) => void;
  onDayConfigsChange: (configs: ScheduleDayConfig[]) => void;
  onAutoBreaksChange: (config: AutoBreaksConfig) => void;
  onGenerate: () => void;
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
  onStyleOrderChange,
  onLevelOrderChange,
  onDanceOrderChange,
  onJudgeSettingsChange,
  onTimingSettingsChange,
  onDayConfigsChange,
  onAutoBreaksChange,
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
  return (
    <>
      <div className="mt-6">
        <h3>Style Order</h3>
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

      <div className="mt-6">
        <h3>Level Order</h3>
        <p className="text-gray-500 text-sm mb-2">
          Within each style, events are sorted by level.
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

      <div className="mt-6">
        <h3>Judge Assignment</h3>
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
        </div>
      </div>

      <div className="mt-6">
        <h3>Timing Settings</h3>
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
      </div>

      <div className="mt-6">
        <h3>Schedule Window</h3>
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
      </div>

      <div className="mt-6">
        <h3>Auto Breaks</h3>
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
      </div>

      <div className="mt-6">
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
    <div className="mt-6">
      <h3>Dance Order</h3>
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
                className="w-full flex items-center justify-between p-2 bg-gray-50 hover:bg-gray-100 cursor-pointer text-left font-semibold text-sm"
              >
                <span>{style} ({dances.length})</span>
                <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
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
