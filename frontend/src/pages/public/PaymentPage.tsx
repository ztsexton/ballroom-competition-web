import { useParams, Link } from 'react-router-dom';

const PaymentPage = () => {
  const { competitionId } = useParams<{ competitionId: string }>();

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      <Link to={`/results/${competitionId}`} style={{ color: '#667eea', fontSize: '0.9rem' }}>
        &larr; Back to competition
      </Link>
      <div className="card" style={{ marginTop: '1rem', textAlign: 'center', padding: '3rem' }}>
        <h2 style={{ marginBottom: '0.75rem' }}>Payment</h2>
        <p style={{ color: '#718096', marginBottom: '1.5rem' }}>
          Online payment is coming soon. Please contact the organizer for payment instructions.
        </p>
        <Link to="/portal" style={{
          padding: '0.5rem 1.5rem', background: '#667eea', color: 'white',
          borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
        }}>
          Go to Participant Portal
        </Link>
      </div>
    </div>
  );
};

export default PaymentPage;
