import { Competition, ResultsVisibility } from '../../../../types';
import Section from './Section';
import Toggle from './Toggle';

const DEFAULT_VISIBILITY: ResultsVisibility = {
  singleDanceProficiency: true,
  singleDanceStandard: true,
  multiDanceStandard: true,
  multiDanceProficiency: true,
  scholarship: true,
};

const VISIBILITY_CATEGORIES: Array<{ key: keyof ResultsVisibility; label: string }> = [
  { key: 'singleDanceStandard', label: 'Single Dance — Standard' },
  { key: 'singleDanceProficiency', label: 'Single Dance — Proficiency' },
  { key: 'multiDanceStandard', label: 'Multi-Dance — Standard' },
  { key: 'multiDanceProficiency', label: 'Multi-Dance — Proficiency' },
  { key: 'scholarship', label: 'Scholarship' },
];

interface VisibilityAccessSectionProps {
  comp: Competition;
  savedMap: Record<string, boolean>;
  saveField: (field: string, value: unknown, section: string) => void;
}

const VisibilityAccessSection = ({ comp, savedMap, saveField }: VisibilityAccessSectionProps) => {
  const resultsOn = comp.resultsPublic !== false;
  const visibility = comp.resultsVisibility || DEFAULT_VISIBILITY;

  const updateVisibility = (key: keyof ResultsVisibility, value: boolean) => {
    saveField('resultsVisibility', { ...visibility, [key]: value }, 'visibility');
  };

  return (
    <Section title="Visibility & Access" savedKey="visibility" savedMap={savedMap}>
      <div className="flex flex-col gap-4">
        <div>
          <Toggle
            value={comp.publiclyVisible !== false}
            onChange={v => saveField('publiclyVisible', v, 'visibility')}
            label={`Public Visibility ${comp.publiclyVisible !== false ? 'On' : 'Off'}`}
          />
          {!comp.publiclyVisible && (
            <div className="ml-[3.25rem] mt-1.5">
              <label className="text-xs text-gray-500 block mb-1">
                Schedule visibility for:
              </label>
              <input
                type="datetime-local"
                value={comp.publiclyVisibleAt || ''}
                onChange={e => saveField('publiclyVisibleAt', e.target.value || null, 'visibility')}
                className="px-2 py-1 rounded border border-gray-200 text-[0.8125rem] focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
              {comp.publiclyVisibleAt && (
                <button
                  type="button"
                  onClick={() => saveField('publiclyVisibleAt', null, 'visibility')}
                  className="ml-2 text-xs text-red-600 bg-transparent border-none cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <Toggle
            value={!!comp.registrationOpen}
            onChange={v => saveField('registrationOpen', v, 'visibility')}
            label={`Participant Registration ${comp.registrationOpen ? 'Open' : 'Closed'}`}
          />
          {!comp.registrationOpen && (
            <div className="ml-[3.25rem] mt-1.5">
              <label className="text-xs text-gray-500 block mb-1">
                Schedule registration to open:
              </label>
              <input
                type="datetime-local"
                value={comp.registrationOpenAt || ''}
                onChange={e => saveField('registrationOpenAt', e.target.value || null, 'visibility')}
                className="px-2 py-1 rounded border border-gray-200 text-[0.8125rem] focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
              {comp.registrationOpenAt && (
                <button
                  type="button"
                  onClick={() => saveField('registrationOpenAt', null, 'visibility')}
                  className="ml-2 text-xs text-red-600 bg-transparent border-none cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <Toggle
            value={resultsOn}
            onChange={v => saveField('resultsPublic', v, 'visibility')}
            label={`Public Results ${resultsOn ? 'On' : 'Off'}`}
          />
          {resultsOn && (
            <div className="ml-[3.25rem] mt-2">
              <p className="text-xs text-gray-500 mb-2">
                Choose which event categories have publicly visible results.
              </p>
              <div className="flex flex-col gap-1.5">
                {VISIBILITY_CATEGORIES.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={visibility[key]}
                      onChange={(e) => updateVisibility(key, e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <Toggle
            value={!!comp.heatListsPublished}
            onChange={v => saveField('heatListsPublished', v, 'visibility')}
            label={`Heat Lists ${comp.heatListsPublished ? 'Published' : 'Draft'}`}
          />
          {!comp.heatListsPublished && (
            <div className="ml-[3.25rem] mt-1.5">
              <p className="text-xs text-gray-500 mb-1.5">
                Heat lists are only visible to admins until published.
              </p>
              <label className="text-xs text-gray-500 block mb-1">
                Schedule publish for:
              </label>
              <input
                type="datetime-local"
                value={comp.heatListsPublishedAt || ''}
                onChange={e => saveField('heatListsPublishedAt', e.target.value || null, 'visibility')}
                className="px-2 py-1 rounded border border-gray-200 text-[0.8125rem] focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
              {comp.heatListsPublishedAt && (
                <button
                  type="button"
                  onClick={() => saveField('heatListsPublishedAt', null, 'visibility')}
                  className="ml-2 text-xs text-red-600 bg-transparent border-none cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
};

export default VisibilityAccessSection;
