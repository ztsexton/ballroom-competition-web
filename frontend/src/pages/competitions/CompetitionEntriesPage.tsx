import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { peopleApi, couplesApi, judgesApi, studiosApi, mindbodyApi, eventsApi } from '../../api/client';
import { Person, Couple, Judge, Studio, MindbodyClient, Event, AgeCategory } from '../../types';
import { useCompetition } from '../../context/CompetitionContext';
import { DEFAULT_LEVELS } from '../../constants/levels';
import { Skeleton } from '../../components/Skeleton';

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
    } catch (err: unknown) {
      alert(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to delete person' : 'Failed to delete person');
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
    } catch (err: unknown) {
      setCoupleError(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to add couple' : 'Failed to add couple');
    }
  };

  const handleDeleteCouple = async (bib: number) => {
    if (!window.confirm('Delete this couple?')) return;
    try {
      await couplesApi.delete(bib);
      setCoupleError('');
      loadAllData();
    } catch (err: unknown) {
      alert(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to delete couple' : 'Failed to delete couple');
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
    } catch (err: unknown) {
      alert(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to delete judge' : 'Failed to delete judge');
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
    } catch (err: unknown) {
      setRegError(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to register' : 'Failed to register');
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
    } catch (err: unknown) {
      setRegError(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to remove entry' : 'Failed to remove entry');
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
    } catch (err: unknown) {
      setMbError(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to fetch clients' : 'Failed to fetch clients');
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
    } catch (err: unknown) {
      setMbError(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to import clients' : 'Failed to import clients');
    } finally {
      setMbImporting(false);
    }
  };

  const toggleBtnClass = (active: boolean) =>
    active
      ? 'px-3 py-1.5 rounded border-2 border-primary-500 bg-primary-500 text-white cursor-pointer font-semibold text-sm transition-all'
      : 'px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 cursor-pointer font-normal text-sm transition-all';

  if (loading) return <div className="max-w-7xl mx-auto p-8"><Skeleton variant="card" className="mb-4" /><Skeleton variant="table" rows={5} cols={4} /></div>;

  return (
    <div className="max-w-7xl mx-auto p-8">
      {error && <div className="text-danger-500 mt-2 mb-4">{error}</div>}

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-4 gap-1">
        <button
          className={`px-5 py-3 bg-transparent border-none cursor-pointer text-[0.95rem] transition-all ${activeTab === 'people' ? 'text-primary-500 border-b-[3px] border-primary-500 font-semibold' : 'text-gray-500 border-b-[3px] border-transparent'}`}
          onClick={() => setActiveTab('people')}
        >
          People ({people.length})
        </button>
        <button
          className={`px-5 py-3 bg-transparent border-none cursor-pointer text-[0.95rem] transition-all ${activeTab === 'couples' ? 'text-primary-500 border-b-[3px] border-primary-500 font-semibold' : 'text-gray-500 border-b-[3px] border-transparent'}`}
          onClick={() => setActiveTab('couples')}
        >
          Couples ({couples.length})
        </button>
        <button
          className={`px-5 py-3 bg-transparent border-none cursor-pointer text-[0.95rem] transition-all ${activeTab === 'judges' ? 'text-primary-500 border-b-[3px] border-primary-500 font-semibold' : 'text-gray-500 border-b-[3px] border-transparent'}`}
          onClick={() => setActiveTab('judges')}
        >
          Judges ({judges.length})
        </button>
      </div>

      {/* ====== PEOPLE TAB ====== */}
      {activeTab === 'people' && (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="m-0">People</h3>
          {connectedStudios.length > 0 && (
            <button
              className="px-3 py-1.5 bg-gray-500 text-white rounded border-none cursor-pointer text-xs font-medium transition-colors hover:bg-gray-600"
              onClick={() => setShowMbImport(!showMbImport)}
            >
              {showMbImport ? 'Close Import' : 'Import from MindBody'}
            </button>
          )}
        </div>

        {/* MindBody Import Panel */}
        {showMbImport && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-4">
            <h4 className="mt-0 mb-3">Import from MindBody</h4>
            {mbError && <div className="text-danger-500 mt-2 mb-3">{mbError}</div>}

            <div className="flex gap-3 items-end flex-wrap mb-3">
              <div className="mb-0 min-w-[160px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Studio</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" value={mbStudioId} onChange={e => setMbStudioId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Select Studio</option>
                  {connectedStudios.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="mb-0 flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Search (name, email, phone)</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  type="text"
                  value={mbSearchText}
                  onChange={e => setMbSearchText(e.target.value)}
                  placeholder="Leave blank to fetch all"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleMbSearch(); } }}
                />
              </div>
              <button
                className="px-3 py-1.5 bg-primary-500 text-white rounded border-none cursor-pointer text-xs font-medium transition-colors hover:bg-primary-600 mb-0"
                disabled={!mbStudioId || mbLoading}
                onClick={handleMbSearch}
              >
                {mbLoading ? 'Loading...' : 'Fetch Clients'}
              </button>
            </div>

            {mbClients.length > 0 && (
              <>
                <div className="flex gap-3 items-end flex-wrap mb-3">
                  <div className="mb-0">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Role for imports</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" value={mbRole} onChange={e => setMbRole(e.target.value as Person['role'])}>
                      <option value="both">Both</option>
                      <option value="leader">Leader</option>
                      <option value="follower">Follower</option>
                    </select>
                  </div>
                  <div className="mb-0">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Status for imports</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" value={mbStatus} onChange={e => setMbStatus(e.target.value as Person['status'])}>
                      <option value="student">Student</option>
                      <option value="professional">Professional</option>
                    </select>
                  </div>
                  <button
                    className="px-3 py-1.5 bg-primary-500 text-white rounded border-none cursor-pointer text-xs font-medium transition-colors hover:bg-primary-600 mb-0"
                    disabled={mbSelected.size === 0 || mbImporting}
                    onClick={handleMbImport}
                  >
                    {mbImporting ? 'Importing...' : `Import Selected (${mbSelected.size})`}
                  </button>
                </div>

                <div className="max-h-[350px] overflow-y-auto border border-gray-200 rounded-md">
                  <table className="w-full border-collapse m-0">
                    <thead>
                      <tr>
                        <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm w-10">
                          <input
                            type="checkbox"
                            checked={mbSelected.size === mbClients.length && mbClients.length > 0}
                            onChange={handleMbSelectAll}
                          />
                        </th>
                        <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Name</th>
                        <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Email</th>
                        <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Phone</th>
                        <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Active</th>
                        <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Last Activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mbClients.map(client => (
                        <tr key={client.id} className={client.isActive ? 'opacity-100' : 'opacity-50'}>
                          <td className="px-3 py-2 border-b border-gray-100 text-sm">
                            <input
                              type="checkbox"
                              checked={mbSelected.has(client.id)}
                              onChange={() => handleMbToggle(client.id)}
                            />
                          </td>
                          <td className="px-3 py-2 border-b border-gray-100 text-sm">{client.firstName} {client.lastName}</td>
                          <td className="px-3 py-2 border-b border-gray-100 text-xs">{client.email || '-'}</td>
                          <td className="px-3 py-2 border-b border-gray-100 text-xs">{client.phone || '-'}</td>
                          <td className="px-3 py-2 border-b border-gray-100 text-sm">{client.isActive ? 'Yes' : 'No'}</td>
                          <td className="px-3 py-2 border-b border-gray-100 text-xs">{client.lastActivityDate || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  {mbClients.length} clients loaded. {mbSelected.size} selected.
                </p>
              </>
            )}
          </div>
        )}

            <form onSubmit={handleAddPerson} className="mb-4">
              <div className="grid grid-cols-[1fr_1fr_1.5fr_1fr_1fr_1fr_auto] gap-2 items-end">
                <div className="mb-0">
                  <label className="block text-sm font-medium text-gray-600 mb-1">First Name</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" type="text" value={newPerson.firstName}
                    onChange={e => setNewPerson({ ...newPerson, firstName: e.target.value })} required />
                </div>
                <div className="mb-0">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Last Name</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" type="text" value={newPerson.lastName}
                    onChange={e => setNewPerson({ ...newPerson, lastName: e.target.value })} required />
                </div>
                <div className="mb-0">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" type="email" value={newPerson.email}
                    onChange={e => setNewPerson({ ...newPerson, email: e.target.value })} />
                </div>
                <div className="mb-0">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Role</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" value={newPerson.role}
                    onChange={e => setNewPerson({ ...newPerson, role: e.target.value as Person['role'] })}>
                    <option value="leader">Leader</option>
                    <option value="follower">Follower</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div className="mb-0">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Status</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" value={newPerson.status}
                    onChange={e => setNewPerson({ ...newPerson, status: e.target.value as Person['status'] })}>
                    <option value="student">Student</option>
                    <option value="professional">Professional</option>
                  </select>
                </div>
                <div className="mb-0">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Studio</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" value={newPerson.studioId}
                    onChange={e => setNewPerson({ ...newPerson, studioId: e.target.value })}>
                    <option value="">None</option>
                    {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <button type="submit" className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 mb-0">Add</button>
              </div>
            </form>

            {people.length === 0 ? (
              <p className="text-center p-4 text-gray-500">No people added yet.</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">First Name</th>
                    <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Last Name</th>
                    <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Email</th>
                    <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Role</th>
                    <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Status</th>
                    <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Studio</th>
                    <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map(person => (
                    <tr key={person.id}>
                      <td className="px-3 py-2 border-b border-gray-100 text-sm">{person.firstName}</td>
                      <td className="px-3 py-2 border-b border-gray-100 text-sm">{person.lastName}</td>
                      <td className="px-3 py-2 border-b border-gray-100 text-sm">{person.email || ''}</td>
                      <td className="px-3 py-2 border-b border-gray-100 text-sm">{person.role}</td>
                      <td className="px-3 py-2 border-b border-gray-100 text-sm">{person.status}</td>
                      <td className="px-3 py-2 border-b border-gray-100 text-sm">{studios.find(s => s.id === person.studioId)?.name || ''}</td>
                      <td className="px-3 py-2 border-b border-gray-100 text-sm">
                        <button onClick={() => handleDeletePerson(person.id)}
                          className="px-2 py-1 bg-danger-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-danger-600">
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
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="mt-0 mb-3">Couples</h3>
          <div>
            {coupleError && <div className="text-danger-500 mt-2 mb-2">{coupleError}</div>}

            {people.length === 0 ? (
              <p className="text-gray-500 p-4 text-center">
                Add people first before creating couples.
              </p>
            ) : (
              <form onSubmit={handleAddCouple} className="mb-4">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                  <div className="mb-0">
                    <label className="block text-sm font-medium text-gray-600 mb-1">Leader</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" value={leaderId} onChange={e => setLeaderId(e.target.value)} required>
                      <option value="">Select Leader</option>
                      {leaders.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName} {p.status === 'professional' ? '(Pro)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-0">
                    <label className="block text-sm font-medium text-gray-600 mb-1">Follower</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" value={followerId} onChange={e => setFollowerId(e.target.value)} required>
                      <option value="">Select Follower</option>
                      {followers.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName} {p.status === 'professional' ? '(Pro)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 mb-0">Add Couple</button>
                </div>
              </form>
            )}

            {couples.length === 0 ? (
              <p className="text-center p-4 text-gray-500">No couples created yet.</p>
            ) : (
              <div>
                {couples.map(couple => {
                  const isOpen = registerBib === couple.bib;

                  return (
                    <div key={couple.bib} className="border-b border-gray-200">
                      <div className="flex items-center py-2.5 gap-4">
                        <strong className="min-w-[3rem]">#{couple.bib}</strong>
                        <span className="flex-1">{couple.leaderName} & {couple.followerName}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openRegisterPanel(couple.bib)}
                            className={`px-2 py-1 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors ${isOpen ? 'bg-primary-700 hover:bg-primary-800' : 'bg-primary-500 hover:bg-primary-600'}`}
                          >
                            {isOpen ? 'Close' : 'Register'}
                          </button>
                          <button
                            onClick={() => handleDeleteCouple(couple.bib)}
                            className="px-2 py-1 bg-danger-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-danger-600"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-3">
                          <h4 className="mt-0 mb-3 text-gray-600">
                            Register #{couple.bib} for an event
                          </h4>

                          {regError && <div className="text-danger-500 mt-2 mb-2">{regError}</div>}
                          {regMessage && (
                            <div className="bg-green-200 text-green-800 px-3 py-2 rounded mb-3 text-sm">
                              {regMessage}
                            </div>
                          )}

                          {/* Combination builder */}
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

                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">Level</label>
                              <div className="flex gap-1.5 flex-wrap">
                                {(activeCompetition?.levels?.length ? activeCompetition.levels : DEFAULT_LEVELS).map(opt => (
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
                                {['Standard', 'Latin', 'Smooth', 'Rhythm'].map(opt => (
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

                            <button
                              className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 self-start mt-1"
                              onClick={handleRegister}
                              disabled={regLoading}
                            >
                              {regLoading ? 'Registering...' : 'Register for Event'}
                            </button>
                          </div>

                          {/* Current events for this couple */}
                          <div className="mt-4 border-t border-gray-200 pt-3">
                            <h4 className="mt-0 mb-2 text-gray-600 text-sm">
                              Currently Entered ({coupleEventsLoading ? '...' : coupleEvents.length} events)
                            </h4>
                            {coupleEventsLoading ? (
                              <p className="text-gray-400 text-sm">Loading...</p>
                            ) : coupleEvents.length === 0 ? (
                              <p className="text-gray-400 text-sm">Not entered in any events yet.</p>
                            ) : (
                              <div className="flex flex-col gap-1.5">
                                {coupleEvents.map(ev => (
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
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="mt-0 mb-3">Judges</h3>
          <div>
            <form onSubmit={handleAddJudge} className="mb-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1 mb-0">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Judge Name</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" type="text" value={newJudgeName}
                    onChange={e => setNewJudgeName(e.target.value)} placeholder="Enter judge name" required />
                </div>
                <button type="submit" className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 mb-0">Add Judge</button>
              </div>
            </form>

            {judges.length === 0 ? (
              <p className="text-center p-4 text-gray-500">No judges added yet.</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Judge #</th>
                    <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Name</th>
                    <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {judges.map(judge => (
                    <tr key={judge.id}>
                      <td className="px-3 py-2 border-b border-gray-100 text-sm"><strong>#{judge.judgeNumber}</strong></td>
                      <td className="px-3 py-2 border-b border-gray-100 text-sm">{judge.name}</td>
                      <td className="px-3 py-2 border-b border-gray-100 text-sm">
                        <button onClick={() => handleDeleteJudge(judge.id)}
                          className="px-2 py-1 bg-danger-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-danger-600">
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
