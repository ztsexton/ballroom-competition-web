import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PublicCompetition, PublicEventWithHeats } from '../../types';
import { publicCompetitionsApi } from '../../api/client';
import { Skeleton } from '../../components/Skeleton';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const PublicHeatListsPage = () => {
  const { competitionId } = useParams<{ competitionId: string }>();
  const compId = Number(competitionId);
  const [competition, setCompetition] = useState<PublicCompetition | null>(null);
  const [events, setEvents] = useState<PublicEventWithHeats[]>([]);
  const [loading, setLoading] = useState(true);
  const [notPublished, setNotPublished] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Record<number, boolean>>({});

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

        const heatsRes = await publicCompetitionsApi.getHeats(compId);
        setEvents(heatsRes.data);
      } catch (err: any) {
        if (err?.response?.status === 403) {
          setNotPublished(true);
        }
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [compId]);

  const toggleEvent = (eventId: number) => {
    setExpandedEvents(prev => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-8 pt-6 pb-12">
        <Skeleton className="h-4 w-40 mb-3" />
        <Skeleton className="h-7 w-48 mb-1" />
        <Skeleton className="h-4 w-64 mb-5" />
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} variant="card" />)}
        </div>
      </div>
    );
  }

  if (!competition) return <div className="text-center text-danger-500 p-8">Competition not found.</div>;

  const byStyle = events.reduce<Record<string, PublicEventWithHeats[]>>((acc, evt) => {
    const style = evt.style || 'Other';
    if (!acc[style]) acc[style] = [];
    acc[style].push(evt);
    return acc;
  }, {});

  return (
    <div className="max-w-7xl mx-auto px-8 pt-6 pb-12">
      <Link to={`/results/${competitionId}`} className="text-primary-500 text-sm hover:underline">
        &larr; Back to competition
      </Link>
      <h2 className="text-xl font-bold text-gray-800 mt-2 mb-1">Heat Lists</h2>
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
      ) : events.length === 0 ? (
        <div className="bg-white rounded-lg shadow text-center py-8 px-6">
          <p className="text-gray-500">No events scheduled yet. Check back closer to competition day.</p>
        </div>
      ) : (
        Object.entries(byStyle).map(([style, styleEvents]) => (
          <div key={style} className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2 border-b-2 border-gray-200 pb-1">
              {style}
            </h3>
            <div className="flex flex-col gap-2">
              {styleEvents.map(evt => {
                const expanded = expandedEvents[evt.id];
                return (
                  <div key={evt.id} className="bg-white rounded-lg shadow overflow-hidden">
                    <div
                      onClick={() => toggleEvent(evt.id)}
                      className="flex justify-between items-center px-4 py-3 cursor-pointer select-none hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-gray-800">{evt.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {[evt.level, evt.dances?.join(', ')].filter(Boolean).join(' \u00b7 ')}
                          {evt.coupleCount > 0 && <> &middot; {evt.coupleCount} couple{evt.coupleCount !== 1 ? 's' : ''}</>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {evt.rounds.map(r => r.replace('-', ' ')).join(', ')}
                        </span>
                        <span className="text-gray-400">{expanded ? '\u25BE' : '\u25B8'}</span>
                      </div>
                    </div>

                    {expanded && (
                      <div className="border-t border-gray-200 px-4 py-3">
                        {evt.heats.map((heat, heatIdx) => (
                          <div key={heat.round} className={heatIdx < evt.heats.length - 1 ? 'mb-4' : ''}>
                            <div className="font-semibold text-xs text-gray-600 capitalize mb-2">
                              {heat.round.replace('-', ' ')}
                            </div>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-1.5">
                              {heat.couples.map(couple => (
                                <div key={couple.bib} className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded text-[0.8125rem]">
                                  <span className="font-semibold text-primary-500 min-w-[2.5rem]">#{couple.bib}</span>
                                  <span className="text-gray-800">
                                    {couple.leaderName} &amp; {couple.followerName}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default PublicHeatListsPage;
