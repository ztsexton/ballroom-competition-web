import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { participantApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Competition, Person, Couple, Event, AgeCategory } from '../../types';
import { DEFAULT_LEVELS } from '../../constants/levels';

interface ScheduleItem {
  heatId: string;
  estimatedStartTime?: string;
  eventId: number;
  eventName: string;
  round: string;
}

const getDanceOptions = (s: string) => {
  if (s === 'Standard') return ['Waltz', 'Tango', 'Viennese Waltz', 'Foxtrot', 'Quickstep'];
  if (s === 'Latin') return ['Cha Cha', 'Samba', 'Rumba', 'Paso Doble', 'Jive'];
  if (s === 'Smooth') return ['Waltz', 'Tango', 'Foxtrot', 'Viennese Waltz'];
  if (s === 'Rhythm') return ['Cha Cha', 'Rumba', 'East Coast Swing', 'Bolero', 'Mambo'];
  return [];
};

const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '0.375rem 0.75rem',
  border: active ? '2px solid #667eea' : '1px solid #cbd5e0',
  borderRadius: '4px',
  background: active ? '#667eea' : 'white',
  color: active ? 'white' : '#2d3748',
  cursor: 'pointer',
  fontWeight: active ? 600 : 400,
  fontSize: '0.85rem',
  transition: 'all 0.15s',
});

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
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Registration failed';
      if (err.response?.data?.person) {
        setMyPerson(err.response.data.person);
      }
      setError(msg);
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add partner');
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to register entry');
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove entry');
    }
  };

  const toggleDance = (dance: string) => {
    setRegDances(prev =>
      prev.includes(dance) ? prev.filter(d => d !== dance) : [...prev, dance]
    );
  };

  if (loadingComps) return <div className="loading">Loading...</div>;

  const levels = selectedComp?.levels || DEFAULT_LEVELS;

  return (
    <div className="container" style={{ maxWidth: '900px' }}>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: '0 0 0.25rem' }}>Participant Portal</h2>
        <p style={{ color: '#718096', margin: 0 }}>
          Register for competitions, manage your entries, and view your schedule.
        </p>
      </div>

      {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && (
        <div style={{
          padding: '0.75rem 1rem',
          background: '#c6f6d5',
          border: '1px solid #48bb78',
          borderRadius: '6px',
          marginBottom: '1rem',
          color: '#276749',
        }}>
          {success}
        </div>
      )}

      {/* Section 1: Competition Selection */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 0.75rem' }}>Select Competition</h3>
        {competitions.length === 0 ? (
          <p style={{ color: '#718096' }}>No competitions are currently open for registration.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {competitions.map(comp => (
              <button
                key={comp.id}
                onClick={() => setSelectedComp(comp)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  background: selectedComp?.id === comp.id ? '#ebf4ff' : 'white',
                  border: selectedComp?.id === comp.id ? '2px solid #667eea' : '1px solid #e2e8f0',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{comp.name}</div>
                  <div style={{ fontSize: '0.875rem', color: '#718096' }}>
                    {new Date(comp.date).toLocaleDateString()}
                    {comp.location && ` \u2022 ${comp.location}`}
                  </div>
                </div>
                {selectedComp?.id === comp.id && (
                  <span style={{ color: '#667eea', fontWeight: 600 }}>Selected</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Registration */}
      {selectedComp && !myPerson && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 0.75rem' }}>Register as Participant</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Your Name</label>
              <input
                type="text"
                value={regName}
                onChange={e => setRegName(e.target.value)}
                placeholder="First Last"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Role</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['leader', 'follower', 'both'] as const).map(r => (
                  <button key={r} type="button" style={toggleBtnStyle(regRole === r)}
                    onClick={() => setRegRole(r)}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Status</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['student', 'professional'] as const).map(s => (
                  <button key={s} type="button" style={toggleBtnStyle(regStatus === s)}
                    onClick={() => setRegStatus(s)}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {levels.length > 0 && selectedComp?.entryValidation?.enabled && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Your Skill Level</label>
                <p style={{ fontSize: '0.8rem', color: '#718096', marginBottom: '0.5rem' }}>
                  This determines which event levels you can enter.
                </p>
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                  {levels.map(lvl => (
                    <button key={lvl} type="button" style={toggleBtnStyle(regDeclaredLevel === lvl)}
                      onClick={() => setRegDeclaredLevel(regDeclaredLevel === lvl ? '' : lvl)}>
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button className="btn" onClick={handleRegister} disabled={loading || !regName.trim()}>
              Register
            </button>
          </div>
        </div>
      )}

      {/* Section 2b: Already registered badge */}
      {selectedComp && myPerson && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 0.25rem' }}>
                Registered as {myPerson.firstName} {myPerson.lastName}
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-block',
                  padding: '0.125rem 0.5rem',
                  background: '#e9d8fd',
                  color: '#553c9a',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}>
                  {myPerson.role} &middot; {myPerson.status}
                </span>
                {myPerson.level && (
                  <span style={{
                    display: 'inline-block',
                    padding: '0.125rem 0.5rem',
                    background: '#bee3f8',
                    color: '#2c5282',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}>
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
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 0.75rem' }}>Partners & Couples</h3>
          {myCouples.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              {myCouples.map(c => (
                <div key={c.bib} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 0.75rem',
                  background: '#f7fafc',
                  borderRadius: '4px',
                  marginBottom: '0.5rem',
                  border: '1px solid #e2e8f0',
                }}>
                  <span>
                    <strong>Bib #{c.bib}</strong> &mdash; {c.leaderName} & {c.followerName}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0, minWidth: '200px' }}>
              <label>Partner Name</label>
              <input
                type="text"
                value={partnerName}
                onChange={e => setPartnerName(e.target.value)}
                placeholder="First Last"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Role</label>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {(['leader', 'follower', 'both'] as const).map(r => (
                  <button key={r} type="button" style={toggleBtnStyle(partnerRole === r)}
                    onClick={() => setPartnerRole(r)}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn" onClick={handleAddPartner}
              disabled={loading || !partnerName.trim()} style={{ marginBottom: 0 }}>
              Add Partner
            </button>
          </div>
        </div>
      )}

      {/* Section 4: Event Entries */}
      {selectedComp && myPerson && myCouples.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 0.75rem' }}>Register for Events</h3>

          {/* Couple selector */}
          {myCouples.length > 1 && (
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label>Select Couple</label>
              <select value={regBib || ''} onChange={e => setRegBib(parseInt(e.target.value) || null)}>
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
              <div style={{
                padding: '1rem',
                background: '#f7fafc',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                marginBottom: '1rem',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block' }}>Designation</label>
                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                      {['Pro-Am', 'Amateur', 'Professional', 'Student'].map(opt => (
                        <button key={opt} type="button" style={toggleBtnStyle(regDesignation === opt)}
                          onClick={() => setRegDesignation(regDesignation === opt ? '' : opt)}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block' }}>Syllabus Type</label>
                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                      {['Syllabus', 'Open'].map(opt => (
                        <button key={opt} type="button" style={toggleBtnStyle(regSyllabusType === opt)}
                          onClick={() => setRegSyllabusType(regSyllabusType === opt ? '' : opt)}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block' }}>Level</label>
                    {validationEnabled && coupleLevel && (
                      <p style={{ fontSize: '0.8rem', color: '#718096', marginBottom: '0.5rem' }}>
                        Based on your declared level ({coupleLevel}), you can enter these levels:
                      </p>
                    )}
                    {validationEnabled && !coupleLevel && (
                      <p style={{ fontSize: '0.8rem', color: '#e53e3e', marginBottom: '0.5rem' }}>
                        Please update your declared skill level to see available levels.
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                      {(validationEnabled ? allowedLevels : levels).map(opt => (
                        <button key={opt} type="button" style={toggleBtnStyle(regLevel === opt)}
                          onClick={() => setRegLevel(regLevel === opt ? '' : opt)}>
                          {opt}
                        </button>
                      ))}
                    </div>
                    {validationEnabled && levels.length > allowedLevels.length && (
                      <p style={{ fontSize: '0.75rem', color: '#a0aec0', marginTop: '0.375rem' }}>
                        Contact an admin to enter levels outside your range.
                      </p>
                    )}
                  </div>

                  {availableAgeCategories.length > 0 && (
                    <div>
                      <label style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block' }}>Age Category</label>
                      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                        {availableAgeCategories.map(cat => (
                          <button key={cat.name} type="button" style={toggleBtnStyle(regAgeCategory === cat.name)}
                            onClick={() => setRegAgeCategory(regAgeCategory === cat.name ? '' : cat.name)}>
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block' }}>Style</label>
                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                      {['Smooth', 'Standard', 'Rhythm', 'Latin'].map(opt => (
                        <button key={opt} type="button" style={toggleBtnStyle(regStyle === opt)}
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
                      <label style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block' }}>Dances</label>
                      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                        {getDanceOptions(regStyle).map(dance => (
                          <button key={dance} type="button" style={toggleBtnStyle(regDances.includes(dance))}
                            onClick={() => toggleDance(dance)}>
                            {dance}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block' }}>Scoring</label>
                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                      {['standard', 'proficiency'].map(opt => (
                        <button key={opt} type="button" style={toggleBtnStyle(regScoringType === opt)}
                          onClick={() => setRegScoringType(regScoringType === opt ? '' : opt)}>
                          {opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button className="btn" onClick={handleRegisterEntry}
                  disabled={loading}
                  style={{ marginTop: '0.75rem' }}>
                  Register for Event
                </button>
              </div>

              {/* Current entries for this couple */}
              {(() => {
                const coupleEntries = myEntries.filter(event =>
                  event.heats.some(h => h.bibs.includes(regBib!))
                );
                if (coupleEntries.length === 0) return (
                  <p style={{ color: '#718096', fontStyle: 'italic' }}>No entries yet for this couple.</p>
                );
                return (
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
                      Current Entries ({coupleEntries.length})
                    </h4>
                    <table>
                      <thead>
                        <tr>
                          <th>Event</th>
                          <th>Details</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coupleEntries.map(event => (
                          <tr key={event.id}>
                            <td><strong>{event.name}</strong></td>
                            <td style={{ fontSize: '0.85rem', color: '#718096' }}>
                              {[event.designation, event.syllabusType, event.level, event.style,
                                event.dances?.join(', ')].filter(Boolean).join(' \u2022 ') || '\u2014'}
                            </td>
                            <td>
                              <button className="btn btn-danger"
                                style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
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
        <div className="card">
          <h3 style={{ margin: '0 0 0.75rem' }}>My Schedule</h3>
          {schedule.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event</th>
                  <th>Round</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((item, i) => (
                  <tr key={i}>
                    <td>
                      {item.estimatedStartTime
                        ? new Date(item.estimatedStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '\u2014'}
                    </td>
                    <td>{item.eventName}</td>
                    <td style={{ textTransform: 'capitalize' }}>{item.round.replace('-', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '1.5rem',
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '6px',
            }}>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>Schedule not yet available</p>
              <p style={{ margin: 0, color: '#78350f', fontSize: '0.875rem' }}>
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
