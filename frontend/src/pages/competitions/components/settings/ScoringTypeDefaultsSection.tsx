import { Competition, ScoringTypeDefaults } from '../../../../types';
import Section from './Section';

interface ScoringTypeDefaultsSectionProps {
  comp: Competition;
  savedMap: Record<string, boolean>;
  saveField: (field: string, value: unknown, section: string) => void;
}

const CATEGORIES: Array<{ key: keyof ScoringTypeDefaults; label: string; description: string }> = [
  { key: 'single', label: 'Single Dance', description: 'Events with one dance (e.g. Waltz, Tango)' },
  { key: 'multi', label: 'Multi-Dance', description: 'Events with multiple dances (e.g. 3-Dance, 4-Dance)' },
  { key: 'scholarship', label: 'Scholarship', description: 'Scholarship events' },
  { key: 'section', label: 'Section (Split)', description: 'Split events where one person dances with multiple partners (A, B, C sections)' },
];

const ScoringTypeDefaultsSection = ({ comp, savedMap, saveField }: ScoringTypeDefaultsSectionProps) => {
  const defaults = comp.scoringTypeDefaults || {};

  const updateDefault = (key: keyof ScoringTypeDefaults, value: string) => {
    const updated = { ...defaults };
    if (value) {
      updated[key] = value as 'standard' | 'proficiency';
    } else {
      delete updated[key];
    }
    const hasValues = Object.values(updated).some(Boolean);
    saveField('scoringTypeDefaults', hasValues ? updated : undefined, 'scoringDefaults');
  };

  return (
    <Section title="Scoring Type Defaults" defaultOpen={false} savedKey="scoringDefaults" savedMap={savedMap}>
      <p className="text-sm text-gray-500 mb-4">
        Pre-assign scoring types by event category. When configured, the scoring type selector is hidden
        during registration and the correct type is applied automatically.
      </p>

      <div className="space-y-3 max-w-lg">
        {CATEGORIES.map(({ key, label, description }) => (
          <div key={key} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-700">{label}</div>
              <div className="text-xs text-gray-500">{description}</div>
            </div>
            <select
              value={defaults[key] || ''}
              onChange={e => updateDefault(key, e.target.value)}
              className="px-2 py-1.5 border border-gray-200 rounded text-sm bg-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 min-w-[140px]"
            >
              <option value="">Not set</option>
              <option value="standard">Standard (Skating)</option>
              <option value="proficiency">Proficiency</option>
            </select>
          </div>
        ))}
      </div>

      {Object.values(defaults).some(Boolean) && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          Scoring type selector will be hidden from registration forms. The backend will automatically
          apply the configured scoring type when events are created.
          {defaults.section && (
            <span className="block mt-1">
              Section events will use <strong>{defaults.section === 'proficiency' ? 'Proficiency' : 'Standard'}</strong> scoring,
              and existing events will be converted when they first split into sections.
            </span>
          )}
        </div>
      )}
    </Section>
  );
};

export default ScoringTypeDefaultsSection;
