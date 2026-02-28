import { Competition } from '../../../../types';
import Section from './Section';
import Toggle from './Toggle';

interface RecallAdvancementSectionProps {
  comp: Competition;
  savedMap: Record<string, boolean>;
  saveField: (field: string, value: unknown, section: string) => void;
}

const RecallAdvancementSection = ({ comp, savedMap, saveField }: RecallAdvancementSectionProps) => (
  <Section title="Recall & Advancement" defaultOpen={false} savedKey="recall" savedMap={savedMap}>
    <p className="text-gray-500 text-sm mb-3">
      Controls how couples advance between rounds. By default, ties at the cut line are included
      and finals can expand up to 8 couples.
    </p>

    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-600 mb-1">Target Final Size</label>
      <input
        type="number"
        min="2"
        max="20"
        value={comp.recallRules?.finalSize ?? 6}
        onChange={e => {
          const val = e.target.value ? parseInt(e.target.value) : 6;
          const rules = { ...(comp.recallRules || {}), finalSize: val };
          saveField('recallRules', rules, 'recall');
        }}
        className="w-20 px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
      />
      <small className="text-gray-500 text-sm mt-1 block">
        Number of couples to advance to the final round (default: 6).
      </small>
    </div>

    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-600 mb-1">Final Max Size (Hard Limit)</label>
      <input
        type="number"
        min="2"
        max="20"
        value={comp.recallRules?.finalMaxSize ?? 8}
        onChange={e => {
          const val = e.target.value ? parseInt(e.target.value) : 8;
          const rules = { ...(comp.recallRules || {}), finalMaxSize: val };
          saveField('recallRules', rules, 'recall');
        }}
        className="w-20 px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
      />
      <small className="text-gray-500 text-sm mt-1 block">
        Maximum couples allowed in the final, even with ties (default: 8).
        If a tie at the cut line would exceed this limit, only those strictly above the cut line advance.
      </small>
    </div>

    <Toggle
      value={comp.recallRules?.includeTies !== false}
      onChange={v => {
        const rules = { ...(comp.recallRules || {}), includeTies: v };
        saveField('recallRules', rules, 'recall');
      }}
      label={`Include Ties at Cut Line ${comp.recallRules?.includeTies !== false ? 'On' : 'Off'}`}
    />
    <small className="text-gray-500 text-sm mt-1 block mb-2">
      When enabled, all couples tied at the advancement cut line are included (may result in more
      couples than the target). When disabled, exactly the target number advance with no tie expansion.
    </small>
  </Section>
);

export default RecallAdvancementSection;
