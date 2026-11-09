import type { ReactNode } from 'react';
import LeafDecoration from './LeafDecoration';

interface Props {
  title?: string;
  onBack?: () => void;
  dark?: boolean;
  children: ReactNode;
}

export default function PageShell({ title, onBack, dark = false, children }: Props) {
  return (
    <div className={`relative min-h-screen overflow-hidden ${dark ? 'bg-navy-deep text-white' : 'bg-blush text-navy'}`}>
      <LeafDecoration className="absolute -top-2 -right-4 w-24 opacity-90" />
      <main className="relative mx-auto w-full max-w-md md:max-w-2xl lg:max-w-4xl px-5 py-6">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="mb-4 rounded-full p-2 text-2xl leading-none"
          >
            ←
          </button>
        )}
        {title && <h1 className={`text-3xl mb-4 ${dark ? '!text-white' : ''}`}>{title}</h1>}
        {children}
      </main>
    </div>
  );
}
