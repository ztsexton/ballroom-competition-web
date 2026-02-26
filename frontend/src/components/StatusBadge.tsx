const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  scoring: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  active: 'bg-blue-100 text-blue-800',
  draft: 'bg-gray-100 text-gray-600',
  live: 'bg-red-100 text-red-700',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${style} ${className}`}>
      {status}
    </span>
  );
}
