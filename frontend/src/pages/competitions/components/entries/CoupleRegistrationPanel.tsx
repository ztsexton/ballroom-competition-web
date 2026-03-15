import { useState, useMemo } from 'react';
import { Competition, Event, EventTemplate } from '../../../../types';
import { DEFAULT_LEVELS } from '../../../../constants/levels';
import { getAvailableStyles } from '../../../../constants/dances';
import { RegistrationState, StyleSelections } from '../../hooks/useRegistrationPanel';

interface CoupleRegistrationPanelProps {
  bib: number;
  activeCompetition: Competition | null;
  registration: RegistrationState;
}

const toggleBtnClass = (active: boolean) =>
  active
    ? 'px-3 py-1.5 rounded border-2 border-primary-500 bg-primary-500 text-white cursor-pointer font-semibold text-sm transition-all'
    : 'px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 cursor-pointer font-normal text-sm transition-all';

const styleBtnClass = (active: boolean) =>
  active
    ? 'px-4 py-2 rounded-lg border-2 border-primary-500 bg-primary-50 text-primary-700 cursor-pointer font-semibold text-sm transition-all'
    : 'px-4 py-2 rounded-lg border-2 border-gray-200 bg-white text-gray-600 cursor-pointer font-medium text-sm transition-all hover:border-gray-300 hover:bg-gray-50';

type EventSortMode = 'name' | 'entry-order';

function sortEvents(events: Event[], mode: EventSortMode): Event[] {
  if (mode === 'entry-order') {
    return [...events].sort((a, b) => a.id - b.id);
  }
  return [...events].sort((a, b) => a.name.localeCompare(b.name));
}

const emptyStyleSelections = (): StyleSelections => ({
  levels: [],
  ageCategories: [],
  singleDances: [],
  templateIds: [],
  scholLevels: [],
  scholAgeCategories: [],
  scholTemplateIds: [],
});

/** Compute total entries across all styles */
function computeMultiStyleEntryCount(
  perStyleSelections: Record<string, StyleSelections>,
  templates: EventTemplate[],
  scholTemplates: EventTemplate[],
): number {
  let total = 0;
  for (const [, sel] of Object.entries(perStyleSelections)) {
    const ageCatCount = sel.ageCategories.length > 0 ? sel.ageCategories.length : 1;

    // Single dances (leveled)
    if (sel.levels.length > 0 && sel.singleDances.length > 0) {
      total += ageCatCount * sel.levels.length * sel.singleDances.length;
    }

    // Multi-dance templates
    for (const tplId of sel.templateIds) {
      const tpl = templates.find(t => t.id === tplId);
      if (!tpl) continue;
      if (tpl.noLevel) {
        total += ageCatCount;
      } else if (sel.levels.length > 0) {
        total += ageCatCount * sel.levels.length;
      }
    }

    // Scholarship
    const scholAgeCatCount = sel.scholAgeCategories.length > 0 ? sel.scholAgeCategories.length : 1;
    if (sel.scholLevels.length > 0 && sel.scholTemplateIds.length > 0) {
      const validSchol = sel.scholTemplateIds.filter(id => scholTemplates.some(t => t.id === id));
      total += scholAgeCatCount * sel.scholLevels.length * validSchol.length;
    }
  }
  return total;
}

