import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { participantApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Competition, Person, Couple, Event, AgeCategory } from '../../types';
import { DEFAULT_LEVELS } from '../../constants/levels';
import { getDancesForStyle } from '../../constants/dances';
import { Skeleton } from '../../components/Skeleton';

interface ScheduleItem {
  heatId: string;
  estimatedStartTime?: string;
  eventId: number;
  eventName: string;
  round: string;
}


const toggleBtnCls = (active: boolean) =>
  active
    ? 'px-3 py-1.5 border-2 border-primary-500 rounded bg-primary-500 text-white cursor-pointer font-semibold text-sm transition-all'
    : 'px-3 py-1.5 border border-gray-300 rounded bg-white text-gray-700 cursor-pointer font-normal text-sm transition-all';

const ParticipantPortalPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // Competition selection
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
  const [loadingComps, setLoadingComps] = useState(true);

  // Registration
  const [myPerson, setMyPerson] = useState<Person | null>(null);
  const [regName, setRegName] = useState('');
  const [regRole, setRegRole] = useState<'leader' | 'follower' | 'both'>('leader');
  const [regStatus, setRegStatus] = useState<'student' | 'professional'>('student');
  const [regDeclaredLevel, setRegDeclaredLevel] = useState('');

  // Partners & couples
  const [myCouples, setMyCouples] = useState<Couple[]>([]);
  const [partnerName, setPartnerName] = useState('');
  const [partnerRole, setPartnerRole] = useState<'leader' | 'follower' | 'both'>('follower');

  // Entries
  const [myEntries, setMyEntries] = useState<Event[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);

  // Registration panel state (per couple)
  const [regBib, setRegBib] = useState<number | null>(null);
  const [regDesignation, setRegDesignation] = useState('');
  const [regSyllabusType, setRegSyllabusType] = useState('');
  const [regLevel, setRegLevel] = useState('');
  const [regStyle, setRegStyle] = useState('');
  const [regDances, setRegDances] = useState<string[]>([]);
  const [regScoringType, setRegScoringType] = useState('');
  const [regAgeCategory, setRegAgeCategory] = useState('');
  const [availableAgeCategories, setAvailableAgeCategories] = useState<AgeCategory[]>([]);
  const [allowedLevels, setAllowedLevels] = useState<string[]>([]);
  const [coupleLevel, setCoupleLevel] = useState<string | null>(null);
  const [validationEnabled, setValidationEnabled] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Load published competitions
  useEffect(() => {
    participantApi.getCompetitions()
      .then(res => {
        setCompetitions(res.data);
        // Auto-select competition from query param (e.g. /portal?competitionId=3)
        const preselect = searchParams.get('competitionId');
        if (preselect) {
          const match = res.data.find((c: Competition) => c.id === parseInt(preselect));
          if (match) setSelectedComp(match);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingComps(false));
  }, []);

  // Load data when competition selected
  useEffect(() => {
    if (selectedComp) {
      loadMyData(selectedComp.id);
      participantApi.getAgeCategories(selectedComp.id)
        .then(res => setAvailableAgeCategories(res.data))
        .catch(() => setAvailableAgeCategories([]));
    }
  }, [selectedComp]);

  // Load allowed levels when couple is selected
  useEffect(() => {
    if (selectedComp && regBib) {
      participantApi.getAllowedLevels(selectedComp.id, regBib)
        .then(res => {
          setAllowedLevels(res.data.allowedLevels);
          setCoupleLevel(res.data.coupleLevel);
          setValidationEnabled(res.data.validationEnabled);
          // Clear level selection if it's not allowed
          if (res.data.validationEnabled && regLevel && !res.data.allowedLevels.includes(regLevel)) {
            setRegLevel('');
          }
        })
        .catch(() => {
          setAllowedLevels(selectedComp.levels || DEFAULT_LEVELS);
          setValidationEnabled(false);
          setCoupleLevel(null);
        });
    }
  }, [selectedComp, regBib]);

  // Pre-fill name from auth user
  useEffect(() => {
    if (user?.displayName && !regName) {
      setRegName(user.displayName);
    }
  }, [user]);

  const loadMyData = async (competitionId: number) => {
    try {
      const res = await participantApi.getMyEntries(competitionId);
      setMyPerson(res.data.person);
      setMyCouples(res.data.couples);
      setMyEntries(res.data.entries);
      setSchedule(res.data.schedule);
    } catch {
      // Not registered yet — that's fine
      setMyPerson(null);
      setMyCouples([]);
      setMyEntries([]);
      setSchedule([]);
    }
  };

  const handleRegister = async () => {
    if (!selectedComp || !regName.trim()) return;
    setError('');
    setLoading(true);
    try {
      const res = await participantApi.register(selectedComp.id, {
        name: regName.trim(),
        email: user?.email || undefined,
        role: regRole,
        status: regStatus,
        level: regDeclaredLevel || undefined,
      });
      setMyPerson(res.data);
      setSuccess('Registered successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.error || 'Registration failed';
        if (err.response?.data?.person) {
          setMyPerson(err.response.data.person);
        }
        setError(msg);
      } else {
        setError('Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddPartner = async () => {
    if (!selectedComp || !partnerName.trim()) return;
    setError('');
    setLoading(true);
    try {
      const res = await participantApi.addPartner(selectedComp.id, {
        name: partnerName.trim(),
        role: partnerRole,
      });
      setMyCouples(prev => [...prev, res.data.couple]);
      setPartnerName('');
      setSuccess(`Partner added! Bib #${res.data.couple.bib}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      setError(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to add partner' : 'Failed to add partner');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterEntry = async () => {
    if (!selectedComp || !regBib) return;
    setError('');
    setLoading(true);
    try {
      const res = await participantApi.registerEntry(selectedComp.id, {
        bib: regBib,
        designation: regDesignation || undefined,
        syllabusType: regSyllabusType || undefined,
        level: regLevel || undefined,
        style: regStyle || undefined,
        dances: regDances.length > 0 ? regDances : undefined,
        scoringType: regScoringType || undefined,
        ageCategory: regAgeCategory || undefined,
      });
      const label = res.data.event.name;
      setSuccess(res.data.created ? `Created & registered for ${label}` : `Added to ${label}`);
      setTimeout(() => setSuccess(''), 4000);
      // Reset form fields but keep bib selected
      setRegDesignation('');
      setRegSyllabusType('');
      setRegLevel('');
      setRegStyle('');
      setRegDances([]);
      setRegScoringType('');
      setRegAgeCategory('');
      await loadMyData(selectedComp.id);
    } catch (err: unknown) {
      setError(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to register entry' : 'Failed to register entry');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveEntry = async (eventId: number, bib: number) => {
    if (!selectedComp) return;
    setError('');
    try {
      await participantApi.removeEntry(selectedComp.id, eventId, bib);
      await loadMyData(selectedComp.id);
    } catch (err: unknown) {
      setError(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to remove entry' : 'Failed to remove entry');
    }
  };

  const toggleDance = (dance: string) => {
    setRegDances(prev =>
      prev.includes(dance) ? prev.filter(d => d !== dance) : [...prev, dance]
    );
  };

  if (loadingComps) return (
    <div className="max-w-[900px] mx-auto p-8">
      <Skeleton variant="card" className="mb-4" />
      <Skeleton variant="card" />
    </div>
  );

  const levels = selectedComp?.levels || DEFAULT_LEVELS;

  return (
    <div className="max-w-[900px] mx-auto p-8">
      <div className="bg-white rounded-lg shadow p-6 mb-4">
        <h2 className="m-0 mb-1">Participant Portal</h2>
        <p className="text-gray-500 m-0">
          Register for competitions, manage your entries, and view your schedule.
        </p>
      </div>

      {error && <div className="px-4 py-3 bg-red-100 text-red-700 rounded mb-4 text-sm">{error}</div>}
      {success && (
        <div className="px-4 py-3 bg-green-100 border border-success-500 rounded-md mb-4 text-green-800">
          {success}
        </div>
      )}

      {/* Section 1: Competition Selection */}
      <div className="bg-white rounded-lg shadow p-6 mb-4">
        <h3 className="mt-0 mb-3">Select Competition</h3>
        {competitions.length === 0 ? (
          <p className="text-gray-500">No competitions are currently open for registration.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {competitions.map(comp => (
              <button
                key={comp.id}
                onClick={() => setSelectedComp(comp)}
                className={selectedComp?.id === comp.id
                  ? 'flex justify-between items-center p-3 bg-primary-50 border-2 border-primary-500 rounded-md cursor-pointer text-left transition-all'
                  : 'flex justify-between items-center p-3 bg-white border border-gray-200 rounded-md cursor-pointer text-left transition-all'}
              >
                <div>
                  <div className="font-semibold">{comp.name}</div>
                  <div className="text-sm text-gray-500">
                    {new Date(comp.date).toLocaleDateString()}
                    {comp.location && ` \u2022 ${comp.location}`}
                  </div>
                </div>
                {selectedComp?.id === comp.id && (
                  <span className="text-primary-500 font-semibold">Selected</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Registration */}
      {selectedComp && !myPerson && (
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h3 className="mt-0 mb-3">Register as Participant</h3>
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Your Name</label>
              <input
                type="text"
                value={regName}
                onChange={e => setRegName(e.target.value)}
                placeholder="First Last"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Role</label>
              <div className="flex gap-2">
                {(['leader', 'follower', 'both'] as const).map(r => (
                  <button key={r} type="button" className={toggleBtnCls(regRole === r)}
                    onClick={() => setRegRole(r)}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Status</label>
              <div className="flex gap-2">
                {(['student', 'professional'] as const).map(s => (
                  <button key={s} type="button" className={toggleBtnCls(regStatus === s)}
                    onClick={() => setRegStatus(s)}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {levels.length > 0 && selectedComp?.entryValidation?.enabled && (
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Your Skill Level</label>
                <p className="text-xs text-gray-500 mb-2">
                  This determines which event levels you can enter.
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {levels.map(lvl => (
                    <button key={lvl} type="button" className={toggleBtnCls(regDeclaredLevel === lvl)}
                      onClick={() => setRegDeclaredLevel(regDeclaredLevel === lvl ? '' : lvl)}>
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600" onClick={handleRegister} disabled={loading || !regName.trim()}>
              Register
            </button>
          </div>
        </div>
      )}

      {/* Section 2b: Already registered badge */}
      {selectedComp && myPerson && (
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="mt-0 mb-1">
                Registered as {myPerson.firstName} {myPerson.lastName}
              </h3>
              <div className="flex gap-2 flex-wrap">
                <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-semibold">
                  {myPerson.role} &middot; {myPerson.status}
                </span>
                {myPerson.level && (
                  <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                    {myPerson.level}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Partners & Couples */}
      {selectedComp && myPerson && (
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h3 className="mt-0 mb-3">Partners & Couples</h3>
          {myCouples.length > 0 && (
            <div className="mb-4">
              {myCouples.map(c => (
                <div key={c.bib} className="flex justify-between items-center px-3 py-2 bg-gray-50 rounded border border-gray-200 mb-2">
                  <span>
                    <strong>Bib #{c.bib}</strong> &mdash; {c.leaderName} & {c.followerName}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-semibold text-gray-600 mb-1">Partner Name</label>
              <input
                type="text"
                value={partnerName}
                onChange={e => setPartnerName(e.target.value)}
                placeholder="First Last"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Role</label>
              <div className="flex gap-1">
                {(['leader', 'follower', 'both'] as const).map(r => (
                  <button key={r} type="button" className={toggleBtnCls(partnerRole === r)}
                    onClick={() => setPartnerRole(r)}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <button className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600" onClick={handleAddPartner}
              disabled={loading || !partnerName.trim()}>
              Add Partner
            </button>
          </div>
        </div>
      )}

      {/* Section 4: Event Entries */}
      {selectedComp && myPerson && myCouples.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h3 className="mt-0 mb-3">Register for Events</h3>

          {/* Couple selector */}
          {myCouples.length > 1 && (
            <div className="mb-3">
              <label className="block text-sm font-semibold text-gray-600 mb-1">Select Couple</label>
              <select value={regBib || ''} onChange={e => setRegBib(parseInt(e.target.value) || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                <option value="">Choose a couple...</option>
                {myCouples.map(c => (
                  <option key={c.bib} value={c.bib}>
                    Bib #{c.bib} — {c.leaderName} & {c.followerName}
                  </option>
                ))}
              </select>
            </div>
          )}
          {myCouples.length === 1 && !regBib && (() => { setRegBib(myCouples[0].bib); return null; })()}

          {regBib && (
            <>
              {/* Combination builder */}
              <div className="p-4 bg-gray-50 rounded-md border border-gray-200 mb-4">
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block font-semibold text-sm mb-1">Designation</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {['Pro-Am', 'Amateur', 'Professional', 'Student'].map(opt => (
                        <button key={opt} type="button" className={toggleBtnCls(regDesignation === opt)}
                          onClick={() => setRegDesignation(regDesignation === opt ? '' : opt)}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-sm mb-1">Syllabus Type</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {['Syllabus', 'Open'].map(opt => (
                        <button key={opt} type="button" className={toggleBtnCls(regSyllabusType === opt)}
                          onClick={() => setRegSyllabusType(regSyllabusType === opt ? '' : opt)}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-sm mb-1">Level</label>
                    {validationEnabled && coupleLevel && (
                      <p className="text-xs text-gray-500 mb-2">
                        Based on your declared level ({coupleLevel}), you can enter these levels:
                      </p>
                    )}
                    {validationEnabled && !coupleLevel && (
                      <p className="text-xs text-danger-500 mb-2">
                        Please update your declared skill level to see available levels.
                      </p>
                    )}
                    <div className="flex gap-1.5 flex-wrap">
                      {(validationEnabled ? allowedLevels : levels).map(opt => (
                        <button key={opt} type="button" className={toggleBtnCls(regLevel === opt)}
                          onClick={() => setRegLevel(regLevel === opt ? '' : opt)}>
                          {opt}
                        </button>
                      ))}
                    </div>
                    {validationEnabled && levels.length > allowedLevels.length && (
                      <p className="text-xs text-gray-400 mt-1.5">
                        Contact an admin to enter levels outside your range.
                      </p>
                    )}
                  </div>

                  {availableAgeCategories.length > 0 && (
                    <div>
                      <label className="block font-semibold text-sm mb-1">Age Category</label>
                      <div className="flex gap-1.5 flex-wrap">
                        {availableAgeCategories.map(cat => (
                          <button key={cat.name} type="button" className={toggleBtnCls(regAgeCategory === cat.name)}
                            onClick={() => setRegAgeCategory(regAgeCategory === cat.name ? '' : cat.name)}>
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-sm mb-1">Style</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {['Smooth', 'Standard', 'Rhythm', 'Latin'].map(opt => (
                        <button key={opt} type="button" className={toggleBtnCls(regStyle === opt)}
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

                  {regStyle && (
                    <div>
                      <label className="block font-semibold text-sm mb-1">Dances</label>
                      <div className="flex gap-1.5 flex-wrap">
                        {getDancesForStyle(regStyle, selectedComp?.danceOrder).map(dance => (
                          <button key={dance} type="button" className={toggleBtnCls(regDances.includes(dance))}
                            onClick={() => toggleDance(dance)}>
                            {dance}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-sm mb-1">Scoring</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {['standard', 'proficiency'].map(opt => (
                        <button key={opt} type="button" className={toggleBtnCls(regScoringType === opt)}
                          onClick={() => setRegScoringType(regScoringType === opt ? '' : opt)}>
                          {opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 mt-3" onClick={handleRegisterEntry}
                  disabled={loading}>
                  Register for Event
                </button>
              </div>

              {/* Current entries for this couple */}
              {(() => {
                const coupleEntries = myEntries.filter(event =>
                  event.heats.some(h => h.bibs.includes(regBib!))
                );
                if (coupleEntries.length === 0) return (
                  <p className="text-gray-500 italic">No entries yet for this couple.</p>
                );
                return (
                  <div>
                    <h4 className="mt-0 mb-2 text-sm">
                      Current Entries ({coupleEntries.length})
                    </h4>
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">Event</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">Details</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coupleEntries.map(event => (
                          <tr key={event.id}>
                            <td className="px-3 py-2 border-t border-gray-100"><strong>{event.name}</strong></td>
                            <td className="px-3 py-2 border-t border-gray-100 text-sm text-gray-500">
                              {[event.designation, event.syllabusType, event.level, event.style,
                                event.dances?.join(', ')].filter(Boolean).join(' \u2022 ') || '\u2014'}
                            </td>
                            <td className="px-3 py-2 border-t border-gray-100">
                              <button className="px-2 py-1 bg-danger-500 text-white rounded border-none cursor-pointer text-xs font-medium transition-colors hover:bg-danger-600"
                                onClick={() => handleRemoveEntry(event.id, regBib!)}>
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* Section 5: My Schedule */}
      {selectedComp && myPerson && myEntries.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h3 className="mt-0 mb-3">My Schedule</h3>
          {schedule.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Time</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Event</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Round</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((item, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 border-t border-gray-100">
                      {item.estimatedStartTime
                        ? new Date(item.estimatedStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '\u2014'}
                    </td>
                    <td className="px-3 py-2 border-t border-gray-100">{item.eventName}</td>
                    <td className="px-3 py-2 border-t border-gray-100 capitalize">{item.round.replace('-', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center p-6 bg-amber-50 border border-amber-400 rounded-md">
              <p className="m-0 mb-2 font-semibold">Schedule not yet available</p>
              <p className="m-0 text-amber-900 text-sm">
                You are entered in {myEntries.length} event{myEntries.length !== 1 ? 's' : ''}. Times will appear once the schedule is generated.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ParticipantPortalPage;
