import { Competition, AgeCategory, Organization } from '../../../../types';
import Section from './Section';

interface AgeCategoriesSectionProps {
  comp: Competition;
  savedMap: Record<string, boolean>;
  organizations: Organization[];
  orgName: string;
  ageCategories: AgeCategory[];
  setAgeCategories: React.Dispatch<React.SetStateAction<AgeCategory[]>>;
  saveAgeCategories: (cats: AgeCategory[]) => void;
}

const AgeCategoriesSection = ({
  comp,
  savedMap,
  organizations,
  orgName,
  ageCategories,
  setAgeCategories,
  saveAgeCategories,
}: AgeCategoriesSectionProps) => (
  <Section title="Age Categories" defaultOpen={false} savedKey="age" savedMap={savedMap}>
    <div>
      {comp.organizationId && orgName && (
        <p className="text-gray-500 text-sm mb-3">
          Preset from <strong>{orgName}</strong>. You can customize below for this competition.
        </p>
      )}

      <div className="flex gap-2 flex-wrap mb-3">
        {comp.organizationId && (() => {
          const org = organizations.find(o => o.id === comp.organizationId);
          const orgCats = org?.settings.ageCategories || [];
          return orgCats.length > 0 ? (
            <button
              type="button"
              onClick={() => saveAgeCategories(orgCats.map(c => ({ ...c })))}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200"
            >
              Reset to {orgName} Defaults
            </button>
          ) : null;
        })()}
        <button
          type="button"
          onClick={() => saveAgeCategories([...ageCategories, { name: '' }])}
          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200"
        >
          + Add Category
        </button>
      </div>

      {comp.organizationId && (() => {
        const org = organizations.find(o => o.id === comp.organizationId);
        const orgCats = org?.settings.ageCategories || [];
        return orgCats.length > 0 ? (
          <div className="bg-gray-100 border border-gray-200 rounded-md p-3 mb-3 text-[0.8125rem] text-gray-600">
            <strong className="text-xs uppercase tracking-wide text-gray-500">
              {orgName} Defaults
            </strong>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {orgCats.map((cat, i) => (
                <span key={i} className="bg-white border border-gray-300 rounded px-2 py-1 text-xs">
                  {cat.name}
                  {(cat.minAge != null || cat.maxAge != null) && (
                    <span className="text-gray-400 ml-1">
                      ({cat.minAge != null && cat.maxAge != null
                        ? `${cat.minAge}-${cat.maxAge}`
                        : cat.maxAge != null
                          ? `≤${cat.maxAge}`
                          : `${cat.minAge}+`})
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        ) : null;
      })()}

      {ageCategories.length === 0 ? (
        <p className="text-gray-400 text-sm">
          No age categories configured.
          {comp.organizationId ? ' Click "Reset to Defaults" to load from the organization preset.' : ' Add categories manually or select an organization above.'}
        </p>
      ) : (
        <div className="grid gap-2 max-w-[500px]">
          {ageCategories.map((cat, idx) => (
            <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center">
              <input
                type="text"
                value={cat.name}
                placeholder="Name"
                onChange={e => {
                  const updated = [...ageCategories];
                  updated[idx] = { ...updated[idx], name: e.target.value };
                  setAgeCategories(updated);
                }}
                onBlur={() => saveAgeCategories(ageCategories)}
                className="px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
              <input
                type="number"
                value={cat.minAge ?? ''}
                placeholder="Min age"
                onChange={e => {
                  const updated = [...ageCategories];
                  updated[idx] = { ...updated[idx], minAge: e.target.value ? parseInt(e.target.value) : undefined };
                  setAgeCategories(updated);
                }}
                onBlur={() => saveAgeCategories(ageCategories)}
                className="px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
              <input
                type="number"
                value={cat.maxAge ?? ''}
                placeholder="Max age"
                onChange={e => {
                  const updated = [...ageCategories];
                  updated[idx] = { ...updated[idx], maxAge: e.target.value ? parseInt(e.target.value) : undefined };
                  setAgeCategories(updated);
                }}
                onBlur={() => saveAgeCategories(ageCategories)}
                className="px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={() => saveAgeCategories(ageCategories.filter((_, i) => i !== idx))}
                className="px-2 py-1 bg-transparent border border-gray-200 rounded text-red-600 cursor-pointer text-sm"
              >
                X
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  </Section>
);

export default AgeCategoriesSection;
