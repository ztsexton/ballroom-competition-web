import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { eventsApi } from '../api/client';
import { Event } from '../types';

const Home: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const response = await eventsApi.getAll();
      setEvents(Object.values(response.data));
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container">
      <div className="card">
        <h2>Welcome to Ballroom Scorer</h2>
        <p>Manage your ballroom dance competition events, scores, and results all in one place.</p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Competition Events</h2>
          <Link to="/events/new" className="btn">+ Create Event</Link>
        </div>

        {events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
            <h3>No events created yet</h3>
            <p>Get started by creating your first event!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {events.map(event => (
              <div key={event.id} style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '1rem'
              }}>
                <h3>
                  <span style={{
                    background: '#667eea',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.85em',
                    marginRight: '8px'
                  }}>
                    Event #{event.id}
                  </span>
                  {event.name}
                </h3>
                <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                  <Link to={`/events/${event.id}`} className="btn">View</Link>
                  <Link to={`/events/${event.id}/score`} className="btn btn-success">Score</Link>
                  <Link to={`/events/${event.id}/results`} className="btn btn-secondary">Results</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Quick Stats</h2>
        <table>
          <tbody>
            <tr>
              <th>Total Events</th>
              <td>{events.length}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Home;
