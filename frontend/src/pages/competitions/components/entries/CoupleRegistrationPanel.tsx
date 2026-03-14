import { useState } from 'react';
import { Competition, Event, EventTemplate } from '../../../../types';
import { DEFAULT_LEVELS } from '../../../../constants/levels';
import { getAvailableStyles } from '../../../../constants/dances';
import { RegistrationState } from '../../hooks/useRegistrationPanel';

interface CoupleRegistrationPanelProps {
  bib: number;
  activeCompetition: Competition | null;
  registration: RegistrationState;
}

const toggleBtnClass = (active: boolean) =>
  active
    ? 'px-3 py-1.5 rounded border-2 border-primary-500 bg-primary-500 text-white cursor-pointer font-semibold text-sm transition-all'
    : 'px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 cursor-pointer font-normal text-sm transition-all';

type EventSortMode = 'name' | 'entry-order';

function sortEvents(events: Event[], mode: EventSortMode): Event[] {
  if (mode === 'entry-order') {
    return [...events].sort((a, b) => a.id - b.id);
  }
  return [...events].sort((a, b) => a.name.localeCompare(b.name));
}

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
    // Batch
    regLevels, setRegLevels,
    selectedSingleDances, setSelectedSingleDances,
    selectedTemplateIds, setSelectedTemplateIds,
    handleBulkRegister, bulkResults,
  } = registration;

  const templates = activeCompetition?.eventTemplates || [];
  const hasBatchMode = templates.length > 0;
  const levels = activeCompetition?.levels?.length ? activeCompetition.levels : DEFAULT_LEVELS;
  const styles = getAvailableStyles(activeCompetition?.danceOrder);
  const isIntegrated = (activeCompetition?.levelMode || 'combined') === 'integrated';

  // In batch mode, compute total entries that will be created
  const batchEntryCount = hasBatchMode
    ? regLevels.length * (selectedSingleDances.length + selectedTemplateIds.length)
    : 0;

  // Get templates for currently selected style
  const styleTemplates = regStyle
    ? templates.filter((t: EventTemplate) => t.style === regStyle)
    : [];
  const styleDances = regStyle ? getDanceOptions(regStyle) : [];

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
        <div className="mb-3 text-xs space-y-0.5">
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
        /* ─── Batch Registration Mode ─── */
        <div className="flex flex-col gap-2.5">
          {/* Shared fields */}
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

          {/* Level(s) — multi-select */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Level(s) {regLevels.length > 0 && <span className="text-primary-500">({regLevels.length})</span>}
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {levels.map(opt => (
                <button key={opt} type="button" className={toggleBtnClass(regLevels.includes(opt))}
                  onClick={() => setRegLevels(prev =>
                    prev.includes(opt) ? prev.filter(l => l !== opt) : [...prev, opt]
                  )}>
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Style — single-select */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Style</label>
            <div className="flex gap-1.5 flex-wrap">
              {styles.map(opt => (
                <button key={opt} type="button" className={toggleBtnClass(regStyle === opt)}
                  onClick={() => {
                    if (regStyle === opt) {
                      setRegStyle('');
                    } else {
                      setRegStyle(opt);
                    }
                    setSelectedSingleDances([]);
                    setSelectedTemplateIds([]);
                  }}>
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Single Dances section */}
          {regStyle && styleDances.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-xs font-semibold text-gray-500">
                  Single Dances {selectedSingleDances.length > 0 && <span className="text-primary-500">({selectedSingleDances.length})</span>}
                </label>
                <button
                  type="button"
                  className="text-xs text-primary-500 hover:text-primary-700 cursor-pointer font-medium"
                  onClick={() => {
                    if (selectedSingleDances.length === styleDances.length) {
                      setSelectedSingleDances([]);
                    } else {
                      setSelectedSingleDances([...styleDances]);
                    }
                  }}
                >
                  {selectedSingleDances.length === styleDances.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {styleDances.map(d => (
                  <button key={d} type="button" className={toggleBtnClass(selectedSingleDances.includes(d))}
                    onClick={() => setSelectedSingleDances(prev =>
                      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
                    )}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Multi-Dance Templates section */}
          {regStyle && styleTemplates.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Multi-Dance {selectedTemplateIds.length > 0 && <span className="text-primary-500">({selectedTemplateIds.length})</span>}
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {styleTemplates.map((tpl: EventTemplate) => (
                  <button
                    key={tpl.id}
                    type="button"
                    className={selectedTemplateIds.includes(tpl.id)
                      ? 'px-3 py-1.5 rounded border-2 border-primary-500 bg-primary-50 text-primary-700 cursor-pointer font-semibold text-sm transition-all'
                      : 'px-3 py-1.5 rounded border-2 border-dashed border-primary-300 bg-white text-primary-600 cursor-pointer font-medium text-sm transition-all hover:bg-primary-50'
                    }
                    onClick={() => setSelectedTemplateIds(prev =>
                      prev.includes(tpl.id) ? prev.filter(x => x !== tpl.id) : [...prev, tpl.id]
                    )}
                  >
                    {tpl.name}
                    <span className="text-xs ml-1 opacity-70">({tpl.dances.length})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Summary + register button */}
          <div className="flex items-center gap-3 mt-1">
            <button
              className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 disabled:opacity-50 disabled:cursor-default"
              onClick={handleBulkRegister}
              disabled={regLoading || batchEntryCount === 0}
            >
              {regLoading ? 'Registering...' : `Register ${batchEntryCount} Event${batchEntryCount !== 1 ? 's' : ''}`}
            </button>
            {batchEntryCount > 0 && !regLoading && (
              <span className="text-xs text-gray-500">
                {regLevels.length} level{regLevels.length !== 1 ? 's' : ''} × {selectedSingleDances.length + selectedTemplateIds.length} event{(selectedSingleDances.length + selectedTemplateIds.length) !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Scholarship — separate single-event flow */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <h5 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Scholarship Entry</h5>
            <p className="text-gray-400 text-xs mb-2">Uses the same designation, syllabus type, age category, and scoring from above.</p>
            <div className="flex flex-col gap-2.5">
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

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Dances</label>
                {regStyle && getDanceOptions(regStyle).length > 0 ? (
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
                ) : (
                  <p className="text-gray-400 text-xs">Select a style above first</p>
                )}
              </div>

              <button
                className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 self-start disabled:opacity-50 disabled:cursor-default"
                onClick={() => handleRegister({ isScholarship: true })}
                disabled={regLoading}
              >
                {regLoading ? 'Registering...' : 'Register Scholarship'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ─── Original Single Registration Mode ─── */
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
