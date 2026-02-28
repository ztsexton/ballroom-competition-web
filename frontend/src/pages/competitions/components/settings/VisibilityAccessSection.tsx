import { Competition } from '../../../../types';
import Section from './Section';
import Toggle from './Toggle';

interface VisibilityAccessSectionProps {
  comp: Competition;
  savedMap: Record<string, boolean>;
  saveField: (field: string, value: unknown, section: string) => void;
}

const VisibilityAccessSection = ({ comp, savedMap, saveField }: VisibilityAccessSectionProps) => (
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

      <Toggle
        value={comp.resultsPublic !== false}
        onChange={v => saveField('resultsPublic', v, 'visibility')}
        label={`Public Results ${comp.resultsPublic !== false ? 'On' : 'Off'}`}
      />

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

export default VisibilityAccessSection;
