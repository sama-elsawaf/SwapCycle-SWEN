/** Decorative botanical sprig in navy and pink. Hidden from screen readers. */
export default function LeafDecoration({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 120 200" fill="none" className={`pointer-events-none ${className}`}>
      <path d="M60 196 C58 140 60 80 62 8" className="stroke-navy" strokeWidth="3" strokeLinecap="round" />
      <path d="M61 150 C30 140 14 112 18 86 C40 92 58 118 61 150Z" className="fill-navy" />
      <path d="M61 118 C92 110 108 84 104 58 C82 64 64 90 61 118Z" className="fill-rose-deep" />
      <path d="M62 82 C36 72 26 46 32 24 C52 32 62 56 62 82Z" className="fill-navy" />
      <path d="M62 52 C82 44 92 26 90 8 C74 14 64 30 62 52Z" className="fill-rose" />
    </svg>
  );
}
