import type { BookCondition } from '../../types';
import { conditionLabel } from '../../utils/format';
import Badge from '../ui/Badge';

const TONE: Record<BookCondition, 'success' | 'neutral' | 'warning'> = {
  NEW: 'success',
  LIKE_NEW: 'success',
  GOOD: 'neutral',
  FAIR: 'warning',
  POOR: 'warning',
};

export default function ConditionBadge({ condition }: { condition: BookCondition }) {
  return <Badge tone={TONE[condition]}>{conditionLabel(condition)}</Badge>;
}
