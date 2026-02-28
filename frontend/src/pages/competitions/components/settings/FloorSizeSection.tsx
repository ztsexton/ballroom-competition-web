import { Competition } from '../../../../types';
import Section from './Section';

interface FloorSizeSectionProps {
  comp: Competition;
  savedMap: Record<string, boolean>;
  levels: string[];
  saveField: (field: string, value: unknown, section: string) => void;
}

const FloorSizeSection = ({ comp, savedMap, levels, saveField }: FloorSizeSectionProps) => (
  <Section title="Floor Size" defaultOpen={false} savedKey="floor" savedMap={savedMap}>
    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-600 mb-1">Default Max Couples on Floor</label>
      <input
        type="number"
        min="1"
        value={comp.maxCouplesOnFloor || ''}
        onChange={e => {
          const val = e.target.value ? parseInt(e.target.value) : undefined;
          saveField('maxCouplesOnFloor', val, 'floor');
        }}
        placeholder="No limit"
        className="w-[120px] px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
      />
      <small className="text-gray-500 text-sm mt-1 block">
        When a round has more couples than this limit, it will be split into multiple floor heats.
        Each floor heat is scored independently. Leave empty for no automatic splitting.
      </small>
    </div>

    {levels.length > 0 && (
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-600 mb-1">Per-Level Overrides</label>
        <p className="text-gray-500 text-sm mb-2">
          Set a different floor limit for specific levels. Empty uses the default above.
        </p>
        <div className="flex flex-col gap-1.5 max-w-[400px]">
          {levels.map(lvl => (
            <div key={lvl} className="flex items-center gap-3 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded">
              <span className="flex-1 text-sm font-medium">{lvl}</span>
              <input
                type="number"
                min="1"
                value={comp.maxCouplesOnFloorByLevel?.[lvl] || ''}
                onChange={e => {
                  const val = e.target.value ? parseInt(e.target.value) : undefined;
                  const updated = { ...(comp.maxCouplesOnFloorByLevel || {}) };
                  if (val) {
                    updated[lvl] = val;
                  } else {
                    delete updated[lvl];
                  }
                  saveField('maxCouplesOnFloorByLevel', Object.keys(updated).length > 0 ? updated : undefined, 'floor');
                }}
                placeholder={comp.maxCouplesOnFloor ? `${comp.maxCouplesOnFloor}` : '—'}
                className="w-20 px-1.5 py-1.5 border border-gray-200 rounded text-sm text-center focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
          ))}
        </div>
      </div>
    )}
  </Section>
);

export default FloorSizeSection;
