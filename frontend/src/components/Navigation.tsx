import { Link } from 'react-router-dom';
import { useCompetition } from '../context/CompetitionContext';

const Navigation = () => {
  const { activeCompetition, competitions, setActiveCompetition } = useCompetition();

  return (
    <nav style={{
      background: '#667eea',
      padding: '1rem',
      marginBottom: '2rem',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        gap: '2rem',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <Link to="/" style={{
          color: 'white',
          fontWeight: 'bold',
          fontSize: '1.25rem',
          textDecoration: 'none'
        }}>
          Ballroom Scorer
        </Link>
        <div style={{ display: 'flex', gap: '1.5rem', flex: 1, flexWrap: 'wrap' }}>
          <Link to="/competitions" style={{ color: 'white' }}>🏆 Competitions</Link>
          <Link to="/people" style={{ color: 'white' }}>👥 People</Link>
          <Link to="/couples" style={{ color: 'white' }}>💃🕺 Couples</Link>
          <Link to="/judges" style={{ color: 'white' }}>⚖️ Judges</Link>
          <Link to="/events" style={{ color: 'white' }}>📋 Events</Link>
          <Link to="/studio" style={{ color: 'white' }}>🏢 Studio</Link>
        </div>
        {competitions.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ color: 'white', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
              Active:
            </label>
            <select
              value={activeCompetition?.id || ''}
              onChange={(e) => {
                const comp = competitions.find(c => c.id === parseInt(e.target.value));
                setActiveCompetition(comp || null);
              }}
              style={{
                padding: '0.5rem',
                borderRadius: '4px',
                border: 'none',
                background: 'white',
                color: '#2d3748',
                fontWeight: '500',
                cursor: 'pointer',
                minWidth: '200px'
              }}
            >
              <option value="">Select Competition...</option>
              {competitions
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map(comp => (
                  <option key={comp.id} value={comp.id}>
                    {comp.name}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
