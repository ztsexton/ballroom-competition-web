import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { PersonHeatListResponse, Competition, Person } from '../../types';
import { participantApi, competitionsApi } from '../../api/client';
import { Skeleton } from '../../components/Skeleton';
import { PersonHeatSheet } from '../../components/PersonHeatSheet';
import { useAuth } from '../../context/AuthContext';

const PersonHeatListPage = () => {
  const { id: competitionId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const personIdParam = searchParams.get('personId');
  const { isAnyAdmin } = useAuth();

  const [data, setData] = useState<PersonHeatListResponse | null>(null);
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(
    personIdParam ? Number(personIdParam) : null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load competition and people list (for admin picker)
  useEffect(() => {
    if (!competitionId) return;
    competitionsApi.getById(Number(competitionId))
      .then(r => setCompetition(r.data))
      .catch(() => {});
  }, [competitionId]);

  // If no personId specified, find the logged-in user's person
  useEffect(() => {
    if (!competitionId) return;
    if (selectedPersonId) return;

    participantApi.getProfile()
      .then(r => {
        const myPerson = r.data.find(p => p.competitionId === Number(competitionId));
        if (myPerson) {
          setSelectedPersonId(myPerson.id);
        } else {
          setError('You are not registered in this competition.');
          setLoading(false);
        }
      })
      .catch(() => {
        setError('Failed to load profile.');
        setLoading(false);
      });
  }, [competitionId, selectedPersonId]);

  // Load people list for admin person picker
  useEffect(() => {
    if (!competitionId || !isAnyAdmin) return;
    import('../../api/client').then(({ peopleApi }) => {
      peopleApi.getAll(Number(competitionId))
        .then(r => setPeople(r.data))
        .catch(() => {});
    });
  }, [competitionId, isAnyAdmin]);

  // Fetch heat list for selected person
  useEffect(() => {
    if (!competitionId || !selectedPersonId) return;
    setLoading(true);
    setError(null);
    participantApi.getPersonHeatlists(Number(competitionId), selectedPersonId)
      .then(r => setData(r.data))
      .catch(err => {
        setError(err.response?.data?.error || 'Failed to load heat list');
      })
      .finally(() => setLoading(false));
  }, [competitionId, selectedPersonId]);

  return (
    <div className="max-w-4xl mx-auto px-8 pt-6 pb-12">
      {/* Navigation — hidden when printing */}
      <div className="print:hidden">
        <Link
          to={`/competitions/${competitionId}`}
          className="text-primary-500 text-sm hover:underline"
        >
          &larr; Back to Competition
        </Link>

        {/* Admin person picker */}
        {isAnyAdmin && people.length > 0 && (
          <div className="mt-3 mb-4">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              View heat sheet for:
            </label>
            <select
              value={selectedPersonId || ''}
              onChange={e => setSelectedPersonId(Number(e.target.value))}
              className="w-full max-w-md border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="">Select a person...</option>
              {people
                .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.lastName}, {p.firstName} ({p.role})
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Print button */}
        {data && (
          <div className="flex justify-end mt-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300"
            >
              Print Heat Sheet
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="mt-4">
          <Skeleton className="h-8 w-64 mx-auto mb-6" />
          <div className="space-y-6">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i}>
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton variant="table" rows={4} cols={3} />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="text-center text-danger-500 mt-8">{error}</div>
      ) : data ? (
        <PersonHeatSheet data={data} competitionName={competition?.name} />
      ) : null}
    </div>
  );
};

export default PersonHeatListPage;
