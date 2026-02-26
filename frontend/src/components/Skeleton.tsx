interface SkeletonProps {
  className?: string;
  variant?: 'bar' | 'text' | 'card' | 'table' | 'circle';
  lines?: number;
  rows?: number;
  cols?: number;
  size?: number;
}

export function Skeleton({ className, variant = 'bar', lines = 3, rows = 5, cols = 4, size = 40 }: SkeletonProps) {
  if (variant === 'circle') {
    return (
      <div
        className={`bg-gray-200 rounded-full animate-pulse ${className || ''}`}
        style={{ width: size, height: size }}
      />
    );
  }

  if (variant === 'text') {
    const widths = ['w-full', 'w-5/6', 'w-4/6', 'w-3/4', 'w-2/3'];
    return (
      <div className={`space-y-3 ${className || ''}`}>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className={`h-4 bg-gray-200 rounded animate-pulse ${widths[i % widths.length]}`} />
        ))}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`bg-white rounded-lg shadow p-6 animate-pulse ${className || ''}`}>
        <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={`animate-pulse ${className || ''}`}>
        <div className="flex gap-4 mb-3">
          {Array.from({ length: cols }, (_, i) => (
            <div key={i} className="h-4 bg-gray-300 rounded flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex gap-4 py-3 border-b border-gray-100">
            {Array.from({ length: cols }, (_, j) => (
              <div key={j} className="h-4 bg-gray-200 rounded flex-1" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Default: single bar
  return <div className={`bg-gray-200 rounded animate-pulse h-4 ${className || ''}`} />;
}
