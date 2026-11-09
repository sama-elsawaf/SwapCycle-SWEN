import Card from '../ui/Card';
import StatusBadge from './StatusBadge';
import ParticipantList from './ParticipantList';
import type { Exchange } from '../../types';

export default function ExchangeSummary({ exchange }: { exchange: Exchange }) {
  const kind = exchange.participants.length === 2 ? 'Two-way swap' : 'Three-way cycle';
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl">{kind}</h2>
        <StatusBadge status={exchange.status} />
      </div>
      <p className="mt-2 text-sm text-slate-navy">{exchange.explanation}</p>
      <div className="mt-3"><ParticipantList participants={exchange.participants} /></div>
      {exchange.expiresAt && exchange.status === 'PROPOSED' && (
        <p className="mt-2 text-xs text-slate-navy">
          Reservation ends {new Date(exchange.expiresAt).toLocaleString()}
        </p>
      )}
    </Card>
  );
}
