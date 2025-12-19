import React from 'react';
import { Link } from 'react-router-dom';

const Navigation: React.FC = () => {
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
        alignItems: 'center'
      }}>
        <Link to="/" style={{
          color: 'white',
          fontWeight: 'bold',
          fontSize: '1.25rem',
          textDecoration: 'none'
        }}>
          Ballroom Scorer
        </Link>
        <div style={{ display: 'flex', gap: '1.5rem', flex: 1 }}>
          <Link to="/people" style={{ color: 'white' }}>👥 People</Link>
          <Link to="/couples" style={{ color: 'white' }}>💃🕺 Couples</Link>
          <Link to="/judges" style={{ color: 'white' }}>⚖️ Judges</Link>
          <Link to="/events" style={{ color: 'white' }}>🏆 Events</Link>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
