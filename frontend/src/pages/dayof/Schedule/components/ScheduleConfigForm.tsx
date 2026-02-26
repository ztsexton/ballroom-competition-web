import { JudgeSettings, TimingSettings } from '../../../../types';
import { moveItem } from '../utils';

interface ScheduleConfigFormProps {
  styleOrder: string[];
  levelOrder: string[];
  judgeSettings: JudgeSettings;
  timingSettings: TimingSettings;
  eventCount: number;
  onStyleOrderChange: (order: string[]) => void;
  onLevelOrderChange: (order: string[]) => void;
  onJudgeSettingsChange: (settings: JudgeSettings) => void;
  onTimingSettingsChange: (fn: (prev: TimingSettings) => TimingSettings) => void;
  onGenerate: () => void;
}

export default function ScheduleConfigForm({
  styleOrder,
  levelOrder,
  judgeSettings,
  timingSettings,
  eventCount,
  onStyleOrderChange,
  onLevelOrderChange,
  onJudgeSettingsChange,
  onTimingSettingsChange,
  onGenerate,
}: ScheduleConfigFormProps) {
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
            </div>
          ))}
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
        <button className="px-6 py-3 bg-primary-500 text-white rounded border-none cursor-pointer text-base font-medium transition-colors hover:bg-primary-600" onClick={onGenerate}>
          Generate Schedule ({eventCount} events)
        </button>
      </div>
    </>
  );
}
