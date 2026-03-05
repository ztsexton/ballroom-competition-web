import { Competition } from '../../../../types';
import Section from './Section';
import Toggle from './Toggle';

interface DuplicateEntriesSectionProps {
  comp: Competition;
  savedMap: Record<string, boolean>;
  saveField: (field: string, value: unknown, section: string) => void;
}

const DuplicateEntriesSection = ({ comp, savedMap, saveField }: DuplicateEntriesSectionProps) => (
  <Section title="Duplicate Entries" defaultOpen={false} savedKey="duplicate" savedMap={savedMap}>
    <p className="text-gray-500 text-sm mb-3">
      When enabled, the same person can be registered in multiple couples for the same event type.
      Separate sections (A, B, C) are created automatically so the same person never dances simultaneously.
    </p>

    <Toggle
      value={!!comp.allowDuplicateEntries}
      onChange={v => saveField('allowDuplicateEntries', v, 'duplicate')}
      label={`Allow Duplicate Event Registration ${comp.allowDuplicateEntries ? 'On' : 'Off'}`}
    />
  </Section>
);

export default DuplicateEntriesSection;
