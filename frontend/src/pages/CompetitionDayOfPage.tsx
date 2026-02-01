import { Link, useParams } from 'react-router-dom';

const dayOfViews = [
  {
    label: 'On-Deck Captain',
    description: 'See who is on the floor now, who is next, and upcoming heats with couple details.',
    path: 'ondeck',
  },
  {
    label: 'Live Audience View',
    description: 'Public-facing view showing current heat, progress, and what is coming up.',
    path: 'live',
  },
  {
    label: 'Judge Scoring',
    description: 'Individual judge scoring interface for phones and tablets.',
    path: 'judge',
  },
];

const CompetitionDayOfPage = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="container">
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginBottom: '0.25rem' }}>Competition Day Views</h2>
        <p style={{ color: '#718096', fontSize: '0.9375rem' }}>
          Open these on separate screens or devices during the competition.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {dayOfViews.map(view => (
          <Link
            key={view.path}
            to={`/competitions/${id}/${view.path}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1.25rem',
              background: 'white',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'box-shadow 0.15s',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '1.125rem', marginBottom: '0.25rem' }}>
                {view.label}
              </div>
              <div style={{ color: '#718096', fontSize: '0.875rem' }}>
                {view.description}
              </div>
            </div>
            <span style={{ color: '#667eea', fontSize: '1.5rem', fontWeight: 700, flexShrink: 0 }}>
              &rsaquo;
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default CompetitionDayOfPage;
