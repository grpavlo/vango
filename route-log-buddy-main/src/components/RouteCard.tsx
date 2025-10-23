import React from 'react';
import { ChevronRight, MapPin, Clock, CheckCircle, Route } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
interface RouteCardProps {
  id: string;
  title: string;
  startTime: string;
  duration: string;
  stops: number;
  completedStops: number;
  distance: string;
  isSelected?: boolean;
  onClick: () => void;
  onQuickStart?: () => void;
  onResume?: () => void;
  className?: string;
  notificationCount?: number;
}
const RouteCard = ({
  id,
  title,
  startTime,
  duration,
  stops,
  completedStops,
  distance,
  isSelected = false,
  onClick,
  onQuickStart,
  onResume,
  className,
  notificationCount = 0
}: RouteCardProps) => {
  const progressPercentage = completedStops / stops * 100;
  const status = completedStops === stops ? 'completed' : completedStops > 0 ? 'in_progress' : 'not_started';
  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'in_progress':
        return 'text-orange-600';
      default:
        return 'text-muted-foreground';
    }
  };
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'in_progress':
        return <Clock size={16} className="text-orange-600" />;
      default:
        return <MapPin size={16} className="text-muted-foreground" />;
    }
  };
  const getQuickAction = () => {
    if (status === 'completed') return null;
    if (status === 'in_progress' && onResume) {
      return <Button onClick={e => {
        e.stopPropagation();
        onResume();
      }} size="sm" className="h-8 px-3 bg-orange-600 hover:bg-orange-700 text-white">
          Resume
        </Button>;
    }
    if (status === 'not_started') {
      return null;
    }
    return null;
  };
  return <div onClick={onClick} className={cn('bg-card rounded-lg border p-4 cursor-pointer', 'transition-all duration-200 hover:shadow-md hover:border-primary/20', isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background', status === 'in_progress' && 'ring-1 ring-orange-500/20', !isSelected && 'border-border', className)}>
      {/* Header with route name and status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-body font-semibold text-foreground">{title}</h3>
            {notificationCount > 0}
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className={cn('text-caption', getStatusColor())}>
              {completedStops}/{stops} stops completed
            </span>
          </div>
        </div>
        
        {/* Quick action button and chevron */}
        <div className="flex items-center gap-2">
          {getQuickAction()}
          <ChevronRight size={16} className="text-muted-foreground" />
        </div>
      </div>

      {/* Progress bar */}
      {status !== 'not_started' && <div className="mb-3">
          <div className="w-full bg-muted rounded-full h-2">
            <div className={cn('h-2 rounded-full transition-all duration-500', status === 'completed' ? 'bg-green-600' : 'bg-orange-600')} style={{
          width: `${progressPercentage}%`
        }} />
          </div>
        </div>}

      {/* Footer with time and distance */}
      <div className="flex items-center justify-between text-caption text-muted-foreground">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Clock size={12} />
            <span>{startTime} • {duration}</span>
          </div>
          <div className="flex items-center gap-1">
            <Route size={12} />
            <span>{distance}</span>
          </div>
        </div>
        {status === 'in_progress' && <span className="text-orange-600 font-medium">In Progress</span>}
      </div>
    </div>;
};
export default RouteCard;