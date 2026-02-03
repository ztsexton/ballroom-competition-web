import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PublicCompetition, PublicEvent } from '../types';
import { publicCompetitionsApi } from '../api/client';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const PublicHeatListsPage = () => {
  const { competitionId } = useParams<{ competitionId: string }>();
  const compId = Number(competitionId);
  const [competition, setCompetition] = useState<PublicCompetition | null>(null);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      publicCompetitionsApi.getById(compId),
      publicCompetitionsApi.getEvents(compId),
    ])
      .then(([c, e]) => {
        setCompetition(c.data);
        setEvents(e.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [compId]);

  if (loading) return <div style={{ textAlign: 'center', color: '#718096', padding: '2rem' }}>Loading...</div>;
  if (!competition) return <div style={{ textAlign: 'center', color: '#e53e3e', padding: '2rem' }}>Competition not found.</div>;

  // Group events by style
  const byStyle = events.reduce<Record<string, PublicEvent[]>>((acc, evt) => {
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

      {events.length === 0 ? (
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
              {styleEvents.map(evt => (
                <div key={evt.id} className="card" style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{evt.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#718096', marginTop: '0.15rem' }}>
                        {[evt.level, evt.dances?.join(', ')].filter(Boolean).join(' \u00b7 ')}
                        {evt.coupleCount > 0 && <> &middot; {evt.coupleCount} couple{evt.coupleCount !== 1 ? 's' : ''}</>}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#a0aec0' }}>
                      {evt.rounds.map(r => r.replace('-', ' ')).join(', ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default PublicHeatListsPage;
