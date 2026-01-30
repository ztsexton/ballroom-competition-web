import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { eventsApi } from '../api/client';
import { Event } from '../types';
import { useCompetition } from '../context/CompetitionContext';
import { useAuth } from '../context/AuthContext';

const EventsPage = () => {
  const { activeCompetition, competitions, setActiveCompetition } = useCompetition();
  const { isAdmin, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const competitionId = params.get('competitionId');
    if (competitionId && competitions.length > 0) {
      const comp = competitions.find(c => c.id === Number(competitionId));
      if (comp && (!activeCompetition || activeCompetition.id !== comp.id)) {
        setActiveCompetition(comp);
      }
    }
    // Only load events if activeCompetition is set
    if (activeCompetition) {
      loadEvents();
    } else {
      setEvents([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompetition, competitions, location.search]);

  const loadEvents = async () => {
    if (!activeCompetition) return;
    
    try {
      const response = await eventsApi.getAll(activeCompetition.id);
      setEvents(Object.values(response.data));
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this event? This will also delete all associated scores.')) {
      return;
    }
    
    try {
      await eventsApi.delete(id);
      loadEvents();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete event');
    }
  };

  if (loading || authLoading) return <div className="loading">Loading...</div>;

  if (!isAdmin) {
    return (
      <div className="container">
        <div className="card">
          <h2>Access Denied</h2>
          <p>You must be an admin to manage events.</p>
        </div>
      </div>
    );
  }

  if (!activeCompetition) {
    return (
      <div className="container">
        <div className="card">
          <h2>📋 Manage Events</h2>
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem', 
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '8px'
          }}>
            <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>⚠️ No Active Competition</p>
            <p style={{ color: '#78350f' }}>Please select a competition from the dropdown above to manage events.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>📋 Manage Events - {activeCompetition.name}</h2>
          <Link to="/events/new" className="btn">➕ Create New Event</Link>
        </div>

        {events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
            <h3>No events created yet</h3>
            <p>Create your first event to get started!</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Event #</th>
                <th>Name</th>
                <th>Details</th>
                <th>Rounds</th>
                <th>Competitors</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map(event => {
                const allBibs = new Set<number>();
                event.heats.forEach(heat => {
                  heat.bibs.forEach(bib => allBibs.add(bib));
                });
                
                return (
                  <tr key={event.id}>
                    <td><strong>#{event.id}</strong></td>
                    <td>{event.name}</td>
                    <td style={{ fontSize: '0.875rem', color: '#718096' }}>
                      {[
                        event.designation,
                        event.syllabusType,
                        event.level,
                        event.style,
                        event.dances?.join(', ')
                      ].filter(Boolean).join(' • ') || '—'}
                    </td>
                    <td>{event.heats.length} round{event.heats.length !== 1 ? 's' : ''}</td>
                    <td>{allBibs.size} couple{allBibs.size !== 1 ? 's' : ''}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Link 
                          to={`/events/${event.id}`} 
                          className="btn" 
                          style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                        >
                          View
                        </Link>
                        <Link 
                          to={`/events/${event.id}/score`} 
                          className="btn btn-success" 
                          style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                        >
                          Score
                        </Link>
                        <Link 
                          to={`/events/${event.id}/results`} 
                          className="btn btn-secondary" 
                          style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                        >
                          Results
                        </Link>
                        <button 
                          onClick={() => handleDelete(event.id)} 
                          className="btn btn-danger" 
                          style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {events.length > 0 && (
        <div className="card">
          <h3>Quick Stats</h3>
          <p>Total Events: <strong>{events.length}</strong></p>
        </div>
      )}
    </div>
  );
};

export default EventsPage;
