'use client';

export function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="1.5" />
      <path d="M8 3v4M16 3v4M3 10h18M12 14v4M10 16h4" />
    </svg>
  );
}

export function CalendarButton({ label, onClick, className = 'cal-btn' }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" className={className} title="Add to calendar" aria-label={label} onClick={onClick}>
      <CalendarIcon />
    </button>
  );
}
