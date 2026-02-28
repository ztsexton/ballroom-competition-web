import { Competition, CompetitionType, Organization } from '../../../../types';
import { organizationsApi } from '../../../../api/client';
import Section from './Section';
import { KNOWN_PRESETS, PRESET_TO_TYPE, PRESET_COLORS } from './constants';

interface GeneralSectionProps {
  comp: Competition;
  savedMap: Record<string, boolean>;
  name: string;
  setName: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  organizations: Organization[];
  setOrganizations: React.Dispatch<React.SetStateAction<Organization[]>>;
  saveField: (field: string, value: unknown, section: string) => void;
  saveOnBlur: (field: string, value: string, section: string) => void;
  handleOrgSwitch: (targetOrg: Organization | null, targetType: CompetitionType) => Promise<void>;
  isOrgActive: (targetOrg: Organization | null, targetType: CompetitionType) => boolean;
  confirmOrgSwitch: (label: string, hasOrg: boolean) => boolean;
}

const GeneralSection = ({
  comp,
  savedMap,
  name,
  setName,
  date,
  setDate,
  location,
  setLocation,
  description,
  setDescription,
  organizations,
  setOrganizations,
  saveField,
  saveOnBlur,
  handleOrgSwitch,
  isOrgActive,
  confirmOrgSwitch,
}: GeneralSectionProps) => (
  <Section title="General" savedKey="general" savedMap={savedMap}>
    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-600 mb-1">Competition Name</label>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={() => saveOnBlur('name', name, 'general')}
        className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
      />
    </div>

    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-600 mb-1">Organization</label>
      <div className="flex gap-2 flex-wrap">
        {KNOWN_PRESETS.map(preset => {
          const existingOrg = organizations.find(o => o.rulePresetKey === preset.key);
          const active = existingOrg
            ? comp.organizationId === existingOrg.id
            : (!comp.organizationId && comp.type === PRESET_TO_TYPE[preset.key]);
          return (
            <button
              key={preset.key}
              type="button"
              onClick={async () => {
                let org = existingOrg || null;
                const targetType = PRESET_TO_TYPE[preset.key] || 'UNAFFILIATED';
                if (isOrgActive(org, targetType)) return;
                if (!confirmOrgSwitch(preset.label, true)) return;
                if (!org) {
                  const newOrg = await organizationsApi.create({
                    name: preset.label,
                    rulePresetKey: preset.key,
                    settings: {},
                  });
                  org = newOrg.data;
                  setOrganizations(prev => [...prev, org!]);
                }
                await handleOrgSwitch(org, targetType);
              }}
              className={`px-4 py-2 rounded cursor-pointer transition-all ${active ? 'border-2 font-bold' : 'border border-gray-300 bg-white text-gray-700 font-normal'}`}
              style={{
                borderColor: active ? preset.color : undefined,
                background: active ? preset.color : undefined,
                color: active ? 'white' : undefined,
              }}
            >
              {preset.label}
            </button>
          );
        })}
        {organizations
          .filter(org => !KNOWN_PRESETS.some(p => p.key === org.rulePresetKey))
          .map(org => {
            const active = comp.organizationId === org.id;
            const color = PRESET_COLORS[org.rulePresetKey] || '#6b7280';
            return (
              <button
                key={org.id}
                type="button"
                onClick={() => {
                  const targetType = PRESET_TO_TYPE[org.rulePresetKey] || 'UNAFFILIATED';
                  if (isOrgActive(org, targetType)) return;
                  if (!confirmOrgSwitch(org.name, true)) return;
                  handleOrgSwitch(org, targetType);
                }}
                className={`px-4 py-2 rounded cursor-pointer transition-all ${active ? 'border-2 font-bold' : 'border border-gray-300 bg-white text-gray-700 font-normal'}`}
                style={{
                  borderColor: active ? color : undefined,
                  background: active ? color : undefined,
                  color: active ? 'white' : undefined,
                }}
              >
                {org.name}
              </button>
            );
          })}
        {[
          { type: 'UNAFFILIATED' as CompetitionType, label: 'Unaffiliated', color: '#6b7280' },
          { type: 'STUDIO' as CompetitionType, label: 'Studio', color: '#7c3aed' },
        ].map(opt => {
          const active = !comp.organizationId && comp.type === opt.type;
          return (
            <button
              key={opt.type}
              type="button"
              onClick={() => {
                if (isOrgActive(null, opt.type)) return;
                if (!confirmOrgSwitch(opt.label, false)) return;
                handleOrgSwitch(null, opt.type);
              }}
              className={`px-4 py-2 rounded cursor-pointer transition-all ${active ? 'border-2 font-bold' : 'border border-gray-300 bg-white text-gray-700 font-normal'}`}
              style={{
                borderColor: active ? opt.color : undefined,
                background: active ? opt.color : undefined,
                color: active ? 'white' : undefined,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-600 mb-1">Date</label>
        <input
          type="date"
          value={date}
          onChange={e => {
            setDate(e.target.value);
            saveField('date', e.target.value, 'general');
          }}
          className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-600 mb-1">Location</label>
        <input
          type="text"
          value={location}
          onChange={e => setLocation(e.target.value)}
          onBlur={() => saveOnBlur('location', location, 'general')}
          placeholder="City, State"
          className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
      </div>
    </div>

    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-600 mb-1">Description</label>
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        onBlur={() => saveOnBlur('description', description, 'general')}
        placeholder="Additional details about the competition..."
        rows={3}
        className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
      />
    </div>
  </Section>
);

export default GeneralSection;
