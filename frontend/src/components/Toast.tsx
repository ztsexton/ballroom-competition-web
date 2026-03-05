import { useEffect, useState } from 'react';

export interface ToastData {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

const typeStyles = {
  success: 'bg-green-600',
  error: 'bg-danger-500',
  info: 'bg-primary-500',
};

const icons = {
  success: '\u2713',
  error: '\u2717',
  info: '\u2139',
};

export function Toast({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: number) => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setExiting(true), 3600);
    const removeTimer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => { clearTimeout(timer); clearTimeout(removeTimer); };
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`${typeStyles[toast.type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 min-w-[280px] max-w-sm transition-all duration-300 ${exiting ? 'opacity-0 translate-x-4' : 'opacity-100'}`}
      role="alert"
    >
      <span className="text-lg font-bold">{icons[toast.type]}</span>
      <span className="flex-1 text-sm">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-white/80 hover:text-white bg-transparent border-none cursor-pointer text-lg leading-none p-0"
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}
