import { useParams, Link } from 'react-router-dom';

const PaymentPage = () => {
  const { competitionId } = useParams<{ competitionId: string }>();

  return (
    <div className="max-w-7xl mx-auto px-8 pt-8 pb-12">
      <Link to={`/results/${competitionId}`} className="text-primary-500 text-sm hover:underline">
        &larr; Back to competition
      </Link>
      <div className="bg-white rounded-lg shadow mt-4 text-center py-12 px-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-3">Payment</h2>
        <p className="text-gray-500 mb-6">
          Online payment is coming soon. Please contact the organizer for payment instructions.
        </p>
        <Link to="/portal" className="inline-block px-6 py-2 bg-primary-500 text-white rounded-md no-underline text-sm font-semibold hover:bg-primary-600 transition-colors">
          Go to Participant Portal
        </Link>
      </div>
    </div>
  );
};

export default PaymentPage;
