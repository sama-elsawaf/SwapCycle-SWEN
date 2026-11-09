import Card from '../ui/Card';
import ConditionBadge from './ConditionBadge';
import type { BookCopy, CopyStatus } from '../../types';

const STATUS_TEXT: Record<CopyStatus, string> = {
  AVAILABLE: 'Available',
  RESERVED: 'Reserved',
  TRANSFERRED: 'Swapped',
  WITHDRAWN: 'Withdrawn',
};

interface Props {
  copy: BookCopy;
  onSelect?: (copy: BookCopy) => void;
}

export default function BookCard({ copy, onSelect }: Props) {
  const { description: d, owner, condition, photoUrls, status } = copy;
  const body = (
    <Card className="flex gap-4">
      {photoUrls[0] ? (
        <img src={photoUrls[0]} alt={`Cover of ${d.title}`} className="h-28 w-20 rounded-lg object-cover bg-white" />
      ) : (
        <div className="h-28 w-20 rounded-lg bg-white border border-line" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <h3 className="text-lg truncate">{d.title}</h3>
        <p className="text-sm text-slate-navy">{d.author} · {d.language}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ConditionBadge condition={condition} />
          {status !== 'AVAILABLE' && (
            <span className="rounded-full border border-warning bg-white px-3 py-1 text-xs font-medium text-navy">
              {STATUS_TEXT[status]}
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-navy">
          {owner.displayName}{owner.meetingArea ? ` · ${owner.meetingArea}` : ''}
        </p>
      </div>
    </Card>
  );
  // React escapes all text above; no raw HTML is rendered.
  return onSelect ? (
    <button type="button" onClick={() => onSelect(copy)} className="block w-full text-left rounded-card">
      {body}
    </button>
  ) : body;
}
