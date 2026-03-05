import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PersonHeatListResponse } from '../../types';
import { publicCompetitionsApi } from '../../api/client';
import { Skeleton } from '../../components/Skeleton';
import { PersonHeatSheet } from '../../components/PersonHeatSheet';

const PublicPersonHeatListPage = () => {
  const { competitionId, personId } = useParams<{ competitionId: string; personId: string }>();
  const [data, setData] = useState<PersonHeatListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!competitionId || !personId) return;
    setLoading(true);
    publicCompetitionsApi.getPersonHeatlists(Number(competitionId), Number(personId))
      .then((r) => setData(r.data))
      .catch((err) => {
        setError(err.response?.data?.error || 'Failed to load heatlist');
      })
      .finally(() => setLoading(false));
  }, [competitionId, personId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-8 pt-6 pb-12">
        <Skeleton className="h-4 w-40 mb-3" />
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="space-y-6">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i}>
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton variant="table" rows={4} cols={3} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-8 pt-6 pb-12">
        <Link to={`/results/${competitionId}/heatlists`} className="text-primary-500 text-sm hover:underline">
          &larr; Back to Competitor List
        </Link>
        <div className="text-center text-danger-500 mt-8">{error || 'Person not found.'}</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-8 pt-6 pb-12">
      <div className="print:hidden">
        <Link to={`/results/${competitionId}/heatlists`} className="text-primary-500 text-sm hover:underline">
          &larr; Back to Competitor List
        </Link>
      </div>

      <div className="flex justify-end mt-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300"
        >
          Print Heat Sheet
        </button>
      </div>

      <PersonHeatSheet data={data} />
    </div>
  );
};

export default PublicPersonHeatListPage;
