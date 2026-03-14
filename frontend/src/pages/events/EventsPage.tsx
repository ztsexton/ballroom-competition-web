import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { eventsApi } from '../../api/client';
import { Event } from '../../types';
import { useCompetition } from '../../context/CompetitionContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Skeleton } from '../../components/Skeleton';

const DEFAULT_STYLE_SECTIONS = ['Smooth', 'Standard', 'Rhythm', 'Latin', 'Night Club', 'Country'];

const EventsPage = () => {
  const { id: hubId } = useParams<{ id: string }>();
  const insideHub = !!hubId;
  const { activeCompetition, competitions, setActiveCompetition } = useCompetition();
  const { isAnyAdmin, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [deleteEventId, setDeleteEventId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkScoring, setShowBulkScoring] = useState(false);
  const [bulkRules, setBulkRules] = useState<Record<string, string>>({});
  const [bulkApplying, setBulkApplying] = useState(false);
  const [showStripSyllabus, setShowStripSyllabus] = useState(false);
  const [stripApplying, setStripApplying] = useState(false);
  const [mergeApplying, setMergeApplying] = useState(false);
  const [mergeResult, setMergeResult] = useState<{ mergedGroups: number; deletedEvents: number; details: Array<{ kept: string; merged: string[]; bibsMoved: number }> } | null>(null);
  const [deleteEmptyPreview, setDeleteEmptyPreview] = useState<Array<{ id: number; name: string }> | null>(null);
  const [deleteEmptyApplying, setDeleteEmptyApplying] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagResult, setDiagResult] = useState<{
    totalEvents: number;
    emptyEventCount: number;
    totalCouples: number;
    couplesWithNoEvents: Array<{ bib: number; leaderId: number; followerId: number }>;
    emptyEventAnalysis: Array<{
      emptyEvent: { id: number; name: string; ageCategory?: string };
      similarEvents: Array<{ id: number; name: string; ageCategory?: string; coupleCount: number }>;
    }>;
  } | null>(null);
  const location = useLocation();

  useEffect(() => {
    if (!insideHub) {
      const params = new URLSearchParams(location.search);
      const competitionId = params.get('competitionId');
      if (competitionId && competitions.length > 0) {
        const comp = competitions.find(c => c.id === Number(competitionId));
        if (comp && (!activeCompetition || activeCompetition.id !== comp.id)) {
          setActiveCompetition(comp);
        }
      }
    }
    if (activeCompetition) {
      loadEvents();
    } else {
      setEvents([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompetition, competitions, location.search]);

  const loadEvents = async () => {
    if (!activeCompetition) return;

    try {
      const response = await eventsApi.getAll(activeCompetition.id);
      setEvents(Object.values(response.data));
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await eventsApi.delete(id);
      loadEvents();
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to delete event', 'error');
    }
  };

  if (loading || authLoading) return <div className="max-w-7xl mx-auto p-8"><Skeleton variant="card" /></div>;

  if (!insideHub && !isAnyAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2>Access Denied</h2>
          <p>You must be an admin to manage events.</p>
        </div>
      </div>
    );
  }

  if (!insideHub && !activeCompetition) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2>Manage Events</h2>
          <div className="text-center p-12 bg-amber-50 border border-amber-400 rounded-lg">
            <p className="text-lg mb-2">No Active Competition</p>
            <p className="text-amber-900">Please select a competition to manage events.</p>
          </div>
        </div>
      </div>
    );
  }

  const content = (
    <>
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2>Manage Events{!insideHub && activeCompetition ? ` - ${activeCompetition.name}` : ''}</h2>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search events..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-64 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              aria-label="Search events"
            />
            <Link to="/events/new" className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 no-underline whitespace-nowrap">Create New Event</Link>
          </div>
        </div>

        {events.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowBulkScoring(!showBulkScoring)}
              className="text-sm text-primary-600 hover:text-primary-800 font-medium cursor-pointer bg-transparent border-none"
            >
              {showBulkScoring ? '\u25bc' : '\u25b6'} Bulk Scoring Type Assignment
            </button>
            {showBulkScoring && (
              <div className="mt-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 mb-3">
                  Set scoring type for all events by event type. Only events whose scoring type differs will be updated.
                </p>
                <div className="flex gap-6 flex-wrap items-end">
                  {(['single', 'multi', 'scholarship'] as const).map(type => {
                    const label = type === 'single' ? 'Single Dance' : type === 'multi' ? 'Multi Dance' : 'Scholarship';
                    const count = events.filter(e => {
                      if (type === 'scholarship') return e.isScholarship;
                      if (type === 'multi') return !e.isScholarship && e.dances && e.dances.length > 1;
                      return !e.isScholarship && (!e.dances || e.dances.length <= 1);
                    }).length;
                    return (
                      <div key={type} className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-500">{label} ({count})</label>
                        <select
                          value={bulkRules[type] || ''}
                          onChange={e => setBulkRules(prev => {
                            const next = { ...prev };
                            if (e.target.value) next[type] = e.target.value;
                            else delete next[type];
                            return next;
                          })}
                          className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                        >
                          <option value="">No change</option>
                          <option value="standard">Standard</option>
                          <option value="proficiency">Proficiency</option>
                        </select>
                      </div>
                    );
                  })}
                  <button
                    onClick={async () => {
                      if (!activeCompetition || Object.keys(bulkRules).length === 0) return;
                      setBulkApplying(true);
                      try {
                        const res = await eventsApi.bulkScoringType(activeCompetition.id, bulkRules);
                        if (res.data.warning) {
                          if (confirm(res.data.message + ' Continue?')) {
                            const confirmed = await eventsApi.bulkScoringType(activeCompetition.id, bulkRules, true);
                            showToast(`Updated ${confirmed.data.updated} event(s)`, 'success');
                            loadEvents();
                          }
                        } else {
                          showToast(`Updated ${res.data.updated} event(s)`, 'success');
                          loadEvents();
                        }
                      } catch (error: any) {
                        const msg = error.response?.data?.error || error.response?.data?.message || 'Failed to update';
                        if (error.response?.status === 409 && error.response?.data?.warning) {
                          if (confirm(error.response.data.message + ' Continue?')) {
                            try {
                              const confirmed = await eventsApi.bulkScoringType(activeCompetition.id, bulkRules, true);
                              showToast(`Updated ${confirmed.data.updated} event(s)`, 'success');
                              loadEvents();
                            } catch (err2: any) {
                              showToast(err2.response?.data?.error || 'Failed to update', 'error');
                            }
                          }
                        } else {
                          showToast(msg, 'error');
                        }
                      } finally {
                        setBulkApplying(false);
                      }
                    }}
                    disabled={bulkApplying || Object.keys(bulkRules).length === 0}
                    className="px-3 py-1.5 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {bulkApplying ? 'Applying...' : 'Apply'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {events.length > 0 && (activeCompetition?.levelMode || 'combined') === 'integrated' && (
          <div className="mb-4">
            <button
              onClick={() => setShowStripSyllabus(!showStripSyllabus)}
              className="text-sm text-primary-600 hover:text-primary-800 font-medium cursor-pointer bg-transparent border-none"
            >
              {showStripSyllabus ? '\u25bc' : '\u25b6'} Integrated Level Mode Cleanup
            </button>
            {showStripSyllabus && (
              <div className="mt-2 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
                {/* Step 1: Merge duplicates */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Step 1: Merge Duplicate Events</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Find events that are identical except for Syllabus/Open type and merge their couples into one event.
                    This recovers couples that ended up in duplicate events after switching to integrated mode.
                  </p>
                  {mergeResult && (
                    <div className="mb-2 p-2 bg-white border border-gray-200 rounded text-xs space-y-1">
                      {mergeResult.mergedGroups === 0 ? (
                        <p className="text-gray-500">No duplicate events found — nothing to merge.</p>
                      ) : (
                        <>
                          <p className="text-green-700 font-medium">
                            Merged {mergeResult.mergedGroups} group{mergeResult.mergedGroups !== 1 ? 's' : ''}, deleted {mergeResult.deletedEvents} duplicate event{mergeResult.deletedEvents !== 1 ? 's' : ''}
                          </p>
                          {mergeResult.details.map((d, i) => (
                            <div key={i} className="text-gray-600">
                              Kept <strong>{d.kept}</strong>, merged {d.merged.map((n, j) => <span key={j} className="text-red-500 line-through ml-1">{n}</span>)}
                              {d.bibsMoved > 0 && <span className="text-green-600 ml-1">(+{d.bibsMoved} couple{d.bibsMoved !== 1 ? 's' : ''} moved)</span>}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                  <button
                    onClick={async () => {
                      if (!activeCompetition) return;
                      setMergeApplying(true);
                      setMergeResult(null);
                      try {
                        const res = await eventsApi.mergeSyllabusTypeDuplicates(activeCompetition.id);
                        setMergeResult(res.data);
                        if (res.data.mergedGroups > 0) {
                          showToast(`Merged ${res.data.mergedGroups} group(s), recovered couples`, 'success');
                        } else {
                          showToast('No duplicates found', 'success');
                        }
                        loadEvents();
                      } catch (error: any) {
                        showToast(error.response?.data?.error || 'Failed to merge', 'error');
                      } finally {
                        setMergeApplying(false);
                      }
                    }}
                    disabled={mergeApplying}
                    className="px-3 py-1.5 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {mergeApplying ? 'Merging...' : 'Merge Duplicates'}
                  </button>
                </div>

                {/* Step 2: Strip names */}
                <div className="pt-3 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Step 2: Clean Event Names</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Remove "Syllabus" and "Open" from event names and clear the syllabus type field, since integrated levels make these labels redundant.
                  </p>
                  {(() => {
                    const affected = events.filter(e => !!e.syllabusType);
                    return (
                      <>
                        <p className="text-xs text-gray-500 mb-3">
                          {affected.length > 0
                            ? `${affected.length} event${affected.length !== 1 ? 's' : ''} will be updated.`
                            : 'No events need updating — names are already clean.'}
                        </p>
                        {affected.length > 0 && affected.length <= 15 && (
                          <div className="mb-3 text-xs text-gray-500 space-y-0.5">
                            {affected.map(e => {
                              const syl = e.syllabusType || '';
                              const escaped = syl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                              const cleaned = e.name
                                .replace(new RegExp('\\b' + escaped + '\\b\\s*', 'gi'), '')
                                .replace(/\s{2,}/g, ' ')
                                .trim();
                              return (
                                <div key={e.id}>
                                  <span className="line-through text-gray-400">{e.name}</span>
                                  {cleaned !== e.name && <span className="ml-2 text-green-700">{cleaned}</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <button
                          onClick={async () => {
                            if (!activeCompetition) return;
                            setStripApplying(true);
                            try {
                              const res = await eventsApi.stripSyllabusType(activeCompetition.id);
                              showToast(`Updated ${res.data.updated} event${res.data.updated !== 1 ? 's' : ''}`, 'success');
                              loadEvents();
                            } catch (error: any) {
                              showToast(error.response?.data?.error || 'Failed to update', 'error');
                            } finally {
                              setStripApplying(false);
                            }
                          }}
                          disabled={stripApplying || affected.length === 0}
                          className="px-3 py-1.5 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {stripApplying ? 'Applying...' : 'Clean Names'}
                        </button>
                      </>
                    );
                  })()}
                </div>

                {/* Step 3: Diagnose empty events */}
                <div className="pt-3 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Step 3: Diagnose Empty Events</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Check if any entries were lost. Shows empty events, similar events that may have the couples, and any couples not in any event.
                  </p>
                  <button
                    onClick={async () => {
                      if (!activeCompetition) return;
                      setDiagnosing(true);
                      try {
                        const res = await eventsApi.diagnoseEmpty(activeCompetition.id);
                        setDiagResult(res.data);
                      } catch (error: any) {
                        showToast(error.response?.data?.error || 'Failed to diagnose', 'error');
                      } finally {
                        setDiagnosing(false);
                      }
                    }}
                    disabled={diagnosing}
                    className="px-3 py-1.5 bg-blue-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {diagnosing ? 'Checking...' : 'Run Diagnosis'}
                  </button>
                  {diagResult && (
                    <div className="mt-2 p-3 bg-white border border-gray-200 rounded text-sm space-y-3">
                      <div className="flex gap-4 text-xs">
                        <span>Total events: <strong>{diagResult.totalEvents}</strong></span>
                        <span>Empty events: <strong className={diagResult.emptyEventCount > 0 ? 'text-amber-600' : 'text-green-600'}>{diagResult.emptyEventCount}</strong></span>
                        <span>Total couples: <strong>{diagResult.totalCouples}</strong></span>
                        <span>Couples with no events: <strong className={diagResult.couplesWithNoEvents.length > 0 ? 'text-red-600' : 'text-green-600'}>{diagResult.couplesWithNoEvents.length}</strong></span>
                      </div>
                      {diagResult.couplesWithNoEvents.length > 0 && (
                        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs">
                          <p className="font-semibold text-red-700 mb-1">Couples not in any event (possible lost entries):</p>
                          {diagResult.couplesWithNoEvents.map(c => (
                            <div key={c.bib} className="text-red-600">Bib #{c.bib}</div>
                          ))}
                        </div>
                      )}
                      {diagResult.emptyEventAnalysis.length > 0 && (
                        <div className="space-y-2 text-xs max-h-64 overflow-y-auto">
                          {diagResult.emptyEventAnalysis.map((a, i) => (
                            <div key={i} className="p-2 bg-gray-50 rounded">
                              <div className="font-medium text-gray-700">
                                {a.emptyEvent.name}
                                {!a.emptyEvent.ageCategory && <span className="ml-1 text-amber-600">(no age category)</span>}
                              </div>
                              {a.similarEvents.length > 0 ? (
                                <div className="mt-1 ml-3 text-gray-500">
                                  Similar events with couples:
                                  {a.similarEvents.map((s, j) => (
                                    <div key={j} className="text-gray-600">
                                      {s.name} — <strong>{s.coupleCount} couple{s.coupleCount !== 1 ? 's' : ''}</strong>
                                      {s.ageCategory && <span className="ml-1 text-blue-600">(age: {s.ageCategory})</span>}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="mt-1 ml-3 text-gray-400">No similar events found</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {diagResult.emptyEventCount === 0 && diagResult.couplesWithNoEvents.length === 0 && (
                        <p className="text-green-600 text-xs font-medium">All clear — no empty events and no orphaned couples.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Step 4: Delete empty events */}
                <div className="pt-3 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Step 4: Delete Empty Events</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Remove events that have 0 couples. These are typically leftover from duplicate event creation.
                  </p>
                  {deleteEmptyPreview && (
                    <div className="mb-2 p-2 bg-white border border-gray-200 rounded text-xs space-y-0.5 max-h-48 overflow-y-auto">
                      {deleteEmptyPreview.length === 0 ? (
                        <p className="text-gray-500">No empty events found.</p>
                      ) : (
                        <>
                          <p className="text-amber-700 font-medium mb-1">
                            {deleteEmptyPreview.length} empty event{deleteEmptyPreview.length !== 1 ? 's' : ''} will be deleted:
                          </p>
                          {deleteEmptyPreview.map(e => (
                            <div key={e.id} className="text-gray-600">{e.name}</div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (!activeCompetition) return;
                        setDeleteEmptyApplying(true);
                        try {
                          const res = await eventsApi.deleteEmptyEvents(activeCompetition.id);
                          setDeleteEmptyPreview(res.data.events);
                        } catch (error: any) {
                          showToast(error.response?.data?.error || 'Failed to check', 'error');
                        } finally {
                          setDeleteEmptyApplying(false);
                        }
                      }}
                      disabled={deleteEmptyApplying}
                      className="px-3 py-1.5 bg-gray-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Preview
                    </button>
                    {deleteEmptyPreview && deleteEmptyPreview.length > 0 && (
                      <button
                        onClick={async () => {
                          if (!activeCompetition) return;
                          setDeleteEmptyApplying(true);
                          try {
                            const res = await eventsApi.deleteEmptyEvents(activeCompetition.id, true);
                            showToast(`Deleted ${res.data.deleted} empty event${res.data.deleted !== 1 ? 's' : ''}`, 'success');
                            setDeleteEmptyPreview(null);
                            loadEvents();
                          } catch (error: any) {
                            showToast(error.response?.data?.error || 'Failed to delete', 'error');
                          } finally {
                            setDeleteEmptyApplying(false);
                          }
                        }}
                        disabled={deleteEmptyApplying}
                        className="px-3 py-1.5 bg-red-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deleteEmptyApplying ? 'Deleting...' : `Delete ${deleteEmptyPreview.length} Empty Events`}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {(() => {
          const filteredEvents = events.filter(e => {
            const term = searchTerm.toLowerCase();
            return !term || e.name.toLowerCase().includes(term);
          });

          if (filteredEvents.length === 0) {
            return (
              <div className="text-center p-8 text-gray-500">
                <h3>{searchTerm ? 'No events match your search' : 'No events created yet'}</h3>
                {!searchTerm && <p>Create your first event to get started!</p>}
              </div>
            );
          }

          // Build style sections from competition's danceOrder (includes custom styles) + defaults
          const customStyles = activeCompetition?.danceOrder ? Object.keys(activeCompetition.danceOrder) : [];
          const styleSections = [...new Set([...DEFAULT_STYLE_SECTIONS, ...customStyles])];

          const eventsByStyle: Record<string, Event[]> = {};
          for (const s of styleSections) eventsByStyle[s] = [];
          const otherEvents: Event[] = [];
          for (const event of filteredEvents) {
              const section = styleSections.find(s => s === event.style);
              if (section) {
                eventsByStyle[section].push(event);
              } else {
                otherEvents.push(event);
              }
            }

            const allSections = [
              ...styleSections.map(s => ({ label: s, events: eventsByStyle[s] })),
              ...(otherEvents.length > 0 ? [{ label: 'Other', events: otherEvents }] : []),
            ];

            const toggleSection = (label: string) => {
              setCollapsedSections(prev => ({ ...prev, [label]: !prev[label] }));
            };

            const renderEventRows = (sectionEvents: Event[]) => (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Event #</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Name</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Details</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Rounds</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Competitors</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionEvents.map(event => {
                    const allBibs = new Set<number>();
                    event.heats.forEach(heat => {
                      heat.bibs.forEach(bib => allBibs.add(bib));
                    });

                    return (
                      <tr key={event.id}>
                        <td className="px-3 py-2 border-t border-gray-100"><strong>#{event.id}</strong></td>
                        <td className="px-3 py-2 border-t border-gray-100">{event.name}</td>
                        <td className="px-3 py-2 border-t border-gray-100 text-sm text-gray-500">
                          <div className="flex items-center gap-2">
                            <span>
                              {[
                                event.designation,
                                event.syllabusType,
                                event.level,
                                event.dances?.join(', ')
                              ].filter(Boolean).join(' \u2022 ') || '\u2014'}
                            </span>
                            {event.scoringType === 'proficiency' && (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">Prof</span>
                            )}
                            {event.sectionLetter && (
                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">Sec {event.sectionLetter}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 border-t border-gray-100">{event.heats.length} round{event.heats.length !== 1 ? 's' : ''}</td>
                        <td className="px-3 py-2 border-t border-gray-100">{allBibs.size} couple{allBibs.size !== 1 ? 's' : ''}</td>
                        <td className="px-3 py-2 border-t border-gray-100">
                          <div className="flex gap-2">
                            <Link
                              to={`/events/${event.id}`}
                              className="px-2 py-1 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 no-underline"
                            >
                              View
                            </Link>
                            <Link
                              to={`/events/${event.id}/entries`}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200 no-underline"
                            >
                              Entries
                            </Link>
                            <Link
                              to={`/events/${event.id}/edit`}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200 no-underline"
                            >
                              Edit
                            </Link>
                            <Link
                              to={`/events/${event.id}/score`}
                              className="px-2 py-1 bg-success-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-success-600 no-underline"
                            >
                              Score
                            </Link>
                            <Link
                              to={`/events/${event.id}/results`}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200 no-underline"
                            >
                              Results
                            </Link>
                            <button
                              onClick={() => setDeleteEventId(event.id)}
                              className="px-2 py-1 bg-danger-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-danger-600"
                              aria-label={`Delete ${event.name}`}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );

          return (
              <>
                {/* Jump nav */}
                <div className="flex gap-2 flex-wrap mb-6 p-3 bg-gray-50 rounded-md border border-gray-200">
                  {allSections.map(({ label, events: sectionEvents }) => (
                    <a
                      key={label}
                      href={`#style-${label.toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={() => {
                        if (collapsedSections[label]) {
                          setCollapsedSections(prev => ({ ...prev, [label]: false }));
                        }
                      }}
                      className={`px-3 py-1 rounded text-sm no-underline ${
                        sectionEvents.length > 0 ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {label} ({sectionEvents.length})
                    </a>
                  ))}
                </div>

                {/* Sections */}
                {allSections.map(({ label, events: sectionEvents }) => {
                  const isCollapsed = !!collapsedSections[label];
                  return (
                    <div
                      key={label}
                      id={`style-${label.toLowerCase().replace(/\s+/g, '-')}`}
                      className="mb-6 scroll-mt-4"
                    >
                      <div
                        onClick={() => toggleSection(label)}
                        className={`flex justify-between items-center border-b-2 border-gray-200 pb-2 cursor-pointer select-none ${isCollapsed ? '' : 'mb-3'}`}
                      >
                        <h3 className="m-0">
                          <span className="inline-block w-5 text-xs">
                            {isCollapsed ? '\u25b6' : '\u25bc'}
                          </span>
                          {label}
                        </h3>
                        <span className="text-sm text-gray-500">
                          {sectionEvents.length} event{sectionEvents.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {!isCollapsed && (
                        sectionEvents.length > 0 ? (
                          renderEventRows(sectionEvents)
                        ) : (
                          <p className="text-gray-400 italic my-2">
                            No {label.toLowerCase()} events
                          </p>
                        )
                      )}
                    </div>
                  );
                })}
              </>
          );
        })()}
      </div>

      {events.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3>Quick Stats</h3>
          <p>Total Events: <strong>{events.length}</strong></p>
          <div className="flex gap-4 flex-wrap mt-2">
            {[...new Set([...DEFAULT_STYLE_SECTIONS, ...(activeCompetition?.danceOrder ? Object.keys(activeCompetition.danceOrder) : [])])].map(s => {
              const count = events.filter(e => e.style === s).length;
              return count > 0 ? (
                <span key={s} className="text-sm text-gray-500">
                  {s}: <strong>{count}</strong>
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="max-w-7xl mx-auto p-8">
      {content}
      <ConfirmDialog
        open={deleteEventId !== null}
        title="Delete Event"
        message="Are you sure you want to delete this event? This will also delete all associated scores."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { if (deleteEventId !== null) handleDelete(deleteEventId); setDeleteEventId(null); }}
        onCancel={() => setDeleteEventId(null)}
      />
    </div>
  );
};

export default EventsPage;
