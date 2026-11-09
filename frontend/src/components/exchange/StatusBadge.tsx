import { STATUS_LABELS } from '../../types';
import type { ExchangeStatus } from '../../types';

const tone: Record<ExchangeStatus, string> = {
  PROPOSED: 'text-navy border-warning',
  ACTIVE: 'text-success border-success',
  COMPLETED: 'text-success border-success',
  PARTIALLY_COMPLETED: 'text-navy border-warning',
  REJECTED: 'text-danger border-danger',
  EXPIRED: 'text-slate-navy border-line',
  CANCELLED: 'text-slate-navy border-line',
  DISPUTED: 'text-danger border-danger',
};

export default function StatusBadge({ status }: { status: ExchangeStatus }) {
  return (
    <span className={`inline-block rounded-full border bg-white px-3 py-1 text-xs font-semibold ${tone[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
