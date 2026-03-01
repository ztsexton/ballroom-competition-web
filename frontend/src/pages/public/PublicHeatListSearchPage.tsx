import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PublicCompetition } from '../../types';
import { publicCompetitionsApi } from '../../api/client';
import { Skeleton } from '../../components/Skeleton';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface PublicPerson {
  id: number;
  firstName: string;
  lastName: string;
  partnerships: Array<{ bib: number; partnerName: string }>;
}

const PublicHeatListSearchPage = () => {
  const { competitionId } = useParams<{ competitionId: string }>();
  const compId = Number(competitionId);
  const [competition, setCompetition] = useState<PublicCompetition | null>(null);
  const [people, setPeople] = useState<PublicPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [notPublished, setNotPublished] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const compRes = await publicCompetitionsApi.getById(compId);
        setCompetition(compRes.data);

        if (!compRes.data.heatListsPublished) {
          setNotPublished(true);
          setLoading(false);
          return;
        }

        const peopleRes = await publicCompetitionsApi.getPeople(compId);
        setPeople(peopleRes.data);
      } catch {
        // Competition not found or error
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [compId]);

  const filtered = useMemo(() => {
    const sorted = [...people].sort((a, b) =>
      a.lastName.toLowerCase().localeCompare(b.lastName.toLowerCase())
    );
    if (!search.trim()) return sorted;
    const q = search.trim().toLowerCase();
    return sorted.filter(p =>
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
    );
  }, [people, search]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-8 pt-6 pb-12">
        <Skeleton className="h-4 w-40 mb-3" />
        <Skeleton className="h-7 w-48 mb-1" />
        <Skeleton className="h-4 w-64 mb-5" />
        <Skeleton className="h-10 w-full max-w-[400px] mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      </div>
    );
  }

  if (!competition) return <div className="text-center text-danger-500 p-8">Competition not found.</div>;

  return (
    <div className="max-w-7xl mx-auto px-8 pt-6 pb-12">
      <Link to={`/results/${competitionId}`} className="text-primary-500 text-sm hover:underline">
        &larr; Back to competition
      </Link>
      <h2 className="text-xl font-bold text-gray-800 mt-2 mb-1">Heatlists</h2>
      <div className="text-sm text-gray-500 mb-5">
        {competition.name} &middot; {formatDate(competition.date)}
      </div>

      {notPublished ? (
        <div className="bg-white rounded-lg shadow text-center py-8 px-6">
          <p className="text-gray-500 mb-2">Heat lists have not been published yet.</p>
          <p className="text-gray-400 text-sm">
            Check back closer to competition day once entries are finalized.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="w-full max-w-[400px] px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-gray-400">
              {search.trim() ? 'No competitors match that search.' : 'No competitors in this competition.'}
            </p>
          ) : (
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              {filtered.map((person, idx) => (
                <Link
                  key={person.id}
                  to={`/results/${competitionId}/heatlists/${person.id}`}
                  className={`flex items-center justify-between px-4 py-3 no-underline text-inherit transition-colors hover:bg-yellow-50 cursor-pointer ${
                    idx < filtered.length - 1 ? 'border-b border-gray-200' : ''
                  }`}
                >
                  <div>
                    <span className="font-medium text-gray-800">
                      {person.firstName} {person.lastName}
                    </span>
                    {person.partnerships.length > 0 && (
                      <span className="text-xs text-gray-400 ml-2">
                        {person.partnerships.length} partner{person.partnerships.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <span className="text-gray-400 text-sm">&rsaquo;</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PublicHeatListSearchPage;
