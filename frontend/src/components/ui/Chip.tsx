import type { ReactNode } from 'react';

interface Props {
  label: string;
  icon?: ReactNode;
  selected: boolean;
  onToggle: () => void;
  /** "dark" for navy screens such as onboarding. */
  tone?: 'light' | 'dark';
}

/**
 * A selectable category chip. Selected chips turn rose with a check mark.
 * Deep navy on deep rose is 5.4:1, so the selected label stays readable.
 */
export default function Chip({ label, icon, selected, onToggle, tone = 'light' }: Props) {
  const unselected = tone === 'dark' ? 'border-slate bg-navy text-white' : 'border-soft bg-white text-navy';
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={
        'flex min-h-16 items-center gap-3 rounded-card border px-4 py-3 text-left text-sm font-medium transition-colors ' +
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose ' +
        (selected ? 'border-rose-deep bg-rose-deep text-navy-deep' : unselected)
      }
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      <span className="flex-1">{label}</span>
      {selected && (
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 shrink-0">
          <circle cx="10" cy="10" r="10" className="fill-white" />
          <path d="M6 10.5l2.5 2.5L14 7.5" fill="none" strokeWidth="2" className="stroke-rose-deep" />
        </svg>
      )}
    </button>
  );
}
