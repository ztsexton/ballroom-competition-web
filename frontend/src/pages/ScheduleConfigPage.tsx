import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

const ScheduleConfigPage = () => {
  const { id } = useParams<{ id: string }>();
  const competitionId = parseInt(id || '0');
  const [days] = useState([{ label: 'Day 1', sessions: ['Morning Session', 'Afternoon Session'] }]);

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Schedule Configuration</h2>
        </div>
        <p style={{ color: '#718096', marginBottom: '1.5rem' }}>
          Configure which events run on which days and sessions. Once configured, generate heat lists from the Heat Lists tab.
        </p>

        <div style={{
          textAlign: 'center',
          padding: '3rem',
          background: '#f7fafc',
          border: '2px dashed #cbd5e0',
          borderRadius: '8px',
        }}>
          <p style={{ color: '#718096', fontSize: '1rem', marginBottom: '1rem' }}>
            Schedule configuration is coming soon.
          </p>
          <p style={{ color: '#a0aec0', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            For now, generate heat lists directly from the Heat Lists tab, which will automatically order events by style and level.
          </p>
          <Link
            to={`/competitions/${competitionId}/heat-lists`}
            className="btn"
          >
            Go to Heat Lists
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ScheduleConfigPage;
