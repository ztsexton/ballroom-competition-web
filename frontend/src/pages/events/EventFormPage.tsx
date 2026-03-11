import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { eventsApi, couplesApi, judgesApi } from '../../api/client';
import { Couple, Judge, Event, AgeCategory } from '../../types';
import { useCompetition } from '../../context/CompetitionContext';
import { useAuth } from '../../context/AuthContext';
import { DEFAULT_LEVELS } from '../../constants/levels';
import { getDancesForStyle, getAvailableStyles } from '../../constants/dances';
import { Skeleton } from '../../components/Skeleton';

const toggleCls = (active: boolean) =>
  active
    ? 'px-4 py-2 border-2 border-primary-500 rounded bg-primary-500 text-white cursor-pointer font-bold transition-all'
    : 'px-4 py-2 border border-gray-300 rounded bg-white text-gray-700 cursor-pointer font-normal transition-all';


const EventFormPage = () => {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const { activeCompetition } = useCompetition();
  const { isAnyAdmin, loading: authLoading } = useAuth();
  const [originalEvent, setOriginalEvent] = useState<Event | null>(null);
  const [couples, setCouples] = useState<Couple[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showScoreWarning, setShowScoreWarning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [eventName, setEventName] = useState('');
  const [designation, setDesignation] = useState('');
  const [syllabusType, setSyllabusType] = useState('');
  const [level, setLevel] = useState('');
  const [style, setStyle] = useState('');
  const [selectedDances, setSelectedDances] = useState<string[]>([]);
  const [selectedBibs, setSelectedBibs] = useState<number[]>([]);
  const [selectedJudges, setSelectedJudges] = useState<number[]>([]);
  const [coupleSearch, setCoupleSearch] = useState('');
  const [scoringType, setScoringType] = useState<'standard' | 'proficiency'>(
    activeCompetition?.defaultScoringType || 'standard'
  );
  const [isScholarship, setIsScholarship] = useState(false);
  const [ageCategory, setAgeCategory] = useState('');
  const [availableAgeCategories, setAvailableAgeCategories] = useState<AgeCategory[]>([]);

  useEffect(() => {
    if (activeCompetition && (!isEditMode || id)) {
      loadData();
    }
  }, [activeCompetition, id]);

  const loadData = async () => {
    if (!activeCompetition) return;

    try {
      // Load age categories from competition
      if (activeCompetition.ageCategories?.length) {
        setAvailableAgeCategories(activeCompetition.ageCategories);
      }

      if (isEditMode) {
        const [eventRes, couplesRes, judgesRes] = await Promise.all([
          eventsApi.getById(parseInt(id!)),
          couplesApi.getAll(activeCompetition.id),
          judgesApi.getAll(activeCompetition.id),
        ]);

        const evt = eventRes.data;
        setOriginalEvent(evt);
        setCouples(couplesRes.data);
        setJudges(judgesRes.data);

        // Pre-populate form from existing event
        setEventName(evt.name);
        setDesignation(evt.designation || '');
        setSyllabusType(evt.syllabusType || '');
        setLevel(evt.level || '');
        setStyle(evt.style || '');
        setSelectedDances(evt.dances || []);
        setScoringType(evt.scoringType || 'standard');
        setIsScholarship(evt.isScholarship || false);
        setAgeCategory(evt.ageCategory || '');
        setSelectedBibs(evt.heats[0]?.bibs || []);
        setSelectedJudges(evt.heats[0]?.judges || []);
      } else {
        const [couplesRes, judgesRes] = await Promise.all([
          couplesApi.getAll(activeCompetition.id),
          judgesApi.getAll(activeCompetition.id),
        ]);
        setCouples(couplesRes.data);
        setJudges(judgesRes.data);

        // Auto-select all judges if 3 or fewer
        if (judgesRes.data.length <= 3) {
          setSelectedJudges(judgesRes.data.map(j => j.id));
        }
      }
    } catch {
      setError(isEditMode ? 'Failed to load event data' : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleBibToggle = (bib: number) => {
    setSelectedBibs(prev =>
      prev.includes(bib) ? prev.filter(b => b !== bib) : [...prev, bib]
    );
  };

  const handleJudgeToggle = (judgeId: number) => {
    setSelectedJudges(prev =>
      prev.includes(judgeId) ? prev.filter(j => j !== judgeId) : [...prev, judgeId]
    );
  };

  const handleDanceToggle = (dance: string) => {
    setSelectedDances(prev =>
      prev.includes(dance) ? prev.filter(d => d !== dance) : [...prev, dance]
    );
  };

  const getDanceOptions = () => getDancesForStyle(style, activeCompetition?.danceOrder);

  const filteredCouples = couples.filter(couple => {
    if (!coupleSearch.trim()) return true;
    const q = coupleSearch.toLowerCase().trim();
    return (
      couple.bib.toString().includes(q) ||
      couple.leaderName.toLowerCase().includes(q) ||
      couple.followerName.toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (e: FormEvent, forceOverwrite = false) => {
    e.preventDefault();

    if (!activeCompetition) {
      setError('No active competition selected');
      return;
    }

    if (!eventName.trim()) {
      setError('Event name is required');
      return;
    }

    setSubmitting(true);
    try {
      if (isEditMode) {
        if (!originalEvent) return;

        if (selectedBibs.length === 0) {
          setError('Please select at least one couple');
          return;
        }

        const payload: Record<string, unknown> = {
          name: eventName.trim(),
          designation: designation || undefined,
          syllabusType: syllabusType || undefined,
          level: level || undefined,
          style: style || undefined,
          dances: selectedDances.length > 0 ? selectedDances : undefined,
          bibs: selectedBibs,
          judgeIds: selectedJudges,
          scoringType,
          isScholarship,
          ageCategory: ageCategory || undefined,
        };

        if (forceOverwrite) {
          payload.clearScores = true;
        }

        try {
          const response = await eventsApi.update(originalEvent.id, payload as any);
          navigate(`/events/${response.data.id}`);
        } catch (err: unknown) {
          if (axios.isAxiosError(err) && err.response?.status === 409 && err.response?.data?.warning) {
            setShowScoreWarning(true);
          } else {
            setError(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to update event' : 'Failed to update event');
          }
        }
      } else {
        try {
          const response = await eventsApi.create(
            eventName.trim(),
            selectedBibs,
            selectedJudges,
            activeCompetition.id,
            designation || undefined,
            syllabusType || undefined,
            level || undefined,
            style || undefined,
            selectedDances.length > 0 ? selectedDances : undefined,
            scoringType,
            isScholarship || undefined,
            ageCategory || undefined
          );
          navigate(`/events/${response.data.id}`);
        } catch (error: unknown) {
          setError(axios.isAxiosError(error) ? error.response?.data?.error || 'Failed to create event' : 'Failed to create event');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(isEditMode ? `/events/${id}` : '/events');
  };

  if (loading || authLoading) return <div className="max-w-7xl mx-auto p-8"><Skeleton variant="card" /></div>;

  if (!isAnyAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2>Access Denied</h2>
          <p>You must be an admin to {isEditMode ? 'edit' : 'create'} events.</p>
        </div>
      </div>
    );
  }

  if (isEditMode && (!activeCompetition || !originalEvent)) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2>Event Not Found</h2>
          <p>Unable to load the event for editing.</p>
          <button onClick={() => navigate('/events')} className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200 mt-4">
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  if (!isEditMode && !activeCompetition) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2>Create New Event</h2>
          <div className="bg-amber-50 border border-amber-400 p-6 rounded mt-4 text-center">
            <p className="text-lg mb-2">No Active Competition</p>
            <p className="text-amber-900">Please select a competition from the dropdown above to create events.</p>
          </div>
        </div>
      </div>
    );
  }

  const hasData = couples.length > 0;

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2>{isEditMode ? 'Edit Event' : 'Create New Event'} - {activeCompetition!.name}</h2>
          <button onClick={handleCancel} className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200">Cancel</button>
        </div>

        {error && <div className="px-4 py-3 bg-red-100 text-red-700 rounded mb-4 text-sm">{error}</div>}

        {!isEditMode && !hasData ? (
          <div className="bg-amber-50 border border-amber-400 p-6 rounded mt-4">
            <h3>Setup Required</h3>
            <p>Before creating an event, you need to:</p>
            <ol className="ml-6 mt-2">
              <li>Add people (leaders and followers)</li>
              <li>Create couples from those people</li>
              <li>Optionally add judges</li>
            </ol>
            <div className="mt-4 flex gap-2">
              <button onClick={() => navigate('/people')} className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600">
                Go to People
              </button>
              <button onClick={() => navigate('/couples')} className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600">
                Go to Couples
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-600 mb-2">Scoring Type</label>
              <div className="flex gap-2">
                {(['standard', 'proficiency'] as const).map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setScoringType(st)}
                    aria-pressed={scoringType === st}
                    className={toggleCls(scoringType === st)}
                  >
                    {st === 'standard' ? 'Standard' : 'Proficiency'}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-600 mb-2">Scholarship</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsScholarship(false)}
                  className={toggleCls(!isScholarship)}
                >
                  Regular
                </button>
                <button
                  type="button"
                  onClick={() => setIsScholarship(true)}
                  className={toggleCls(isScholarship)}
                >
                  Scholarship
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-600 mb-2">Designation</label>
              <div className="flex gap-2 flex-wrap">
                {['Pro-Am', 'Amateur', 'Professional', 'Student'].map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDesignation(designation === option ? '' : option)}
                    aria-pressed={designation === option}
                    className={toggleCls(designation === option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {(activeCompetition?.levelMode || 'combined') === 'combined' && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-600 mb-2">Syllabus Type</label>
                <div className="flex gap-2 flex-wrap">
                  {['Syllabus', 'Open'].map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSyllabusType(syllabusType === option ? '' : option)}
                      aria-pressed={syllabusType === option}
                      className={toggleCls(syllabusType === option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-600 mb-2">Level</label>
              <div className="flex gap-2 flex-wrap">
                {(activeCompetition?.levels?.length ? activeCompetition.levels : DEFAULT_LEVELS).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLevel(level === option ? '' : option)}
                    aria-pressed={level === option}
                    className={toggleCls(level === option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {availableAgeCategories.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-600 mb-2">Age Category</label>
                <div className="flex gap-2 flex-wrap">
                  {availableAgeCategories.map(cat => (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setAgeCategory(ageCategory === cat.name ? '' : cat.name)}
                      aria-pressed={ageCategory === cat.name}
                      className={toggleCls(ageCategory === cat.name)}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-600 mb-2">Style</label>
              <div className="flex gap-2 flex-wrap">
                {getAvailableStyles(activeCompetition?.danceOrder).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      if (style === option) {
                        setStyle('');
                        setSelectedDances([]);
                      } else {
                        setStyle(option);
                        setSelectedDances([]);
                      }
                    }}
                    aria-pressed={style === option}
                    className={toggleCls(style === option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {style && getDanceOptions().length > 0 && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="m-0">
                    Select Dances {selectedDances.length > 0 && (
                      <span className="text-primary-500 font-bold ml-2">
                        ({selectedDances.length} selected)
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDances(getDanceOptions())}
                      className="px-3 py-1 text-sm border border-primary-500 rounded bg-white text-primary-500 cursor-pointer font-medium"
                    >
                      Select All
                    </button>
                    {selectedDances.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedDances([])}
                        className="px-3 py-1 text-sm border border-gray-300 rounded bg-white text-gray-500 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {getDanceOptions().map(dance => (
                    <button
                      key={dance}
                      type="button"
                      onClick={() => handleDanceToggle(dance)}
                      className={`${toggleCls(selectedDances.includes(dance))} min-w-[120px]`}
                    >
                      {dance}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-600 mb-2">Event Name *</label>
              <input
                type="text"
                value={eventName}
                onChange={e => setEventName(e.target.value)}
                placeholder={isEditMode ? 'e.g., Bronze Waltz, Silver Foxtrot' : 'e.g., Bronze Waltz, Silver Foxtrot (or auto-generate based on selections)'}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                required
              />
              {designation && level && style && (
                <button
                  type="button"
                  onClick={() => {
                    const parts = [designation, ageCategory, syllabusType, level, style];
                    if (selectedDances.length > 0) {
                      parts.push(selectedDances.join('/'));
                    }
                    setEventName(parts.filter(p => p).join(' '));
                  }}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200 mt-2"
                >
                  Auto-Generate Name
                </button>
              )}
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="m-0">
                  Select Couples {isEditMode ? '*' : <span className="text-gray-400 font-normal">(optional)</span>}
                  {selectedBibs.length > 0 && (
                    <span className="text-primary-500 font-bold ml-2">
                      ({selectedBibs.length} selected)
                    </span>
                  )}
                </label>
                {couples.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const visibleBibs = filteredCouples.map(c => c.bib);
                        setSelectedBibs(prev => {
                          const combined = new Set([...prev, ...visibleBibs]);
                          return Array.from(combined);
                        });
                      }}
                      className="px-3 py-1 text-sm border border-primary-500 rounded bg-white text-primary-500 cursor-pointer font-medium"
                    >
                      {coupleSearch ? 'Select Matching' : 'Select All'}
                    </button>
                    {selectedBibs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedBibs([])}
                        className="px-3 py-1 text-sm border border-gray-300 rounded bg-white text-gray-500 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>
              {couples.length > 0 && (
                <input
                  type="text"
                  value={coupleSearch}
                  onChange={e => setCoupleSearch(e.target.value)}
                  placeholder="Search by bib #, leader, or follower name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 mb-2"
                />
              )}
              {couples.length === 0 ? (
                <p className="text-gray-500 text-center p-4">
                  No couples available
                </p>
              ) : filteredCouples.length === 0 ? (
                <p className="text-gray-500 text-center p-4">
                  No couples match "{coupleSearch}"
                </p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2 max-h-[360px] overflow-y-auto p-1">
                  {filteredCouples.map(couple => {
                    const isSelected = selectedBibs.includes(couple.bib);
                    return (
                      <div
                        key={couple.bib}
                        onClick={() => handleBibToggle(couple.bib)}
                        className={isSelected
                          ? 'flex items-center gap-3 px-3 py-2.5 rounded-md border-2 border-primary-500 bg-primary-50 cursor-pointer transition-all'
                          : 'flex items-center gap-3 px-3 py-2.5 rounded-md border border-gray-200 bg-white cursor-pointer transition-all'
                        }
                      >
                        <span className={isSelected
                          ? 'inline-flex items-center justify-center w-9 h-9 rounded-md bg-primary-500 text-white font-bold text-sm shrink-0'
                          : 'inline-flex items-center justify-center w-9 h-9 rounded-md bg-gray-100 text-gray-600 font-bold text-sm shrink-0'
                        }>
                          {couple.bib}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium text-[0.9rem] whitespace-nowrap overflow-hidden text-ellipsis">
                            {couple.leaderName}
                          </div>
                          <div className="text-gray-500 text-[0.8rem] whitespace-nowrap overflow-hidden text-ellipsis">
                            & {couple.followerName}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="m-0">
                  Select Judges
                  <span className="text-gray-400 font-normal ml-1">(optional)</span>
                  {selectedJudges.length > 0 && (
                    <span className="text-primary-500 font-bold ml-2">
                      ({selectedJudges.length} selected)
                    </span>
                  )}
                </label>
                {judges.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedJudges(judges.map(j => j.id))}
                      className="px-3 py-1 text-sm border border-primary-500 rounded bg-white text-primary-500 cursor-pointer font-medium"
                    >
                      Select All
                    </button>
                    {selectedJudges.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedJudges([])}
                        className="px-3 py-1 text-sm border border-gray-300 rounded bg-white text-gray-500 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>
              {judges.length === 0 ? (
                <p className="text-gray-500 text-center p-4">
                  No judges available (you can add them later)
                </p>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {judges.map(judge => {
                    const isSelected = selectedJudges.includes(judge.id);
                    return (
                      <div
                        key={judge.id}
                        onClick={() => handleJudgeToggle(judge.id)}
                        className={isSelected
                          ? 'flex items-center gap-2.5 px-4 py-2 rounded-md border-2 border-primary-500 bg-primary-50 cursor-pointer transition-all'
                          : 'flex items-center gap-2.5 px-4 py-2 rounded-md border border-gray-200 bg-white cursor-pointer transition-all'
                        }
                      >
                        <span className={isSelected
                          ? 'inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary-500 text-white font-bold text-xs shrink-0'
                          : 'inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-600 font-bold text-xs shrink-0'
                        }>
                          {judge.judgeNumber}
                        </span>
                        <span className="font-medium text-[0.9rem]">
                          {judge.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {scoringType === 'proficiency' ? (
              <div className="bg-green-50 border border-success-600 p-4 rounded mt-4">
                <strong>Proficiency Scoring</strong>
                <p className="mt-2 mb-0">
                  Each judge scores every couple 0-100. One round only. Results ranked by average score.
                </p>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-400 p-4 rounded mt-4">
                <strong>Standard Scoring — Automatic Round Generation</strong>
                <ul className="ml-6 mt-2 mb-0">
                  <li>1-6 couples: Final only</li>
                  <li>7-14 couples: Semi-final + Final</li>
                  <li>15+ couples: Quarter-final + Semi-final + Final</li>
                </ul>
              </div>
            )}

            <div className="flex gap-2 mt-6">
              <button type="submit" className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed" disabled={submitting || (isEditMode && selectedBibs.length === 0)}>
                {submitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Event'}
              </button>
              <button type="button" onClick={handleCancel} className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Score clearing confirmation modal (edit mode only) */}
      {showScoreWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
          <div className="bg-white p-8 rounded-lg max-w-[480px] w-[90%]">
            <h3 className="text-danger-500 mt-0 mb-4">
              Warning: Scores Will Be Cleared
            </h3>
            <p className="mb-6">
              Changing couples, judges, or scoring type will permanently clear all
              existing scores for this event. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 bg-danger-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-danger-600"
                onClick={(e) => {
                  setShowScoreWarning(false);
                  handleSubmit(e as any, true);
                }}
              >
                Clear Scores & Save
              </button>
              <button
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200"
                onClick={() => setShowScoreWarning(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventFormPage;
