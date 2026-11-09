import type { ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'danger';

// Coloured border, dark text on white so every tone meets AA contrast.
const TONES: Record<Tone, string> = {
  neutral: 'border-slate text-slate',
  success: 'border-success text-success',
  warning: 'border-warning text-navy',
  danger: 'border-danger text-danger',
};

export default function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-block rounded-full border bg-white px-3 py-1 text-xs font-semibold ${TONES[tone]}`}>
      {children}
    </span>
  );
}
