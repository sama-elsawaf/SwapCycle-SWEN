import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  fullWidth?: boolean;
  /** Shows a spinner and marks the button busy; also disables it. */
  loading?: boolean;
};

// Primary text is 19px bold so white on deep rose (3.2:1) counts as large
// text under WCAG AA, which needs 3:1.
const VARIANTS: Record<Variant, string> = {
  primary: 'h-14 bg-rose-deep px-8 text-[1.1875rem] font-bold text-white hover:bg-navy active:bg-navy-deep',
  secondary: 'h-12 border border-navy bg-white px-6 font-semibold text-navy hover:bg-pink-light',
  ghost: 'h-11 px-4 font-medium text-navy hover:bg-pink-light',
  danger: 'h-12 bg-danger px-6 font-semibold text-white hover:bg-navy',
};

export default function Button({
  variant = 'primary',
  fullWidth = false,
  loading = false,
  disabled,
  type = 'button',
  className = '',
  children,
  ...props
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={
        'inline-flex items-center justify-center gap-2 rounded-full transition-colors ' +
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ' +
        'disabled:cursor-not-allowed disabled:opacity-60 ' +
        `${VARIANTS[variant]} ${fullWidth ? 'w-full' : ''} ${className}`
      }
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {children}
    </button>
  );
}
