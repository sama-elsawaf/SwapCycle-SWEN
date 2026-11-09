import type { ExchangeParticipant, ParticipantResponse } from '../../types';

const responseText: Record<ParticipantResponse, string> = {
  PENDING: 'Waiting',
  ACCEPTED: 'Accepted',
  REJECTED: 'Declined',
};

export default function ParticipantList({ participants }: { participants: ExchangeParticipant[] }) {
  return (
    <ul className="divide-y divide-line">
      {participants.map((p) => (
        <li key={p.user.id} className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="font-medium">{p.user.displayName}</p>
            <p className="text-sm text-slate-navy">
              Gives “{p.gives.description.title}” · Receives “{p.receives.description.title}”
            </p>
            {p.transferred && <p className="text-xs font-medium text-success">Book handed over</p>}
          </div>
          <span className="shrink-0 text-sm font-semibold">{responseText[p.response]}</span>
        </li>
      ))}
    </ul>
  );
}
