import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PersonHeatListResponse, PersonHeatEntry } from '../../types';
import { publicCompetitionsApi } from '../../api/client';
import { Skeleton } from '../../components/Skeleton';

function formatTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

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
      <Link to={`/results/${competitionId}/heatlists`} className="text-primary-500 text-sm hover:underline">
        &larr; Back to Competitor List
      </Link>

      <h2 className="text-xl font-bold text-gray-800 mt-3 mb-1 text-center">
        <span className="block text-sm font-normal text-gray-500 mb-1">Heatlists for</span>
        {data.firstName} {data.lastName}
      </h2>

      {data.partnerships.length === 0 ? (
        <p className="text-gray-400 text-center mt-6">No heats found for this person.</p>
      ) : (
        <div className="mt-6">
          {data.partnerships.map((partnership) => {
            // Group heats by style
            const styleGroups: { style: string; heats: PersonHeatEntry[] }[] = [];
            for (const heat of partnership.heats) {
              const style = heat.style || 'Other';
              const group = styleGroups.find(g => g.style === style);
              if (group) {
                group.heats.push(heat);
              } else {
                styleGroups.push({ style, heats: [heat] });
              }
            }

            return (
              <div key={partnership.bib} className="mb-8">
                <h3 className="text-base font-semibold text-primary-500 mb-2 ml-1">
                  With {partnership.partnerName}
                </h3>
                {styleGroups.map((group) => (
                  <div key={group.style} className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-600 mb-1 ml-1">{group.style}</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse bg-white border border-gray-300">
                        <thead>
                          <tr>
                            <th className="text-left px-3 py-2 text-sm font-semibold text-white bg-gray-500 border border-gray-500">
                              Time
                            </th>
                            <th className="text-left px-3 py-2 text-sm font-semibold text-white bg-gray-500 border border-gray-500">
                              Heat
                            </th>
                            <th className="text-left px-3 py-2 text-sm font-semibold text-white bg-gray-500 border border-gray-500">
                              Event
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.heats.map((heat, idx) => (
                            <tr
                              key={`${heat.heatNumber}-${heat.eventName}-${idx}`}
                              className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
                            >
                              <td className="px-3 py-2 text-sm border border-gray-300 whitespace-nowrap">
                                {formatTime(heat.estimatedTime)}
                              </td>
                              <td className="px-3 py-2 text-sm border border-gray-300 whitespace-nowrap">
                                {heat.heatNumber}
                              </td>
                              <td className="px-3 py-2 text-sm border border-gray-300">
                                {heat.eventName}
                                {heat.dance && (
                                  <span className="text-gray-400 ml-1">({heat.dance})</span>
                                )}
                                {heat.round !== 'final' && (
                                  <span className="text-xs text-gray-400 ml-1 capitalize">
                                    [{heat.round.replace('-', ' ')}]
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PublicPersonHeatListPage;