/* ─── Per-style section for Single Dances ─── */
function StyleSingleDancePanel({
  style,
  sel,
  dances,
  levels,
  ageCategories,
  toggleItem,
  setField,
}: {
  style: string;
  sel: StyleSelections;
  dances: string[];
  levels: string[];
  ageCategories: { name: string }[];
  toggleItem: (field: keyof StyleSelections, item: string) => void;
  setField: <K extends keyof StyleSelections>(field: K, value: StyleSelections[K]) => void;
}) {
  return (
    <div className="pl-3 border-l-2 border-primary-200 flex flex-col gap-2 py-2">
      {ageCategories.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Age Categories {sel.ageCategories.length > 0 && <span className="text-primary-500">({sel.ageCategories.length})</span>}
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {ageCategories.map(cat => (
              <button key={cat.name} type="button" className={toggleBtnClass(sel.ageCategories.includes(cat.name))}
                onClick={() => toggleItem('ageCategories', cat.name)}>
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">
          Levels {sel.levels.length > 0 && <span className="text-primary-500">({sel.levels.length})</span>}
        </label>
        <div className="flex gap-1.5 flex-wrap">
          {levels.map(opt => (
            <button key={opt} type="button" className={toggleBtnClass(sel.levels.includes(opt))}
              onClick={() => toggleItem('levels', opt)}>
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="block text-xs font-semibold text-gray-500">
            Dances {sel.singleDances.length > 0 && <span className="text-primary-500">({sel.singleDances.length})</span>}
          </label>
          <button
            type="button"
            className="text-xs text-primary-500 hover:text-primary-700 cursor-pointer font-medium"
            onClick={() => {
              if (sel.singleDances.length === dances.length) {
                setField('singleDances', []);
              } else {
                setField('singleDances', [...dances]);
              }
            }}
          >
            {sel.singleDances.length === dances.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {dances.map(d => (
            <button key={d} type="button" className={toggleBtnClass(sel.singleDances.includes(d))}
              onClick={() => toggleItem('singleDances', d)}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Per-style entry count hint */}
      {sel.levels.length > 0 && sel.singleDances.length > 0 && (
        <div className="text-xs text-gray-400">
          {sel.ageCategories.length > 1 ? `${sel.ageCategories.length} age × ` : ''}
          {sel.levels.length} level{sel.levels.length !== 1 ? 's' : ''} × {sel.singleDances.length} dance{sel.singleDances.length !== 1 ? 's' : ''}
          {' '}= {(sel.ageCategories.length || 1) * sel.levels.length * sel.singleDances.length} {style} entries
        </div>
      )}
    </div>
  );
}

/* ─── Per-style section for Multi-Dance + Scholarship ─── */
function StyleMultiDancePanel({
  style,
  sel,
  levels,
  ageCategories,
  templates,
  noLevelTemplates,
  scholTemplates,
  scholLevelOptions,
  toggleItem,
}: {
  style: string;
  sel: StyleSelections;
  levels: string[];
  ageCategories: { name: string }[];
  templates: EventTemplate[];
  noLevelTemplates: EventTemplate[];
  scholTemplates: EventTemplate[];
  scholLevelOptions: string[];
  toggleItem: (field: keyof StyleSelections, item: string) => void;
}) {
  const hasRegularTemplates = templates.length > 0 || noLevelTemplates.length > 0;
  const hasScholTemplates = scholTemplates.length > 0;

  if (!hasRegularTemplates && !hasScholTemplates) {
    return (
      <div className="pl-3 border-l-2 border-primary-200 py-2">
        <p className="text-gray-400 text-xs">No multi-dance or scholarship templates configured for {style}.</p>
      </div>
    );
  }

  return (
    <div className="pl-3 border-l-2 border-primary-200 flex flex-col gap-3 py-2">
      {/* Regular Multi-Dance */}
      {hasRegularTemplates && (
        <div className="flex flex-col gap-2">
          {ageCategories.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Age Categories {sel.ageCategories.length > 0 && <span className="text-primary-500">({sel.ageCategories.length})</span>}
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {ageCategories.map(cat => (
                  <button key={cat.name} type="button" className={toggleBtnClass(sel.ageCategories.includes(cat.name))}
                    onClick={() => toggleItem('ageCategories', cat.name)}>
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Levels {sel.levels.length > 0 && <span className="text-primary-500">({sel.levels.length})</span>}
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {levels.map(opt => (
                <button key={opt} type="button" className={toggleBtnClass(sel.levels.includes(opt))}
                  onClick={() => toggleItem('levels', opt)}>
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {templates.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Multi-Dance Templates {sel.templateIds.filter(id => templates.some(t => t.id === id)).length > 0 && (
                  <span className="text-primary-500">({sel.templateIds.filter(id => templates.some(t => t.id === id)).length})</span>
                )}
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {templates.map(tpl => (
                  <button
                    key={tpl.id}
                    type="button"
                    className={sel.templateIds.includes(tpl.id)
                      ? 'px-3 py-1.5 rounded border-2 border-primary-500 bg-primary-50 text-primary-700 cursor-pointer font-semibold text-sm transition-all'
                      : 'px-3 py-1.5 rounded border-2 border-dashed border-primary-300 bg-white text-primary-600 cursor-pointer font-medium text-sm transition-all hover:bg-primary-50'
                    }
                    onClick={() => toggleItem('templateIds', tpl.id)}
                  >
                    {tpl.name}
                    <span className="text-xs ml-1 opacity-70">({tpl.dances.length})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {noLevelTemplates.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Open / No Level {sel.templateIds.filter(id => noLevelTemplates.some(t => t.id === id)).length > 0 && (
                  <span className="text-teal-600">({sel.templateIds.filter(id => noLevelTemplates.some(t => t.id === id)).length})</span>
                )}
              </label>
              <p className="text-gray-400 text-xs mb-1">Register without a level — open to all.</p>
              <div className="flex gap-1.5 flex-wrap">
                {noLevelTemplates.map(tpl => (
                  <button
                    key={tpl.id}
                    type="button"
                    className={sel.templateIds.includes(tpl.id)
                      ? 'px-3 py-1.5 rounded border-2 border-teal-500 bg-teal-50 text-teal-700 cursor-pointer font-semibold text-sm transition-all'
                      : 'px-3 py-1.5 rounded border-2 border-dashed border-teal-300 bg-white text-teal-600 cursor-pointer font-medium text-sm transition-all hover:bg-teal-50'
                    }
                    onClick={() => toggleItem('templateIds', tpl.id)}
                  >
                    {tpl.name}
                    <span className="text-xs ml-1 opacity-70">({tpl.dances.length})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Entry count hint */}
          {(() => {
            const leveledCount = sel.templateIds.filter(id => templates.some(t => t.id === id)).length;
            const noLevelCount = sel.templateIds.filter(id => noLevelTemplates.some(t => t.id === id)).length;
            const ageCatCount = sel.ageCategories.length || 1;
            const leveledTotal = sel.levels.length > 0 && leveledCount > 0 ? ageCatCount * sel.levels.length * leveledCount : 0;
            const noLevelTotal = noLevelCount > 0 ? ageCatCount * noLevelCount : 0;
            const styleTotal = leveledTotal + noLevelTotal;
            if (styleTotal === 0) return null;
            return (
              <div className="text-xs text-gray-400">
                {styleTotal} {style} multi-dance entr{styleTotal !== 1 ? 'ies' : 'y'}
              </div>
            );
          })()}
        </div>
      )}

      {/* Scholarship */}
      {hasScholTemplates && (
        <div className="pt-2 border-t border-amber-200 flex flex-col gap-2">
          <h6 className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Scholarship</h6>

          {ageCategories.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Age Categories {sel.scholAgeCategories.length > 0 && <span className="text-amber-500">({sel.scholAgeCategories.length})</span>}
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {ageCategories.map(cat => (
                  <button key={cat.name} type="button"
                    className={sel.scholAgeCategories.includes(cat.name)
                      ? 'px-3 py-1.5 rounded border-2 border-amber-500 bg-amber-500 text-white cursor-pointer font-semibold text-sm transition-all'
                      : 'px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 cursor-pointer font-normal text-sm transition-all'
                    }
                    onClick={() => toggleItem('scholAgeCategories', cat.name)}>
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Levels {sel.scholLevels.length > 0 && <span className="text-amber-500">({sel.scholLevels.length})</span>}
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {scholLevelOptions.map(opt => (
                <button key={opt} type="button"
                  className={sel.scholLevels.includes(opt)
                    ? 'px-3 py-1.5 rounded border-2 border-amber-500 bg-amber-500 text-white cursor-pointer font-semibold text-sm transition-all'
                    : 'px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 cursor-pointer font-normal text-sm transition-all'
                  }
                  onClick={() => toggleItem('scholLevels', opt)}>
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Templates {sel.scholTemplateIds.length > 0 && <span className="text-amber-500">({sel.scholTemplateIds.length})</span>}
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {scholTemplates.map(tpl => (
                <button
                  key={tpl.id}
                  type="button"
                  className={sel.scholTemplateIds.includes(tpl.id)
                    ? 'px-3 py-1.5 rounded border-2 border-amber-500 bg-amber-50 text-amber-700 cursor-pointer font-semibold text-sm transition-all'
                    : 'px-3 py-1.5 rounded border-2 border-dashed border-amber-300 bg-white text-amber-600 cursor-pointer font-medium text-sm transition-all hover:bg-amber-50'
                  }
                  onClick={() => toggleItem('scholTemplateIds', tpl.id)}
                >
                  {tpl.name}
                  <span className="text-xs ml-1 opacity-70">({tpl.dances.length})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Scholarship entry count hint */}
          {sel.scholLevels.length > 0 && sel.scholTemplateIds.length > 0 && (() => {
            const scholTotal = (sel.scholAgeCategories.length || 1) * sel.scholLevels.length * sel.scholTemplateIds.length;
            return (
              <div className="text-xs text-amber-500">
                {scholTotal} {style} scholarship entr{scholTotal !== 1 ? 'ies' : 'y'}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

/* ─── Main Panel ─── */

const CoupleRegistrationPanel = ({ bib, activeCompetition, registration }: CoupleRegistrationPanelProps) => {
  const [eventSort, setEventSort] = useState<EventSortMode>('name');
  const {
    regDesignation, setRegDesignation,
    regSyllabusType, setRegSyllabusType,
    regLevel, setRegLevel,
    regStyle, setRegStyle,
    regDances, setRegDances,
    regScoringType, setRegScoringType,
    regIsScholarship, setRegIsScholarship,
    regAgeCategory, setRegAgeCategory,
    availableAgeCategories,
    regLoading, regMessage, regError,
    coupleEvents, coupleEventsLoading,
    getDanceOptions, handleRegister, handleRemoveEntry,
    hasScoringDefaults,
    bulkResults,
    // Multi-style
    expandedSingleStyles, expandedMultiStyles,
    perStyleSelections,
    toggleSingleStyle, toggleMultiStyle,
    setStyleField, toggleStyleArrayItem,
    handleMultiStyleRegister,
  } = registration;

  const templates = activeCompetition?.eventTemplates || [];
  const scholTemplateOptions = activeCompetition?.scholarshipTemplates || [];
  const hasBatchMode = templates.length > 0;
  const levels = activeCompetition?.levels?.length ? activeCompetition.levels : DEFAULT_LEVELS;
  const scholLevelOptions = activeCompetition?.scholarshipLevels?.length
    ? activeCompetition.scholarshipLevels
    : levels;
  const styles = getAvailableStyles(activeCompetition?.danceOrder);
  const isIntegrated = (activeCompetition?.levelMode || 'combined') === 'integrated';

  // Total multi-style entry count
  const multiStyleEntryCount = useMemo(
    () => computeMultiStyleEntryCount(perStyleSelections, templates, scholTemplateOptions),
    [perStyleSelections, templates, scholTemplateOptions]
  );

  // Helper to get templates for a style
  const getStyleTemplates = (style: string) => templates.filter((t: EventTemplate) => t.style === style && !t.noLevel);
  const getStyleNoLevelTemplates = (style: string) => templates.filter((t: EventTemplate) => t.style === style && t.noLevel);
  const getStyleScholTemplates = (style: string) => scholTemplateOptions.filter((t: EventTemplate) => t.style === style);

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-3">
      <h4 className="mt-0 mb-3 text-gray-600">
        Register #{bib} for events
      </h4>

      {regError && <div className="text-danger-500 mt-2 mb-2">{regError}</div>}
      {regMessage && (
        <div className="bg-green-200 text-green-800 px-3 py-2 rounded mb-3 text-sm">
          {regMessage}
        </div>
      )}

      {/* Bulk results detail */}
      {bulkResults.length > 0 && (
        <div className="mb-3 text-xs space-y-0.5 max-h-40 overflow-y-auto">
          {bulkResults.map((r, i) => (
            <div key={i} className={r.success ? 'text-green-700' : 'text-red-600'}>
              {r.success ? (r.created ? '+ Created' : '= Joined') : '✕ Failed'}{' '}
              <span className="font-medium">{r.label}</span>
              {r.error && <span className="text-gray-500 ml-1">({r.error})</span>}
            </div>
          ))}
        </div>
      )}

      {hasBatchMode ? (
        /* ─── Multi-Style Registration Mode ─── */
        <div className="flex flex-col gap-4">
          {/* Shared fields */}
          <div className="flex flex-col gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Designation</label>
              <div className="flex gap-1.5 flex-wrap">
                {['Pro-Am', 'Amateur', 'Professional', 'Student'].map(opt => (
                  <button key={opt} type="button" className={toggleBtnClass(regDesignation === opt)}
                    onClick={() => setRegDesignation(regDesignation === opt ? '' : opt)}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {!isIntegrated && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Syllabus Type</label>
                <div className="flex gap-1.5 flex-wrap">
                  {['Syllabus', 'Open'].map(opt => (
                    <button key={opt} type="button" className={toggleBtnClass(regSyllabusType === opt)}
                      onClick={() => setRegSyllabusType(regSyllabusType === opt ? '' : opt)}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!hasScoringDefaults && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Scoring</label>
                <div className="flex gap-1.5">
                  {(['standard', 'proficiency'] as const).map(opt => (
                    <button key={opt} type="button" className={toggleBtnClass(regScoringType === opt)}
                      onClick={() => setRegScoringType(opt)}>
                      {opt === 'standard' ? 'Standard' : 'Proficiency'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ═══ Single Dances Section ═══ */}
          <div>
            <h5 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              Single Dances
              <span className="text-xs font-normal text-gray-400">Select styles to expand</span>
            </h5>
            <div className="flex gap-2 flex-wrap mb-2">
              {styles.map(style => (
                <button
                  key={style}
                  type="button"
                  className={styleBtnClass(expandedSingleStyles.includes(style))}
                  onClick={() => toggleSingleStyle(style)}
                >
                  {style}
                  {(() => {
                    const sel = perStyleSelections[style];
                    if (!sel || sel.singleDances.length === 0) return null;
                    return <span className="text-xs ml-1 text-primary-500">({sel.singleDances.length})</span>;
                  })()}
                </button>
              ))}
            </div>

            {expandedSingleStyles.map(style => (
              <div key={style} className="mb-3">
                <div className="text-xs font-semibold text-primary-600 mb-1">{style}</div>
                <StyleSingleDancePanel
                  style={style}
                  sel={perStyleSelections[style] || emptyStyleSelections()}
                  dances={getDanceOptions(style)}
                  levels={levels}
                  ageCategories={availableAgeCategories}
                  toggleItem={(field, item) => toggleStyleArrayItem(style, field, item)}
                  setField={(field, value) => setStyleField(style, field, value)}
                />
              </div>
            ))}
          </div>

          {/* ═══ Multi-Dance / Scholarship Section ═══ */}
          <div>
            <h5 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              Multi-Dance & Scholarships
              <span className="text-xs font-normal text-gray-400">Select styles to expand</span>
            </h5>
            <div className="flex gap-2 flex-wrap mb-2">
              {styles.map(style => {
                const styleHasContent = getStyleTemplates(style).length > 0 ||
                  getStyleNoLevelTemplates(style).length > 0 ||
                  getStyleScholTemplates(style).length > 0;
                if (!styleHasContent) return null;
                return (
                  <button
                    key={style}
                    type="button"
                    className={styleBtnClass(expandedMultiStyles.includes(style))}
                    onClick={() => toggleMultiStyle(style)}
                  >
                    {style}
                    {(() => {
                      const sel = perStyleSelections[style];
                      if (!sel) return null;
                      const count = sel.templateIds.length + sel.scholTemplateIds.length;
                      if (count === 0) return null;
                      return <span className="text-xs ml-1 text-primary-500">({count})</span>;
                    })()}
                  </button>
                );
              })}
            </div>

            {expandedMultiStyles.map(style => (
              <div key={style} className="mb-3">
                <div className="text-xs font-semibold text-primary-600 mb-1">{style}</div>
                <StyleMultiDancePanel
                  style={style}
                  sel={perStyleSelections[style] || emptyStyleSelections()}
                  levels={levels}
                  ageCategories={availableAgeCategories}
                  templates={getStyleTemplates(style)}
                  noLevelTemplates={getStyleNoLevelTemplates(style)}
                  scholTemplates={getStyleScholTemplates(style)}
                  scholLevelOptions={scholLevelOptions}
                  toggleItem={(field, item) => toggleStyleArrayItem(style, field, item)}
                />
              </div>
            ))}
          </div>

          {/* Register button */}
          <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
            <button
              className="px-5 py-2.5 bg-primary-500 text-white rounded-lg border-none cursor-pointer text-sm font-semibold transition-colors hover:bg-primary-600 disabled:opacity-50 disabled:cursor-default"
              onClick={handleMultiStyleRegister}
              disabled={regLoading || multiStyleEntryCount === 0}
            >
              {regLoading ? 'Registering...' : `Register ${multiStyleEntryCount} Event${multiStyleEntryCount !== 1 ? 's' : ''}`}
            </button>
            {multiStyleEntryCount > 0 && !regLoading && (
              <span className="text-xs text-gray-500">
                across {Object.entries(perStyleSelections).filter(([, sel]) =>
                  sel.singleDances.length > 0 || sel.templateIds.length > 0 || sel.scholTemplateIds.length > 0
                ).length} style{Object.entries(perStyleSelections).filter(([, sel]) =>
                  sel.singleDances.length > 0 || sel.templateIds.length > 0 || sel.scholTemplateIds.length > 0
                ).length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      ) : (
        /* ─── Original Single Registration Mode (no templates configured) ─── */
        <div className="flex flex-col gap-2.5">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Designation</label>
            <div className="flex gap-1.5 flex-wrap">
              {['Pro-Am', 'Amateur', 'Professional', 'Student'].map(opt => (
                <button key={opt} type="button" className={toggleBtnClass(regDesignation === opt)}
                  onClick={() => setRegDesignation(regDesignation === opt ? '' : opt)}>
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {!isIntegrated && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Syllabus Type</label>
              <div className="flex gap-1.5 flex-wrap">
                {['Syllabus', 'Open'].map(opt => (
                  <button key={opt} type="button" className={toggleBtnClass(regSyllabusType === opt)}
                    onClick={() => setRegSyllabusType(regSyllabusType === opt ? '' : opt)}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Level</label>
            <div className="flex gap-1.5 flex-wrap">
              {levels.map(opt => (
                <button key={opt} type="button" className={toggleBtnClass(regLevel === opt)}
                  onClick={() => setRegLevel(regLevel === opt ? '' : opt)}>
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {availableAgeCategories.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Age Category</label>
              <div className="flex gap-1.5 flex-wrap">
                {availableAgeCategories.map(cat => (
                  <button key={cat.name} type="button" className={toggleBtnClass(regAgeCategory === cat.name)}
                    onClick={() => setRegAgeCategory(regAgeCategory === cat.name ? '' : cat.name)}>
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Style</label>
            <div className="flex gap-1.5 flex-wrap">
              {styles.map(opt => (
                <button key={opt} type="button" className={toggleBtnClass(regStyle === opt)}
                  onClick={() => {
                    if (regStyle === opt) {
                      setRegStyle('');
                      setRegDances([]);
                    } else {
                      setRegStyle(opt);
                      setRegDances([]);
                    }
                  }}>
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {regStyle && getDanceOptions(regStyle).length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Dances {regDances.length > 0 && `(${regDances.length})`}
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {getDanceOptions(regStyle).map(d => (
                  <button key={d} type="button" className={toggleBtnClass(regDances.includes(d))}
                    onClick={() => setRegDances(prev =>
                      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
                    )}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!hasScoringDefaults && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Scoring</label>
              <div className="flex gap-1.5">
                {(['standard', 'proficiency'] as const).map(opt => (
                  <button key={opt} type="button" className={toggleBtnClass(regScoringType === opt)}
                    onClick={() => setRegScoringType(opt)}>
                    {opt === 'standard' ? 'Standard' : 'Proficiency'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Scholarship</label>
            <div className="flex gap-1.5">
              <button type="button" className={toggleBtnClass(!regIsScholarship)}
                onClick={() => setRegIsScholarship(false)}>
                Regular
              </button>
              <button type="button" className={toggleBtnClass(regIsScholarship)}
                onClick={() => setRegIsScholarship(true)}>
                Scholarship
              </button>
            </div>
          </div>

          <button
            className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 self-start mt-1"
            onClick={() => handleRegister()}
            disabled={regLoading}
          >
            {regLoading ? 'Registering...' : 'Register for Event'}
          </button>
        </div>
      )}

      <div className="mt-4 border-t border-gray-200 pt-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="mt-0 mb-0 text-gray-600 text-sm">
            Currently Entered ({coupleEventsLoading ? '...' : coupleEvents.length} events)
          </h4>
          {coupleEvents.length > 1 && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-gray-400">Sort:</span>
              <button type="button"
                onClick={() => setEventSort('name')}
                className={`px-1.5 py-0.5 rounded cursor-pointer text-xs border-none ${eventSort === 'name' ? 'bg-primary-500 text-white font-semibold' : 'bg-gray-100 text-gray-600'}`}>
                Name
              </button>
              <button type="button"
                onClick={() => setEventSort('entry-order')}
                className={`px-1.5 py-0.5 rounded cursor-pointer text-xs border-none ${eventSort === 'entry-order' ? 'bg-primary-500 text-white font-semibold' : 'bg-gray-100 text-gray-600'}`}>
                Entry Order
              </button>
            </div>
          )}
        </div>
        {coupleEventsLoading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : coupleEvents.length === 0 ? (
          <p className="text-gray-400 text-sm">Not entered in any events yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sortEvents(coupleEvents, eventSort).map(ev => (
              <div key={ev.id} className="flex justify-between items-center px-2 py-1.5 bg-white border border-gray-200 rounded text-sm">
                <span>
                  <strong>{ev.name}</strong>
                  <span className="text-gray-500 ml-2">
                    {[ev.designation, ev.level, ev.dances?.join(', ')].filter(Boolean).join(' \u2022 ')}
                  </span>
                </span>
                <button
                  onClick={() => handleRemoveEntry(ev.id)}
                  className="px-2 py-0.5 bg-danger-500 text-white rounded border-none cursor-pointer text-xs font-medium transition-colors hover:bg-danger-600"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CoupleRegistrationPanel;
