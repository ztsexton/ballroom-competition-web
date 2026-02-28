import { useEffect, useState } from 'react';
import { peopleApi, couplesApi, judgesApi, studiosApi } from '../../api/client';
import { Person, Couple, Judge, Studio } from '../../types';
import { useCompetition } from '../../context/CompetitionContext';
import { Skeleton } from '../../components/Skeleton';
import { PeopleTab, CouplesTab, JudgesTab } from './components/entries';

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

      {activeTab === 'people' && (
        <PeopleTab
          people={people}
          studios={studios}
          competitionId={competitionId}
          onDataChange={loadAllData}
        />
      )}

      {activeTab === 'couples' && (
        <CouplesTab
          couples={couples}
          people={people}
          competitionId={competitionId}
          activeCompetition={activeCompetition}
          onDataChange={loadAllData}
        />
      )}

      {activeTab === 'judges' && (
        <JudgesTab
          judges={judges}
          competitionId={competitionId}
          onDataChange={loadAllData}
        />
      )}
    </div>
  );
};

export default CompetitionEntriesPage;
