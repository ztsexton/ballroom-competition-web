import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PublicCompetition, PublicEventWithHeats } from '../../types';
import { publicCompetitionsApi } from '../../api/client';

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

        // If heat lists aren't published, don't try to fetch them
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

  if (loading) return <div style={{ textAlign: 'center', color: '#718096', padding: '2rem' }}>Loading...</div>;
  if (!competition) return <div style={{ textAlign: 'center', color: '#e53e3e', padding: '2rem' }}>Competition not found.</div>;

  // Group events by style
  const byStyle = events.reduce<Record<string, PublicEventWithHeats[]>>((acc, evt) => {
    const style = evt.style || 'Other';
    if (!acc[style]) acc[style] = [];
    acc[style].push(evt);
    return acc;
  }, {});

  return (
    <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '3rem' }}>
      <Link to={`/results/${competitionId}`} style={{ color: '#667eea', fontSize: '0.9rem' }}>
        &larr; Back to competition
      </Link>
      <h2 style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>Heat Lists</h2>
      <div style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '1.25rem' }}>
        {competition.name} &middot; {formatDate(competition.date)}
      </div>

      {notPublished ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#718096', marginBottom: '0.5rem' }}>
            Heat lists have not been published yet.
          </p>
          <p style={{ color: '#a0aec0', fontSize: '0.875rem' }}>
            Check back closer to competition day once entries are finalized.
          </p>
        </div>
      ) : events.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#718096' }}>No events scheduled yet. Check back closer to competition day.</p>
        </div>
      ) : (
        Object.entries(byStyle).map(([style, styleEvents]) => (
          <div key={style} style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#2d3748', marginBottom: '0.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.25rem' }}>
              {style}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {styleEvents.map(evt => {
                const expanded = expandedEvents[evt.id];
                return (
                  <div key={evt.id} className="card" style={{ padding: '0' }}>
                    <div
                      onClick={() => toggleEvent(evt.id)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.75rem 1rem',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{evt.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#718096', marginTop: '0.15rem' }}>
                          {[evt.level, evt.dances?.join(', ')].filter(Boolean).join(' \u00b7 ')}
                          {evt.coupleCount > 0 && <> &middot; {evt.coupleCount} couple{evt.coupleCount !== 1 ? 's' : ''}</>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#a0aec0' }}>
                          {evt.rounds.map(r => r.replace('-', ' ')).join(', ')}
                        </span>
                        <span style={{ color: '#a0aec0' }}>{expanded ? '▾' : '▸'}</span>
                      </div>
                    </div>

                    {expanded && (
                      <div style={{ borderTop: '1px solid #e2e8f0', padding: '0.75rem 1rem' }}>
                        {evt.heats.map((heat, heatIdx) => (
                          <div key={heat.round} style={{ marginBottom: heatIdx < evt.heats.length - 1 ? '1rem' : 0 }}>
                            <div style={{
                              fontWeight: 600, fontSize: '0.8rem', color: '#4a5568',
                              textTransform: 'capitalize', marginBottom: '0.5rem',
                            }}>
                              {heat.round.replace('-', ' ')}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.375rem' }}>
                              {heat.couples.map(couple => (
                                <div key={couple.bib} style={{
                                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                                  padding: '0.375rem 0.625rem',
                                  background: '#f7fafc',
                                  borderRadius: '4px',
                                  fontSize: '0.8125rem',
                                }}>
                                  <span style={{ fontWeight: 600, color: '#667eea', minWidth: '2.5rem' }}>#{couple.bib}</span>
                                  <span style={{ color: '#2d3748' }}>
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
