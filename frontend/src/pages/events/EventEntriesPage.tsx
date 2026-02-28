import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { eventsApi, couplesApi } from '../../api/client';
import { Event, Couple } from '../../types';
import { Skeleton } from '../../components/Skeleton';

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
    } catch (err: unknown) {
      setError(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to add couple' : 'Failed to add couple');
    }
  };

  const handleRemove = async (bib: number) => {
    try {
      await eventsApi.removeEntry(eventId, bib);
      loadData();
    } catch (err: unknown) {
      setError(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to remove couple' : 'Failed to remove couple');
    }
  };

  if (loading) {
    return (
      <div className="max-w-[800px] mx-auto p-8">
        <Skeleton variant="card" className="mb-4" />
        <Skeleton variant="card" className="mb-4" />
        <Skeleton variant="table" rows={5} cols={4} />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Event Not Found</h2>
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200 mt-4" onClick={() => navigate(-1)}>
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
    <div className="max-w-[800px] mx-auto p-8">
      <div className="bg-white rounded-lg shadow p-6 mb-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">Event #{event.id}: {event.name}</h2>
            {details && <p className="text-gray-500 text-[0.9rem] mb-1">{details}</p>}
            <p className="text-gray-600 text-sm">
              {entries.length} couple{entries.length !== 1 ? 's' : ''} entered
              {' \u2022 '}{event.heats.length} round{event.heats.length !== 1 ? 's' : ''}
              {' \u2022 '}{event.scoringType === 'proficiency' ? 'Proficiency' : 'Standard'} scoring
            </p>
          </div>
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200" onClick={() => navigate(-1)}>
            Back
          </button>
        </div>
      </div>

      {error && <div className="px-4 py-3 bg-red-100 text-red-700 rounded mb-4 text-sm">{error}</div>}

      <div className="bg-white rounded-lg shadow p-6 mb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Add Couple</h3>
        {availableCouples.length === 0 ? (
          <p className="text-gray-500">All couples are already entered in this event.</p>
        ) : (
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <select value={selectedBib} onChange={e => setSelectedBib(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                <option value="">Select a couple...</option>
                {availableCouples.map(c => (
                  <option key={c.bib} value={c.bib}>
                    #{c.bib} - {c.leaderName} & {c.followerName}
                  </option>
                ))}
              </select>
            </div>
            <button className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600" onClick={handleAdd} disabled={!selectedBib}>
              Add
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Entered Couples ({entries.length})</h3>
        {entries.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No couples entered yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Bib #</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Leader</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Follower</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(couple => (
                <tr key={couple.bib}>
                  <td className="px-3 py-2 border-t border-gray-100"><strong>#{couple.bib}</strong></td>
                  <td className="px-3 py-2 border-t border-gray-100">{couple.leaderName}</td>
                  <td className="px-3 py-2 border-t border-gray-100">{couple.followerName}</td>
                  <td className="px-3 py-2 border-t border-gray-100">
                    <button
                      onClick={() => handleRemove(couple.bib)}
                      className="px-2 py-1 bg-danger-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-danger-600"
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
