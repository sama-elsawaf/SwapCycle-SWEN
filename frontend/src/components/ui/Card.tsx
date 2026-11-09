import type { HTMLAttributes } from 'react';

/** Rounded (16px), flat surface with a soft pink border. */
export default function Card({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-card border border-soft bg-white p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}
