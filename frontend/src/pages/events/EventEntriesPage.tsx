import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsApi, couplesApi } from '../../api/client';
import { Event, Couple } from '../../types';

const EventEntriesPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const eventId = parseInt(id || '0');

  const [event, setEvent] = useState<Event | null>(null);
  const [entries, setEntries] = useState<Couple[]>([]);
  const [allCouples, setAllCouples] = useState<Couple[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBib, setSelectedBib] = useState('');

  useEffect(() => {
    if (eventId) loadData();
  }, [eventId]);

  const loadData = async () => {
    try {
      const [eventRes, entriesRes] = await Promise.all([
        eventsApi.getById(eventId),
        eventsApi.getEntries(eventId),
      ]);
      setEvent(eventRes.data);
      setEntries(entriesRes.data);

      const couplesRes = await couplesApi.getAll(eventRes.data.competitionId);
      setAllCouples(couplesRes.data);
      setError('');
    } catch {
      setError('Failed to load event data.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedBib) return;
    try {
      await eventsApi.addEntry(eventId, parseInt(selectedBib));
      setSelectedBib('');
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add couple');
    }
  };

  const handleRemove = async (bib: number) => {
    try {
      await eventsApi.removeEntry(eventId, bib);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove couple');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  if (!event) {
    return (
      <div className="container">
        <div className="card">
          <h2>Event Not Found</h2>
          <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ marginTop: '1rem' }}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const entryBibs = new Set(entries.map(c => c.bib));
  const availableCouples = allCouples.filter(c => !entryBibs.has(c.bib));

  const details = [event.designation, event.syllabusType, event.level, event.style, event.dances?.join(', ')].filter(Boolean).join(' \u2022 ');

  return (
    <div className="container" style={{ maxWidth: '800px' }}>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem' }}>Event #{event.id}: {event.name}</h2>
            {details && <p style={{ color: '#718096', margin: '0 0 0.25rem', fontSize: '0.9rem' }}>{details}</p>}
            <p style={{ color: '#4a5568', margin: 0, fontSize: '0.875rem' }}>
              {entries.length} couple{entries.length !== 1 ? 's' : ''} entered
              {' \u2022 '}{event.heats.length} round{event.heats.length !== 1 ? 's' : ''}
              {' \u2022 '}{event.scoringType === 'proficiency' ? 'Proficiency' : 'Standard'} scoring
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>
            Back
          </button>
        </div>
      </div>

      {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 0.75rem' }}>Add Couple</h3>
        {availableCouples.length === 0 ? (
          <p style={{ color: '#718096', margin: 0 }}>All couples are already entered in this event.</p>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <select value={selectedBib} onChange={e => setSelectedBib(e.target.value)}>
                <option value="">Select a couple...</option>
                {availableCouples.map(c => (
                  <option key={c.bib} value={c.bib}>
                    #{c.bib} - {c.leaderName} & {c.followerName}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn" onClick={handleAdd} disabled={!selectedBib} style={{ marginBottom: 0 }}>
              Add
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 0.75rem' }}>Entered Couples ({entries.length})</h3>
        {entries.length === 0 ? (
          <p style={{ color: '#718096', textAlign: 'center', padding: '1rem' }}>No couples entered yet.</p>
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
              {entries.map(couple => (
                <tr key={couple.bib}>
                  <td><strong>#{couple.bib}</strong></td>
                  <td>{couple.leaderName}</td>
                  <td>{couple.followerName}</td>
                  <td>
                    <button
                      onClick={() => handleRemove(couple.bib)}
                      className="btn btn-danger"
                      style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default EventEntriesPage;
