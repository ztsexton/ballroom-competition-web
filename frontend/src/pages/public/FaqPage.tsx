import { Link } from 'react-router-dom';

const FaqPage = () => (
  <div className="max-w-7xl mx-auto p-8">
    <div className="bg-white rounded-lg shadow text-center py-12 px-6">
      <h2 className="text-2xl font-bold text-gray-800">Frequently Asked Questions</h2>
      <p className="text-gray-500 mt-4 text-lg">
        FAQ content coming soon.
      </p>
      <Link to="/" className="inline-block mt-6 text-primary-500 no-underline hover:underline">
        &larr; Back to home
      </Link>
    </div>
  </div>
);

export default FaqPage;
