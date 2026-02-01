import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { peopleApi, couplesApi, judgesApi, studiosApi } from '../api/client';
import { Person, Couple, Judge, Studio } from '../types';
import { useCompetition } from '../context/CompetitionContext';

const CompetitionEntriesPage = () => {
  const { activeCompetition } = useCompetition();
  const competitionId = activeCompetition?.id || 0;

  const [people, setPeople] = useState<Person[]>([]);
  const [couples, setCouples] = useState<Couple[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Collapse state
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    people: true,
    couples: true,
    judges: true,
  });

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
    } catch {
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
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

  if (loading) return <div className="loading">Loading...</div>;

  const sectionHeaderStyle = (): React.CSSProperties => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    userSelect: 'none',
    padding: '0.75rem 0',
  });

  const chevron = (key: string) => expanded[key] ? '▾' : '▸';

  return (
    <div className="container">
      {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* ====== PEOPLE ====== */}
      <div className="card">
        <div style={sectionHeaderStyle()} onClick={() => toggleSection('people')}>
          <h3 style={{ margin: 0 }}>
            <span style={{ marginRight: '0.5rem', color: '#a0aec0' }}>{chevron('people')}</span>
            People ({people.length})
          </h3>
        </div>

        {expanded.people && (
          <div>
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
      </div>

      {/* ====== COUPLES ====== */}
      <div className="card">
        <div style={sectionHeaderStyle()} onClick={() => toggleSection('couples')}>
          <h3 style={{ margin: 0 }}>
            <span style={{ marginRight: '0.5rem', color: '#a0aec0' }}>{chevron('couples')}</span>
            Couples ({couples.length})
          </h3>
        </div>

        {expanded.couples && (
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
              <table>
                <thead>
                  <tr>
                    <th>Bib #</th>
                    <th>Leader</th>
                    <th>Follower</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {couples.map(couple => (
                    <tr key={couple.bib}>
                      <td><strong>#{couple.bib}</strong></td>
                      <td>{couple.leaderName}</td>
                      <td>{couple.followerName}</td>
                      <td>
                        <button onClick={() => handleDeleteCouple(couple.bib)}
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
      </div>

      {/* ====== JUDGES ====== */}
      <div className="card">
        <div style={sectionHeaderStyle()} onClick={() => toggleSection('judges')}>
          <h3 style={{ margin: 0 }}>
            <span style={{ marginRight: '0.5rem', color: '#a0aec0' }}>{chevron('judges')}</span>
            Judges ({judges.length})
          </h3>
        </div>

        {expanded.judges && (
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
        )}
      </div>
    </div>
  );
};

export default CompetitionEntriesPage;
