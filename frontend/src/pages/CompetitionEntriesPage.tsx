import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { peopleApi, couplesApi, judgesApi, studiosApi, mindbodyApi, eventsApi } from '../api/client';
import { Person, Couple, Judge, Studio, MindbodyClient, Event, AgeCategory } from '../types';
import { useCompetition } from '../context/CompetitionContext';
import { DEFAULT_LEVELS } from '../constants/levels';

const CompetitionEntriesPage = () => {
  const { activeCompetition } = useCompetition();
  const competitionId = activeCompetition?.id || 0;

  const [people, setPeople] = useState<Person[]>([]);
  const [couples, setCouples] = useState<Couple[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Tab state
  const [activeTab, setActiveTab] = useState<'people' | 'couples' | 'judges'>('people');

  // People form
  const [newPerson, setNewPerson] = useState({
    firstName: '', lastName: '', email: '',
    role: 'both' as Person['role'],
    status: 'student' as Person['status'],
    studioId: '' as string | number,
  });

  // Couples form
  const [leaderId, setLeaderId] = useState('');
  const [followerId, setFollowerId] = useState('');
  const [coupleError, setCoupleError] = useState('');

  // Judges form
  const [newJudgeName, setNewJudgeName] = useState('');

  // Registration panel state
  const [registerBib, setRegisterBib] = useState<number | null>(null);
  const [regDesignation, setRegDesignation] = useState('');
  const [regSyllabusType, setRegSyllabusType] = useState('');
  const [regLevel, setRegLevel] = useState('');
  const [regStyle, setRegStyle] = useState('');
  const [regDances, setRegDances] = useState<string[]>([]);
  const [regScoringType, setRegScoringType] = useState<'standard' | 'proficiency'>(
    activeCompetition?.defaultScoringType || 'standard'
  );
  const [regAgeCategory, setRegAgeCategory] = useState('');
  const [availableAgeCategories, setAvailableAgeCategories] = useState<AgeCategory[]>([]);
  const [regLoading, setRegLoading] = useState(false);
  const [regMessage, setRegMessage] = useState('');
  const [regError, setRegError] = useState('');
  const [coupleEvents, setCoupleEvents] = useState<Event[]>([]);
  const [coupleEventsLoading, setCoupleEventsLoading] = useState(false);

  // MindBody import state
  const [showMbImport, setShowMbImport] = useState(false);
  const [mbStudioId, setMbStudioId] = useState<number | ''>('');
  const [mbSearchText, setMbSearchText] = useState('');
  const [mbClients, setMbClients] = useState<MindbodyClient[]>([]);
  const [mbSelected, setMbSelected] = useState<Set<string>>(new Set());
  const [mbLoading, setMbLoading] = useState(false);
  const [mbImporting, setMbImporting] = useState(false);
  const [mbError, setMbError] = useState('');
  const [mbRole, setMbRole] = useState<Person['role']>('both');
  const [mbStatus, setMbStatus] = useState<Person['status']>('student');

  useEffect(() => {
    if (competitionId) loadAllData();
  }, [competitionId]);

  const loadAllData = async () => {
    if (!competitionId) return;
    try {
      const [peopleRes, couplesRes, judgesRes, studiosRes] = await Promise.all([
        peopleApi.getAll(competitionId),
        couplesApi.getAll(competitionId),
        judgesApi.getAll(competitionId),
        studiosApi.getAll(),
      ]);
      setPeople(peopleRes.data);
      setCouples(couplesRes.data);
      setJudges(judgesRes.data);
      setStudios(studiosRes.data);
      setError('');

      // Load age categories from competition
      if (activeCompetition?.ageCategories?.length) {
        setAvailableAgeCategories(activeCompetition.ageCategories);
      }
    } catch {
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  };


  // --- People handlers ---

  const handleAddPerson = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPerson.firstName || !newPerson.lastName || !competitionId) return;
    try {
      await peopleApi.create({
        ...newPerson,
        studioId: newPerson.studioId ? Number(newPerson.studioId) : undefined,
        email: newPerson.email || undefined,
        competitionId,
      });
      setNewPerson({ firstName: '', lastName: '', email: '', role: 'both', status: 'student', studioId: '' });
      loadAllData();
    } catch {
      setError('Failed to add person.');
    }
  };

  const handleDeletePerson = async (id: number) => {
    if (!window.confirm('Delete this person?')) return;
    try {
      await peopleApi.delete(id);
      loadAllData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete person');
    }
  };

  // --- Couples handlers ---

  const leaders = people.filter(p => p.role === 'leader' || p.role === 'both');
  const followers = people.filter(p => p.role === 'follower' || p.role === 'both');

  const handleAddCouple = async (e: FormEvent) => {
    e.preventDefault();
    if (!leaderId || !followerId || !competitionId) return;
    try {
      await couplesApi.create(parseInt(leaderId), parseInt(followerId), competitionId);
      setLeaderId('');
      setFollowerId('');
      setCoupleError('');
      loadAllData();
    } catch (err: any) {
      setCoupleError(err.response?.data?.error || 'Failed to add couple');
    }
  };

  const handleDeleteCouple = async (bib: number) => {
    if (!window.confirm('Delete this couple?')) return;
    try {
      await couplesApi.delete(bib);
      setCoupleError('');
      loadAllData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete couple');
    }
  };

  // --- Judges handlers ---

  const handleAddJudge = async (e: FormEvent) => {
    e.preventDefault();
    if (!newJudgeName.trim() || !competitionId) return;
    try {
      await judgesApi.create(newJudgeName.trim(), competitionId);
      setNewJudgeName('');
      loadAllData();
    } catch {
      setError('Failed to add judge.');
    }
  };

  const handleDeleteJudge = async (id: number) => {
    if (!window.confirm('Delete this judge?')) return;
    try {
      await judgesApi.delete(id);
      loadAllData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete judge');
    }
  };

  // --- Registration handlers ---

  const getDanceOptions = (s: string) => {
    if (s === 'Standard') return ['Waltz', 'Tango', 'Viennese Waltz', 'Foxtrot', 'Quickstep'];
    if (s === 'Latin') return ['Cha Cha', 'Samba', 'Rumba', 'Paso Doble', 'Jive'];
    if (s === 'Smooth') return ['Waltz', 'Tango', 'Foxtrot', 'Viennese Waltz'];
    if (s === 'Rhythm') return ['Cha Cha', 'Rumba', 'East Coast Swing', 'Bolero', 'Mambo'];
    return [];
  };

  const openRegisterPanel = async (bib: number) => {
    if (registerBib === bib) {
      setRegisterBib(null);
      return;
    }
    setRegisterBib(bib);
    setRegDesignation('');
    setRegSyllabusType('');
    setRegLevel('');
    setRegStyle('');
    setRegDances([]);
    setRegScoringType(activeCompetition?.defaultScoringType || 'standard');
    setRegMessage('');
    setRegError('');
    setCoupleEventsLoading(true);
    try {
      const res = await couplesApi.getEvents(bib);
      setCoupleEvents(res.data);
    } catch {
      setCoupleEvents([]);
    } finally {
      setCoupleEventsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!registerBib || !competitionId) return;
    setRegLoading(true);
    setRegMessage('');
    setRegError('');
    try {
      const res = await eventsApi.register({
        competitionId,
        bib: registerBib,
        designation: regDesignation || undefined,
        syllabusType: regSyllabusType || undefined,
        level: regLevel || undefined,
        style: regStyle || undefined,
        dances: regDances.length > 0 ? regDances : undefined,
        scoringType: regScoringType,
        ageCategory: regAgeCategory || undefined,
      });
      const action = res.data.created ? 'Created & registered for' : 'Registered for';
      setRegMessage(`${action} ${res.data.event.name}`);
      // Refresh couple events
      const evRes = await couplesApi.getEvents(registerBib);
      setCoupleEvents(evRes.data);
    } catch (err: any) {
      setRegError(err.response?.data?.error || 'Failed to register');
    } finally {
      setRegLoading(false);
    }
  };

  const handleRemoveEntry = async (eventId: number) => {
    if (!registerBib) return;
    try {
      await eventsApi.removeEntry(eventId, registerBib);
      const evRes = await couplesApi.getEvents(registerBib);
      setCoupleEvents(evRes.data);
    } catch (err: any) {
      setRegError(err.response?.data?.error || 'Failed to remove entry');
    }
  };

  // --- MindBody handlers ---

  const connectedStudios = studios.filter(s => !!s.mindbodySiteId);

  const handleMbSearch = async () => {
    if (!mbStudioId) return;
    setMbLoading(true);
    setMbError('');
    try {
      const res = await mindbodyApi.getClients(mbStudioId as number, {
        searchText: mbSearchText || undefined,
        limit: 200,
      });
      setMbClients(res.data.clients);
      setMbSelected(new Set());
    } catch (err: any) {
      setMbError(err?.response?.data?.error || 'Failed to fetch clients');
      setMbClients([]);
    } finally {
      setMbLoading(false);
    }
  };

  const handleMbToggle = (id: string) => {
    setMbSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleMbSelectAll = () => {
    if (mbSelected.size === mbClients.length) {
      setMbSelected(new Set());
    } else {
      setMbSelected(new Set(mbClients.map(c => c.id)));
    }
  };

  const handleMbImport = async () => {
    if (!mbStudioId || mbSelected.size === 0 || !competitionId) return;
    setMbImporting(true);
    setMbError('');
    try {
      const clients = mbClients
        .filter(c => mbSelected.has(c.id))
        .map(c => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          role: mbRole,
          status: mbStatus,
        }));
      const res = await mindbodyApi.importClients(mbStudioId as number, competitionId, clients);
      alert(`Imported ${res.data.imported} people.`);
      setShowMbImport(false);
      setMbClients([]);
      setMbSelected(new Set());
      loadAllData();
    } catch (err: any) {
      setMbError(err?.response?.data?.error || 'Failed to import clients');
    } finally {
      setMbImporting(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  const tabStyle = (tab: string): React.CSSProperties => ({
    padding: '0.75rem 1.25rem',
    background: 'none',
    border: 'none',
    borderBottom: activeTab === tab ? '3px solid #667eea' : '3px solid transparent',
    color: activeTab === tab ? '#667eea' : '#718096',
    fontWeight: activeTab === tab ? 600 : 400,
    fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'all 0.15s',
  });

  return (
    <div className="container">
      {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #e2e8f0',
        marginBottom: '1rem',
        gap: '0.25rem',
      }}>
        <button style={tabStyle('people')} onClick={() => setActiveTab('people')}>
          People ({people.length})
        </button>
        <button style={tabStyle('couples')} onClick={() => setActiveTab('couples')}>
          Couples ({couples.length})
        </button>
        <button style={tabStyle('judges')} onClick={() => setActiveTab('judges')}>
          Judges ({judges.length})
        </button>
      </div>

      {/* ====== PEOPLE TAB ====== */}
      {activeTab === 'people' && (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>People</h3>
          {connectedStudios.length > 0 && (
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}
              onClick={() => setShowMbImport(!showMbImport)}
            >
              {showMbImport ? 'Close Import' : 'Import from MindBody'}
            </button>
          )}
        </div>

        {/* MindBody Import Panel */}
        {showMbImport && (
          <div style={{
            background: '#f0f4ff',
            border: '1px solid #c3dafe',
            borderRadius: '8px',
            padding: '1.25rem',
            marginBottom: '1rem',
          }}>
            <h4 style={{ margin: '0 0 0.75rem 0' }}>Import from MindBody</h4>
            {mbError && <div className="error" style={{ marginBottom: '0.75rem' }}>{mbError}</div>}

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'end', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <div className="form-group" style={{ marginBottom: 0, minWidth: '160px' }}>
                <label style={{ fontSize: '0.8rem' }}>Studio</label>
                <select value={mbStudioId} onChange={e => setMbStudioId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Select Studio</option>
                  {connectedStudios.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '200px' }}>
                <label style={{ fontSize: '0.8rem' }}>Search (name, email, phone)</label>
                <input
                  type="text"
                  value={mbSearchText}
                  onChange={e => setMbSearchText(e.target.value)}
                  placeholder="Leave blank to fetch all"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleMbSearch(); } }}
                />
              </div>
              <button
                className="btn"
                style={{ marginBottom: 0, fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}
                disabled={!mbStudioId || mbLoading}
                onClick={handleMbSearch}
              >
                {mbLoading ? 'Loading...' : 'Fetch Clients'}
              </button>
            </div>

            {mbClients.length > 0 && (
              <>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'end', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.8rem' }}>Role for imports</label>
                    <select value={mbRole} onChange={e => setMbRole(e.target.value as Person['role'])}>
                      <option value="both">Both</option>
                      <option value="leader">Leader</option>
                      <option value="follower">Follower</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.8rem' }}>Status for imports</label>
                    <select value={mbStatus} onChange={e => setMbStatus(e.target.value as Person['status'])}>
                      <option value="student">Student</option>
                      <option value="professional">Professional</option>
                    </select>
                  </div>
                  <button
                    className="btn"
                    style={{ marginBottom: 0, fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}
                    disabled={mbSelected.size === 0 || mbImporting}
                    onClick={handleMbImport}
                  >
                    {mbImporting ? 'Importing...' : `Import Selected (${mbSelected.size})`}
                  </button>
                </div>

                <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <table style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: '2.5rem' }}>
                          <input
                            type="checkbox"
                            checked={mbSelected.size === mbClients.length && mbClients.length > 0}
                            onChange={handleMbSelectAll}
                          />
                        </th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Active</th>
                        <th>Last Activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mbClients.map(client => (
                        <tr key={client.id} style={{ opacity: client.isActive ? 1 : 0.5 }}>
                          <td>
                            <input
                              type="checkbox"
                              checked={mbSelected.has(client.id)}
                              onChange={() => handleMbToggle(client.id)}
                            />
                          </td>
                          <td>{client.firstName} {client.lastName}</td>
                          <td style={{ fontSize: '0.85rem' }}>{client.email || '-'}</td>
                          <td style={{ fontSize: '0.85rem' }}>{client.phone || '-'}</td>
                          <td>{client.isActive ? 'Yes' : 'No'}</td>
                          <td style={{ fontSize: '0.85rem' }}>{client.lastActivityDate || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ color: '#718096', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  {mbClients.length} clients loaded. {mbSelected.size} selected.
                </p>
              </>
            )}
          </div>
        )}

            <form onSubmit={handleAddPerson} style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr 1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>First Name</label>
                  <input type="text" value={newPerson.firstName}
                    onChange={e => setNewPerson({ ...newPerson, firstName: e.target.value })} required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Last Name</label>
                  <input type="text" value={newPerson.lastName}
                    onChange={e => setNewPerson({ ...newPerson, lastName: e.target.value })} required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Email</label>
                  <input type="email" value={newPerson.email}
                    onChange={e => setNewPerson({ ...newPerson, email: e.target.value })} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Role</label>
                  <select value={newPerson.role}
                    onChange={e => setNewPerson({ ...newPerson, role: e.target.value as Person['role'] })}>
                    <option value="leader">Leader</option>
                    <option value="follower">Follower</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Status</label>
                  <select value={newPerson.status}
                    onChange={e => setNewPerson({ ...newPerson, status: e.target.value as Person['status'] })}>
                    <option value="student">Student</option>
                    <option value="professional">Professional</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Studio</label>
                  <select value={newPerson.studioId}
                    onChange={e => setNewPerson({ ...newPerson, studioId: e.target.value })}>
                    <option value="">None</option>
                    {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <button type="submit" className="btn" style={{ marginBottom: 0 }}>Add</button>
              </div>
            </form>

            {people.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '1rem', color: '#718096' }}>No people added yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>First Name</th>
                    <th>Last Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Studio</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map(person => (
                    <tr key={person.id}>
                      <td>{person.firstName}</td>
                      <td>{person.lastName}</td>
                      <td>{person.email || ''}</td>
                      <td>{person.role}</td>
                      <td>{person.status}</td>
                      <td>{studios.find(s => s.id === person.studioId)?.name || ''}</td>
                      <td>
                        <button onClick={() => handleDeletePerson(person.id)}
                          className="btn btn-danger" style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
      </div>
      )}

      {/* ====== COUPLES TAB ====== */}
      {activeTab === 'couples' && (
      <div className="card">
        <h3 style={{ margin: '0 0 0.75rem' }}>Couples</h3>
          <div>
            {coupleError && <div className="error" style={{ marginBottom: '0.5rem' }}>{coupleError}</div>}

            {people.length === 0 ? (
              <p style={{ color: '#718096', padding: '1rem', textAlign: 'center' }}>
                Add people first before creating couples.
              </p>
            ) : (
              <form onSubmit={handleAddCouple} style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Leader</label>
                    <select value={leaderId} onChange={e => setLeaderId(e.target.value)} required>
                      <option value="">Select Leader</option>
                      {leaders.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName} {p.status === 'professional' ? '(Pro)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Follower</label>
                    <select value={followerId} onChange={e => setFollowerId(e.target.value)} required>
                      <option value="">Select Follower</option>
                      {followers.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName} {p.status === 'professional' ? '(Pro)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="btn" style={{ marginBottom: 0 }}>Add Couple</button>
                </div>
              </form>
            )}

            {couples.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '1rem', color: '#718096' }}>No couples created yet.</p>
            ) : (
              <div>
                {couples.map(couple => {
                  const isOpen = registerBib === couple.bib;
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

                  return (
                    <div key={couple.bib} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.625rem 0',
                        gap: '1rem',
                      }}>
                        <strong style={{ minWidth: '3rem' }}>#{couple.bib}</strong>
                        <span style={{ flex: 1 }}>{couple.leaderName} & {couple.followerName}</span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => openRegisterPanel(couple.bib)}
                            className="btn"
                            style={{
                              fontSize: '0.875rem',
                              padding: '0.25rem 0.5rem',
                              background: isOpen ? '#4c51bf' : undefined,
                            }}
                          >
                            {isOpen ? 'Close' : 'Register'}
                          </button>
                          <button
                            onClick={() => handleDeleteCouple(couple.bib)}
                            className="btn btn-danger"
                            style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {isOpen && (
                        <div style={{
                          background: '#f7fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '1rem',
                          marginBottom: '0.75rem',
                        }}>
                          <h4 style={{ margin: '0 0 0.75rem', color: '#4a5568' }}>
                            Register #{couple.bib} for an event
                          </h4>

                          {regError && <div className="error" style={{ marginBottom: '0.5rem' }}>{regError}</div>}
                          {regMessage && (
                            <div style={{
                              background: '#c6f6d5',
                              color: '#276749',
                              padding: '0.5rem 0.75rem',
                              borderRadius: '4px',
                              marginBottom: '0.75rem',
                              fontSize: '0.875rem',
                            }}>
                              {regMessage}
                            </div>
                          )}

                          {/* Combination builder */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                            <div>
                              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#718096', display: 'block', marginBottom: '0.25rem' }}>Designation</label>
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
                              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#718096', display: 'block', marginBottom: '0.25rem' }}>Syllabus Type</label>
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
                              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#718096', display: 'block', marginBottom: '0.25rem' }}>Level</label>
                              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                                {(activeCompetition?.levels?.length ? activeCompetition.levels : DEFAULT_LEVELS).map(opt => (
                                  <button key={opt} type="button" style={toggleBtnStyle(regLevel === opt)}
                                    onClick={() => setRegLevel(regLevel === opt ? '' : opt)}>
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {availableAgeCategories.length > 0 && (
                              <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#718096', display: 'block', marginBottom: '0.25rem' }}>Age Category</label>
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
                              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#718096', display: 'block', marginBottom: '0.25rem' }}>Style</label>
                              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                                {['Standard', 'Latin', 'Smooth', 'Rhythm'].map(opt => (
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

                            {regStyle && getDanceOptions(regStyle).length > 0 && (
                              <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#718096', display: 'block', marginBottom: '0.25rem' }}>
                                  Dances {regDances.length > 0 && `(${regDances.length})`}
                                </label>
                                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                                  {getDanceOptions(regStyle).map(d => (
                                    <button key={d} type="button" style={toggleBtnStyle(regDances.includes(d))}
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
                              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#718096', display: 'block', marginBottom: '0.25rem' }}>Scoring</label>
                              <div style={{ display: 'flex', gap: '0.375rem' }}>
                                {(['standard', 'proficiency'] as const).map(opt => (
                                  <button key={opt} type="button" style={toggleBtnStyle(regScoringType === opt)}
                                    onClick={() => setRegScoringType(opt)}>
                                    {opt === 'standard' ? 'Standard' : 'Proficiency'}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <button
                              className="btn"
                              onClick={handleRegister}
                              disabled={regLoading}
                              style={{ alignSelf: 'flex-start', marginTop: '0.25rem' }}
                            >
                              {regLoading ? 'Registering...' : 'Register for Event'}
                            </button>
                          </div>

                          {/* Current events for this couple */}
                          <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                            <h4 style={{ margin: '0 0 0.5rem', color: '#4a5568', fontSize: '0.9rem' }}>
                              Currently Entered ({coupleEventsLoading ? '...' : coupleEvents.length} events)
                            </h4>
                            {coupleEventsLoading ? (
                              <p style={{ color: '#a0aec0', fontSize: '0.85rem' }}>Loading...</p>
                            ) : coupleEvents.length === 0 ? (
                              <p style={{ color: '#a0aec0', fontSize: '0.85rem' }}>Not entered in any events yet.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                {coupleEvents.map(ev => (
                                  <div key={ev.id} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.375rem 0.5rem',
                                    background: 'white',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '4px',
                                    fontSize: '0.875rem',
                                  }}>
                                    <span>
                                      <strong>{ev.name}</strong>
                                      <span style={{ color: '#718096', marginLeft: '0.5rem' }}>
                                        {[ev.designation, ev.level, ev.dances?.join(', ')].filter(Boolean).join(' \u2022 ')}
                                      </span>
                                    </span>
                                    <button
                                      onClick={() => handleRemoveEntry(ev.id)}
                                      className="btn btn-danger"
                                      style={{ fontSize: '0.8rem', padding: '0.125rem 0.5rem' }}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
      </div>
      )}

      {/* ====== JUDGES TAB ====== */}
      {activeTab === 'judges' && (
      <div className="card">
        <h3 style={{ margin: '0 0 0.75rem' }}>Judges</h3>
          <div>
            <form onSubmit={handleAddJudge} style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Judge Name</label>
                  <input type="text" value={newJudgeName}
                    onChange={e => setNewJudgeName(e.target.value)} placeholder="Enter judge name" required />
                </div>
                <button type="submit" className="btn" style={{ marginBottom: 0 }}>Add Judge</button>
              </div>
            </form>

            {judges.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '1rem', color: '#718096' }}>No judges added yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Judge #</th>
                    <th>Name</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {judges.map(judge => (
                    <tr key={judge.id}>
                      <td><strong>#{judge.judgeNumber}</strong></td>
                      <td>{judge.name}</td>
                      <td>
                        <button onClick={() => handleDeleteJudge(judge.id)}
                          className="btn btn-danger" style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
      </div>
      )}
    </div>
  );
};

export default CompetitionEntriesPage;
