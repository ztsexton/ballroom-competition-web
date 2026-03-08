import { Competition } from '../../../../types';
import Section from './Section';
import Toggle from './Toggle';

interface EntryValidationSectionProps {
  comp: Competition;
  savedMap: Record<string, boolean>;
  levels: string[];
  saveField: (field: string, value: unknown, section: string) => void;
}

function getMainLevel(level: string): string {
  const match = level.match(/^(.+?)\s+\d+$/);
  return match ? match[1] : level;
}

function groupLevelsByMain(levels: string[]): Array<{ mainLevel: string; subLevels: string[] }> {
  const groups: Array<{ mainLevel: string; subLevels: string[] }> = [];
  const seen = new Map<string, number>();
  for (const level of levels) {
    const main = getMainLevel(level);
    if (seen.has(main)) {
      groups[seen.get(main)!].subLevels.push(level);
    } else {
      seen.set(main, groups.length);
      groups.push({ mainLevel: main, subLevels: [level] });
    }
  }
  return groups;
}

function getExampleAllowed(levels: string[], levelsAbove: number, mode: 'sublevel' | 'mainlevel'): string[] {
  if (levels.length === 0) return [];
  if (mode === 'mainlevel') {
    const groups = groupLevelsByMain(levels);
    if (groups.length === 0) return [];
    const maxGroupIdx = Math.min(levelsAbove, groups.length - 1);
    const allowed: string[] = [];
    for (let i = 0; i <= maxGroupIdx; i++) {
      allowed.push(...groups[i].subLevels);
    }
    return allowed;
  }
  return levels.slice(0, 1 + levelsAbove);
}

const EntryValidationSection = ({ comp, savedMap, levels, saveField }: EntryValidationSectionProps) => {
  const mode = comp.entryValidation?.levelRestrictionMode || 'sublevel';
  const levelsAbove = comp.entryValidation?.levelsAboveAllowed ?? 1;
  const hasSubLevels = levels.some(l => /\s+\d+$/.test(l));

  const exampleAllowed = getExampleAllowed(levels, levelsAbove, mode);

  return (
    <Section title="Entry Validation" defaultOpen={false} savedKey="entry" savedMap={savedMap}>
      <p className="text-gray-500 text-sm mb-3">
        Restrict which levels participants can enter based on their existing entries.
        Level is inferred from what events they've signed up for. Entries outside their range
        go to an approval queue for admin review.
      </p>

      <Toggle
        value={!!comp.entryValidation?.enabled}
        onChange={v => {
          const validation = { ...(comp.entryValidation || { enabled: false, levelsAboveAllowed: 1, levelRestrictionMode: 'sublevel' as const }), enabled: v };
          saveField('entryValidation', validation, 'entry');
        }}
        label={`Entry Level Restrictions ${comp.entryValidation?.enabled ? 'Enabled' : 'Disabled'}`}
      />

      {comp.entryValidation?.enabled && (
        <div className="mb-4 mt-4 space-y-4">
          {/* Mode selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-2">Level Restriction Mode</label>
            <div className="flex flex-col gap-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="levelRestrictionMode"
                  value="sublevel"
                  checked={mode === 'sublevel'}
                  onChange={() => {
                    const validation = { ...comp.entryValidation!, levelRestrictionMode: 'sublevel' as const };
                    saveField('entryValidation', validation, 'entry');
                  }}
                  className="mt-1"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Individual levels</span>
                  <p className="text-xs text-gray-500">
                    Each level counts separately. {hasSubLevels ? 'e.g., Bronze 1 → Bronze 2 is one level up.' : 'e.g., Bronze → Silver is one level up.'}
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="levelRestrictionMode"
                  value="mainlevel"
                  checked={mode === 'mainlevel'}
                  onChange={() => {
                    const validation = { ...comp.entryValidation!, levelRestrictionMode: 'mainlevel' as const };
                    saveField('entryValidation', validation, 'entry');
                  }}
                  className="mt-1"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Main level groups</span>
                  <p className="text-xs text-gray-500">
                    Sub-levels are grouped under their main level. {hasSubLevels ? 'e.g., a Bronze 1 dancer can enter any Bronze and Silver events with 1 level above.' : 'Groups levels by name prefix.'}
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Levels above */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">
              {mode === 'mainlevel' ? 'Main Levels Above Allowed' : 'Levels Above Allowed'}
            </label>
            <input
              type="number"
              min="0"
              max="10"
              value={levelsAbove}
              onChange={e => {
                const val = e.target.value ? parseInt(e.target.value) : 0;
                const validation = { ...comp.entryValidation!, levelsAboveAllowed: val };
                saveField('entryValidation', validation, 'entry');
              }}
              className="w-20 px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
            <small className="text-gray-500 text-sm mt-1 block">
              {mode === 'mainlevel'
                ? `How many main level groups above their current entry level a participant can enter. All sub-levels within each allowed group are available.`
                : `How many individual levels above their current entry level a participant can enter.`}
            </small>
          </div>

          {/* Example */}
          {levels.length > 0 && (
            <div className="bg-gray-100 border border-gray-200 rounded-md p-3">
              <strong className="text-xs uppercase tracking-wide text-gray-500">
                Example
              </strong>
              <p className="text-[0.8125rem] text-gray-600 mt-1.5 mb-1">
                A participant declaring <strong>{levels[0]}</strong> can enter:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {exampleAllowed.map((lvl, i) => (
                  <span key={i} className="bg-white border border-gray-300 rounded px-2 py-1 text-xs">
                    {lvl}
                  </span>
                ))}
              </div>
              {exampleAllowed.length === 0 && (
                <p className="text-xs text-red-500 mt-1">No levels would be allowed with this configuration.</p>
              )}
            </div>
          )}
        </div>
      )}
    </Section>
  );
};

export default EntryValidationSection;
