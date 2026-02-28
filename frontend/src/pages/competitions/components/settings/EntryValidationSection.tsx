import { Competition } from '../../../../types';
import Section from './Section';
import Toggle from './Toggle';

interface EntryValidationSectionProps {
  comp: Competition;
  savedMap: Record<string, boolean>;
  levels: string[];
  saveField: (field: string, value: unknown, section: string) => void;
}

const EntryValidationSection = ({ comp, savedMap, levels, saveField }: EntryValidationSectionProps) => (
  <Section title="Entry Validation" defaultOpen={false} savedKey="entry" savedMap={savedMap}>
    <p className="text-gray-500 text-sm mb-3">
      Restrict which levels participants can enter based on their declared skill level.
      Admins can always override these restrictions when entering participants manually.
    </p>

    <Toggle
      value={!!comp.entryValidation?.enabled}
      onChange={v => {
        const validation = { ...(comp.entryValidation || { enabled: false, levelsAboveAllowed: 1 }), enabled: v };
        saveField('entryValidation', validation, 'entry');
      }}
      label={`Entry Level Restrictions ${comp.entryValidation?.enabled ? 'Enabled' : 'Disabled'}`}
    />

    {comp.entryValidation?.enabled && (
      <div className="mb-4 mt-4">
        <label className="block text-sm font-semibold text-gray-600 mb-1">Levels Above Allowed</label>
        <input
          type="number"
          min="0"
          max="10"
          value={comp.entryValidation?.levelsAboveAllowed ?? 1}
          onChange={e => {
            const val = e.target.value ? parseInt(e.target.value) : 0;
            const validation = { ...(comp.entryValidation || { enabled: true, levelsAboveAllowed: 1 }), levelsAboveAllowed: val };
            saveField('entryValidation', validation, 'entry');
          }}
          className="w-20 px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
        <small className="text-gray-500 text-sm mt-1 block">
          How many levels above their declared level a participant can enter.
          For example, if set to 2, a Bronze 3 dancer can enter Bronze 3, Bronze 4, and Silver 1.
        </small>

        {levels.length > 0 && (
          <div className="mt-4 bg-gray-100 border border-gray-200 rounded-md p-3">
            <strong className="text-xs uppercase tracking-wide text-gray-500">
              Example
            </strong>
            <p className="text-[0.8125rem] text-gray-600 mt-1.5 mb-1">
              A participant declaring <strong>{levels[0]}</strong> can enter:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {levels.slice(0, 1 + (comp.entryValidation?.levelsAboveAllowed ?? 1)).map((lvl, i) => (
                <span key={i} className="bg-white border border-gray-300 rounded px-2 py-1 text-xs">
                  {lvl}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    )}
  </Section>
);

export default EntryValidationSection;
