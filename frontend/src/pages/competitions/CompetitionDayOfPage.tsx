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
  {
    label: 'Scrutineer',
    description: 'Enter marks and rankings from paper judging sheets. View and compile results.',
    path: 'scrutineer',
  },
];

const CompetitionDayOfPage = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow p-6 mb-4">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Competition Day Views</h2>
        <p className="text-gray-500 text-[0.9375rem]">
          Open these on separate screens or devices during the competition.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {dayOfViews.map(view => (
          <Link
            key={view.path}
            to={`/competitions/${id}/${view.path}`}
            className="flex items-center gap-4 p-5 bg-white rounded-lg shadow no-underline text-inherit transition-shadow hover:shadow-md"
          >
            <div className="flex-1">
              <div className="font-semibold text-lg text-gray-800 mb-1">
                {view.label}
              </div>
              <div className="text-gray-500 text-sm">
                {view.description}
              </div>
            </div>
            <span className="text-primary-500 text-2xl font-bold shrink-0">
              &rsaquo;
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default CompetitionDayOfPage;
