import { ComplaintStatus } from '@/lib/types';
import { COMPLAINT_STATUSES } from '@/lib/constants';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: ComplaintStatus;
  className?: string;
}

const getStatusColor = (status: ComplaintStatus): string => {
  const statusConfig = COMPLAINT_STATUSES.find(s => s.value === status);
  return statusConfig?.color || 'slate';
};

const getStatusVariant = (status: ComplaintStatus): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' => {
  const colorMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'> = {
    emerald: 'success',
    rose: 'destructive',
    amber: 'warning',
    yellow: 'warning',
    slate: 'secondary',
  };
  
  const color = getStatusColor(status);
  return colorMap[color] || 'default';
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusConfig = COMPLAINT_STATUSES.find(s => s.value === status);
  const variant = getStatusVariant(status);
  
  return (
    <Badge variant={variant} className={cn('capitalize', className)}>
      {statusConfig?.label || status}
    </Badge>
  );
}
