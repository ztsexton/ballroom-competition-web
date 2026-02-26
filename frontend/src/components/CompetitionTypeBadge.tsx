const TYPE_STYLES: Record<string, string> = {
  NDCA: 'bg-purple-100 text-purple-800',
  USA_DANCE: 'bg-blue-100 text-blue-800',
  WDC: 'bg-emerald-100 text-emerald-700',
  WDSF: 'bg-amber-100 text-amber-700',
  STUDIO: 'bg-yellow-100 text-yellow-800',
  UNAFFILIATED: 'bg-gray-100 text-gray-600',
};

const TYPE_LABELS: Record<string, string> = {
  NDCA: 'NDCA',
  USA_DANCE: 'USA Dance',
  WDC: 'WDC',
  WDSF: 'WDSF',
  STUDIO: 'Studio',
  UNAFFILIATED: 'Unaffiliated',
};

interface CompetitionTypeBadgeProps {
  type: string;
  className?: string;
}

export function CompetitionTypeBadge({ type, className = '' }: CompetitionTypeBadgeProps) {
  const style = TYPE_STYLES[type] || TYPE_STYLES.UNAFFILIATED;
  const label = TYPE_LABELS[type] || type;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${style} ${className}`}>
      {label}
    </span>
  );
}
