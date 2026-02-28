import { Competition } from '../../../../types';
import { LEVEL_TEMPLATES } from '../../../../constants/levels';
import Section from './Section';

interface RulesAndScoringSectionProps {
  comp: Competition;
  savedMap: Record<string, boolean>;
  levels: string[];
  newLevelName: string;
  setNewLevelName: (v: string) => void;
  saveField: (field: string, value: unknown, section: string) => void;
  saveLevels: (levels: string[]) => void;
}

const RulesAndScoringSection = ({
  comp,
  savedMap,
  levels,
  newLevelName,
  setNewLevelName,
  saveField,
  saveLevels,
}: RulesAndScoringSectionProps) => (
  <Section title="Rules & Scoring" savedKey="rules" savedMap={savedMap}>
    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-600 mb-1">Default Scoring Type</label>
      <div className="flex gap-2">
        {(['standard', 'proficiency'] as const).map(st => {
          const active = (comp.defaultScoringType || 'standard') === st;
          return (
            <button
              key={st}
              type="button"
              onClick={() => saveField('defaultScoringType', st, 'rules')}
              className={`px-4 py-2 rounded cursor-pointer transition-all ${
                active
                  ? 'border-2 border-blue-600 bg-blue-600 text-white font-bold'
                  : 'border border-gray-300 bg-white text-gray-700 font-normal'
              }`}
            >
              {st === 'standard' ? 'Standard' : 'Proficiency'}
            </button>
          );
        })}
      </div>
      <small className="text-gray-500 text-sm mt-1 block">
        {(comp.defaultScoringType || 'standard') === 'proficiency'
          ? 'New events will default to proficiency scoring (0-100, single round).'
          : 'New events will default to standard scoring (recalls + ranking).'}
      </small>
    </div>

    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-600 mb-1">Max Couples Per Heat</label>
      <input
        type="number"
        min="1"
        value={comp.maxCouplesPerHeat || ''}
        onChange={e => {
          const val = e.target.value ? parseInt(e.target.value) : undefined;
          saveField('maxCouplesPerHeat', val, 'rules');
        }}
        placeholder="No limit"
        className="w-[120px] px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
      />
    </div>

    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-600 mb-1">Level Mode</label>
      <p className="text-gray-500 text-sm mb-2">
        Choose how Open/Syllabus levels are configured for events.
      </p>
      <div className="flex gap-2 mb-4">
        {[
          { value: 'combined', label: 'Combined', description: 'Separate Open/Syllabus toggle (e.g., Silver + Open)' },
          { value: 'integrated', label: 'Integrated', description: 'Open levels in list (e.g., Silver 1, Open Silver)' },
        ].map(mode => {
          const isActive = (comp.levelMode || 'combined') === mode.value;
          return (
            <button
              key={mode.value}
              type="button"
              onClick={() => saveField('levelMode', mode.value, 'rules')}
              className={`px-4 py-2 rounded cursor-pointer transition-all ${
                isActive
                  ? 'border-2 border-primary-500 bg-primary-500 text-white font-bold'
                  : 'border border-gray-300 bg-white text-gray-700 font-normal'
              }`}
              title={mode.description}
            >
              {mode.label}
            </button>
          );
        })}
      </div>
      <small className="text-gray-500 text-sm block mb-4">
        {(comp.levelMode || 'combined') === 'combined'
          ? 'Events show a separate "Open/Syllabus" toggle. Any level can be marked as Open.'
          : 'Events select from the level list directly. Include "Open" variants in your levels (e.g., "Open Silver").'}
      </small>
    </div>

    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-600 mb-1">Competition Levels</label>
      <p className="text-gray-500 text-sm mb-2">
        Choose a template to start from, then customize as needed.
      </p>
      <div className="flex gap-2 flex-wrap mb-4">
        {Object.entries(LEVEL_TEMPLATES).map(([key, template]) => {
          const isActive = JSON.stringify(levels) === JSON.stringify(template.levels);
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                saveLevels([...template.levels]);
                if (template.levelMode) {
                  saveField('levelMode', template.levelMode, 'rules');
                }
              }}
              className={`px-4 py-2 rounded cursor-pointer transition-all ${
                isActive
                  ? 'border-2 border-primary-500 bg-primary-500 text-white font-bold'
                  : 'border border-gray-300 bg-white text-gray-700 font-normal'
              }`}
            >
              {template.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1 max-w-[400px]">
        {levels.map((lvl, idx) => (
          <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded">
            <span className="font-semibold min-w-[1.5rem]">{idx + 1}.</span>
            <span className="flex-1">{lvl}</span>
            <button type="button" disabled={idx === 0}
              onClick={() => {
                const next = [...levels];
                [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                saveLevels(next);
              }}
              className={`px-1.5 py-0.5 bg-transparent border border-gray-200 rounded ${idx === 0 ? 'opacity-30 cursor-default' : 'cursor-pointer'}`}
            >▲</button>
            <button type="button" disabled={idx === levels.length - 1}
              onClick={() => {
                const next = [...levels];
                [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                saveLevels(next);
              }}
              className={`px-1.5 py-0.5 bg-transparent border border-gray-200 rounded ${idx === levels.length - 1 ? 'opacity-30 cursor-default' : 'cursor-pointer'}`}
            >▼</button>
            <button type="button"
              onClick={() => saveLevels(levels.filter((_, i) => i !== idx))}
              className="px-1.5 py-0.5 text-red-600 cursor-pointer bg-transparent border border-gray-200 rounded"
            >✕</button>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-2 max-w-[400px]">
        <input
          type="text"
          value={newLevelName}
          onChange={e => setNewLevelName(e.target.value)}
          placeholder="Add custom level..."
          className="flex-1 px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (newLevelName.trim() && !levels.includes(newLevelName.trim())) {
                saveLevels([...levels, newLevelName.trim()]);
                setNewLevelName('');
              }
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (newLevelName.trim() && !levels.includes(newLevelName.trim())) {
              saveLevels([...levels, newLevelName.trim()]);
              setNewLevelName('');
            }
          }}
          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200"
        >
          Add
        </button>
      </div>
    </div>
  </Section>
);

export default RulesAndScoringSection;
