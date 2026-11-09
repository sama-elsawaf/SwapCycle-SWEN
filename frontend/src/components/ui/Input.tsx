import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Keeps the label for screen readers but hides it visually (placeholder-style designs). */
  hideLabel?: boolean;
  /** Decorative icon shown before the text. */
  icon?: ReactNode;
  /** Content after the text, e.g. a show/hide password button. */
  trailing?: ReactNode;
  error?: string;
  hint?: string;
};

/** White input with a thin pink border and an optional leading icon. */
const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, hideLabel = false, icon, trailing, error, hint, id, className = '', ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [error ? errorId : null, hint && !error ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <label htmlFor={inputId} className={hideLabel ? 'sr-only' : 'mb-1 block text-sm font-medium text-navy'}>
        {label}
      </label>
      <div
        className={
          'flex h-14 items-center gap-3 rounded-card border bg-white px-4 text-navy ' +
          'focus-within:ring-2 focus-within:ring-rose-deep ' +
          (error ? 'border-danger' : 'border-soft')
        }
      >
        {icon && (
          <span aria-hidden="true" className="shrink-0 text-navy">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-navy placeholder:text-slate focus:outline-none"
          {...props}
        />
        {trailing}
      </div>
      {hint && !error && (
        <p id={hintId} className="mt-1 text-sm text-slate">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
});

export default Input;
