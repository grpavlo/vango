import React, { useState, useEffect } from 'react';
import { MapPin, CheckCircle, Clock, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnhancedCheckpointCardProps {
  address: string;
  time: string;
  isCompleted: boolean;
  isActive?: boolean;
  samplesCount?: number;
  onComplete?: () => void;
  className?: string;
}

export const EnhancedCheckpointCard = ({
  address,
  time,
  isCompleted,
  isActive = false,
  samplesCount,
  onComplete,
  className
}: EnhancedCheckpointCardProps) => {
  const [isCompleting, setIsCompleting] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  const handleComplete = async () => {
    if (isCompleted || !onComplete) return;
    
    setIsCompleting(true);
    
    // Simulate completion process
    setTimeout(() => {
      setIsCompleting(false);
      setJustCompleted(true);
      onComplete();
      
      // Reset animation state after completion
      setTimeout(() => setJustCompleted(false), 1000);
    }, 1500);
  };

  useEffect(() => {
    if (isCompleted && !justCompleted) {
      // Trigger completion animation when prop changes
      setJustCompleted(true);
      setTimeout(() => setJustCompleted(false), 600);
    }
  }, [isCompleted]);

  return (
    <div
      className={cn(
        'bg-card rounded-lg border p-4 transition-all duration-300',
        isActive && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        isCompleting && 'status-completing',
        justCompleted && 'status-just-completed',
        isCompleted && !justCompleted && 'border-green-500/30 bg-green-50/30',
        !isCompleted && !isActive && 'border-border',
        className
      )}
    >
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1',
          isCompleted && 'bg-green-100 text-green-600',
          isActive && !isCompleted && 'bg-orange-100 text-orange-600',
          !isActive && !isCompleted && 'bg-muted text-muted-foreground'
        )}>
          {isCompleting ? (
            <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
          ) : isCompleted ? (
            <CheckCircle size={16} />
          ) : isActive ? (
            <Clock size={16} />
          ) : (
            <MapPin size={16} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className={cn(
                'text-body font-medium mb-1',
                isCompleted ? 'text-green-700' : 'text-foreground'
              )}>
                {address}
              </p>
              <div className="flex items-center gap-3 text-caption text-muted-foreground">
                <span>{time}</span>
                {samplesCount && (
                  <div className="flex items-center gap-1">
                    <Package size={12} />
                    <span>{samplesCount} samples</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Button */}
            {isActive && !isCompleted && onComplete && (
              <button
                onClick={handleComplete}
                disabled={isCompleting}
                className={cn(
                  'ml-3 px-3 py-1 rounded-md text-caption font-medium transition-all duration-200',
                  isCompleting 
                    ? 'bg-orange-100 text-orange-600 cursor-not-allowed'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95'
                )}
              >
                {isCompleting ? 'Completing...' : 'Complete'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress indicator for active checkpoint */}
      {isActive && !isCompleted && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2 text-caption text-orange-600">
            <div className="w-2 h-2 bg-orange-600 rounded-full animate-pulse" />
            <span>Current stop</span>
          </div>
        </div>
      )}
    </div>
  );
};