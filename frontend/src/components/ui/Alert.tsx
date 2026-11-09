import type { ReactNode } from 'react';

type Kind = 'error' | 'success' | 'info';

const KINDS: Record<Kind, string> = {
  error: 'border-danger text-danger',
  success: 'border-success text-success',
  info: 'border-soft text-navy',
};

/** Error alerts are announced immediately (role="alert"); others politely (role="status"). */
export default function Alert({ kind = 'info', children }: { kind?: Kind; children: ReactNode }) {
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={`rounded-card border bg-white px-4 py-3 text-sm font-medium ${KINDS[kind]}`}
    >
      {children}
    </div>
  );
}
