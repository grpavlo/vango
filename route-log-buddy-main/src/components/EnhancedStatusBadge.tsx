import React from 'react';
import { CheckCircle, Clock, AlertCircle, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnhancedStatusBadgeProps {
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'delayed';
  label?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const EnhancedStatusBadge = ({
  status,
  label,
  showIcon = true,
  size = 'md',
  className
}: EnhancedStatusBadgeProps) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          icon: CheckCircle,
          color: 'bg-green-100 text-green-700 border-green-200',
          defaultLabel: 'Completed',
          animate: 'animate-pulse-success'
        };
      case 'in_progress':
        return {
          icon: Clock,
          color: 'bg-orange-100 text-orange-700 border-orange-200',
          defaultLabel: 'In Progress',
          animate: 'animate-pulse'
        };
      case 'overdue':
        return {
          icon: AlertCircle,
          color: 'bg-red-100 text-red-700 border-red-200',
          defaultLabel: 'Overdue',
          animate: 'animate-pulse'
        };
      case 'delayed':
        return {
          icon: AlertCircle,
          color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
          defaultLabel: 'Delayed',
          animate: ''
        };
      default:
        return {
          icon: MapPin,
          color: 'bg-muted text-muted-foreground border-border',
          defaultLabel: 'Not Started',
          animate: ''
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-2.5 py-1.5 text-sm',
    lg: 'px-3 py-2 text-base'
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        'transition-all duration-200',
        config.color,
        sizeClasses[size],
        config.animate,
        className
      )}
    >
      {showIcon && <Icon size={iconSizes[size]} />}
      {label || config.defaultLabel}
    </span>
  );
};