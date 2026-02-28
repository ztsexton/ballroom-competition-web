import { useState, useCallback } from 'react';

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  savedKey: string;
  savedMap: Record<string, boolean>;
  children: React.ReactNode;
  onOpen?: () => void;
}

const Section = ({
  title,
  defaultOpen = true,
  savedKey,
  savedMap,
  children,
  onOpen,
}: SectionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const saved = savedMap[savedKey];

  const handleToggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    if (next && onOpen) onOpen();
  }, [open, onOpen]);

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-3">
      <div
        className="flex justify-between items-center cursor-pointer select-none"
        onClick={handleToggle}
      >
        <h3 className="m-0">
          <span className="mr-2 text-gray-400">{open ? '▾' : '▸'}</span>
          {title}
        </h3>
        {saved && (
          <span className="text-[0.8125rem] text-success-500 font-semibold transition-opacity">
            Saved
          </span>
        )}
      </div>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
};

export default Section;
